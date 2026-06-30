import { Injectable, Logger } from '@nestjs/common';
import { simpleGit, type SimpleGit } from 'simple-git';
import { ConfigService } from '../config/config.service';
import { PrismaService } from '../prisma/prisma.service';
import { CloneCleanupService } from './clone-cleanup.service';
import {
    CLONE_TIMEOUT_MS,
    RETRYABLE_CLONE_ERROR_PATTERNS,
    MAX_NETWORK_RETRY_ATTEMPTS,
    GITHUB_MIRROR_SOURCES,
    type MirrorSourceName,
} from './clone.constants';
import { getMirrorUrl, calculateBackoffDelay, isNetworkError, delay, isPathWithinTargetDir } from './clone.utils';
import * as path from 'path';
import { mkdir, rm, chmod, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import * as os from 'os';

/**
 * 克隆模块执行子服务
 *
 * 负责实际的 Git clone/pull 操作、仓库验证和修复。
 * 独立抽取以减小 clone.service.ts 的体积。
 *
 * @callers
 *   - CloneService.processItemInner — 处理单个克隆子项
 *
 * @depends
 *   - PrismaService — 查询仓库信息
 *   - ConfigService — 读取 Git Token 和代理配置
 *   - CloneCleanupService — 克隆失败时清理目录
 */
@Injectable()
export class CloneExecutorService {
    private readonly logger = new Logger(CloneExecutorService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly config: ConfigService,
        private readonly cleanupService: CloneCleanupService,
    ) {}

    /**
     * 创建 SimpleGit 实例
     *
     * @param options.baseDir Git 工作目录
     * @param options.timeoutMs 超时时间（毫秒）
     * @param options.githubToken GitHub Token（可选，通过 GIT_ASKPASS 注入）
     * @returns git 实例 + cleanup 回调（清理 askpass 脚本）
     */
    private async createGit(options: { baseDir?: string; timeoutMs?: number; githubToken?: string }): Promise<{ git: SimpleGit; cleanup: () => void }> {
        let askpassPath: string | undefined;

        const git = simpleGit({
            baseDir: options.baseDir ?? process.cwd(),
            config: ['core.longpaths=true', 'core.protectNTFS=false'],
            timeout: { block: options.timeoutMs ?? CLONE_TIMEOUT_MS },
        });

        git.env('GIT_TERMINAL_PROMPT', '0');
        if (options.githubToken) {
            askpassPath = await this.writeAskpassScript(options.githubToken);
            git.env('GIT_ASKPASS', askpassPath);
        }

        // 读取并注入代理配置（从 system_config 或环境变量）
        const httpProxy = (await this.config.getValue('clone.http_proxy')) || process.env.HTTP_PROXY || process.env.http_proxy || '';
        const httpsProxy = (await this.config.getValue('clone.https_proxy')) || process.env.HTTPS_PROXY || process.env.https_proxy || '';
        if (httpProxy) { git.env('HTTP_PROXY', httpProxy); git.env('http_proxy', httpProxy); }
        if (httpsProxy) { git.env('HTTPS_PROXY', httpsProxy); git.env('https_proxy', httpsProxy); }

        return {
            git,
            cleanup: () => {
                if (askpassPath) this.cleanupAskpassScript(askpassPath);
            },
        };
    }

    // ---- Task execution ----

    /**
     * 执行克隆操作（含镜像代理、重试、已有仓库处理）
     *
     * @returns { success: boolean; error?: string }
     */
    async executeClone(
        item: { id: bigint; fullName: string | null; localPath: string | null; cloneUrl: string | null },
        shallow: boolean,
        mirrorSource: MirrorSourceName = 'direct',
        targetDir?: string,
    ): Promise<{ success: boolean; error?: string }> {
        const localPath = item.localPath as string;
        if (!isPathWithinTargetDir(localPath, targetDir)) {
            return { success: false, error: `路径安全校验失败: ${localPath} 不在目标目录内` };
        }

        // 处理空 URL
        const emptyUrlResult = await this.handleEmptyCloneUrl(localPath, item.cloneUrl ?? '');
        if (emptyUrlResult) return emptyUrlResult;

        const { finalUrl, githubToken } = await this.prepareCloneUrl(item.cloneUrl as string, mirrorSource, item.fullName);

        try {
            // 处理已有仓库
            const existingResult = await this.handleExistingRepo(localPath, item, finalUrl, shallow, githubToken);
            if (existingResult) return existingResult;

            const parentDir = path.dirname(localPath);
            await mkdir(parentDir, { recursive: true });
            return await this.executeGitClone(finalUrl, localPath, shallow, item.fullName, githubToken);
        } catch (e: unknown) {
            const errorMsg = e instanceof Error ? (e as Error & { stderr?: string }).stderr || e.message : String(e);
            await this.cleanupService.cleanFailedCloneDir(localPath);

            if (!RETRYABLE_CLONE_ERROR_PATTERNS.some((pattern) => errorMsg.includes(pattern))) {
                return { success: false, error: errorMsg.substring(0, 2000) };
            }
            const isNetErr = isNetworkError(errorMsg);
            const maxRetries = isNetErr ? MAX_NETWORK_RETRY_ATTEMPTS : 1;
            this.logger.warn(`检测到${isNetErr ? '网络' : 'Git内部'}错误，准备重试: ${item.fullName} | 最大重试次数: ${maxRetries}`);
            return await this.executeRetryLoop(finalUrl, localPath, shallow, item.fullName, isNetErr, maxRetries, githubToken);
        }
    }

    /**
     * 执行首次 Git Clone
     */
    private async executeGitClone(
        finalUrl: string,
        localPath: string,
        shallow: boolean,
        fullName: string | null,
        githubToken?: string,
    ): Promise<{ success: boolean; error?: string }> {
        const { git, cleanup } = await this.createGit({ baseDir: path.dirname(localPath), githubToken });
        try {
            const args = shallow ? ['clone', finalUrl, localPath, '--depth', '1'] : ['clone', finalUrl, localPath];
            await git.raw(args);
            this.logger.log(`克隆成功: ${fullName} -> ${localPath}`);
            return { success: true };
        } catch (e: unknown) {
            const errorMsg = e instanceof Error ? (e as Error & { stderr?: string }).stderr || e.message : String(e);
            return { success: false, error: errorMsg.substring(0, 2000) };
        } finally {
            cleanup();
        }
    }

    /**
     * 执行 Git Pull（更新已有仓库）
     */
    private async executeGitPull(
        localPath: string,
        fullName: string | null,
        githubToken?: string,
    ): Promise<{ success: boolean; error?: string; needsReclone?: boolean }> {
        const { git, cleanup } = await this.createGit({ baseDir: localPath, githubToken, timeoutMs: 60_000 });
        try {
            // 先获取默认分支
            const defaultBranch = await this.detectDefaultBranch(localPath);
            const branchToPull = defaultBranch || 'main';

            // 尝试 pull
            try {
                await git.raw(['pull', 'origin', branchToPull]);
                this.logger.log(`拉取成功: ${fullName} -> ${localPath}`);
                return { success: true };
            } catch (pullErr: unknown) {
                const pullErrorMsg = pullErr instanceof Error ? pullErr.message : String(pullErr);
                // 如果 pull 失败且错误涉及历史/浅克隆，尝试 git fetch + reset
                if (pullErrorMsg.includes('shallow') || pullErrorMsg.includes('fetch') || pullErrorMsg.includes('history')) {
                    try {
                        await git.fetch(['--unshallow']);
                        await git.raw(['reset', '--hard', `origin/${branchToPull}`]);
                        this.logger.log(`通过 fetch+reset 更新成功: ${fullName}`);
                        return { success: true };
                    } catch {
                        // fetch+reset 也失败，需要重新克隆
                    }
                }
                return { success: false, error: pullErrorMsg.substring(0, 2000), needsReclone: true };
            }
        } catch (e: unknown) {
            const errorMsg = e instanceof Error ? e.message : String(e);
            return { success: false, error: errorMsg.substring(0, 2000), needsReclone: true };
        } finally {
            cleanup();
        }
    }

    /**
     * 重试循环
     */
    private async executeRetryLoop(
        finalUrl: string,
        localPath: string,
        shallow: boolean,
        fullName: string | null,
        isNetErr: boolean,
        maxRetries: number,
        githubToken?: string,
    ): Promise<{ success: boolean; error?: string }> {
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            const backoffMs = isNetErr ? calculateBackoffDelay(attempt) : 0;
            this.logger.warn(`克隆重试 ${attempt + 1}/${maxRetries}: ${fullName} | ${backoffMs}ms 后重试`);
            if (backoffMs > 0) await delay(backoffMs);

            try {
                await this.cleanupService.cleanFailedCloneDir(localPath);
                const result = await this.executeGitClone(finalUrl, localPath, shallow, fullName, githubToken);
                if (result.success) return result;
                const retryErrorMsg = result.error || '未知错误';
                this.logger.warn(`重试 ${attempt + 1}/${maxRetries} 仍失败: ${fullName} | ${retryErrorMsg}`);
            } catch (retryErr: unknown) {
                const retryErrorMsg = retryErr instanceof Error ? retryErr.message : String(retryErr);
                this.logger.warn(`重试 ${attempt + 1}/${maxRetries} 异常: ${fullName} | ${retryErrorMsg}`);
            }
        }
        return { success: false, error: `克隆失败（已重试 ${maxRetries} 次）` };
    }

    // ---- URL handling ----

    /**
     * 准备克隆 URL（处理镜像代理和 Token 注入）
     */
    async prepareCloneUrl(
        cloneUrl: string,
        mirrorSource: MirrorSourceName,
        fullName?: string | null,
    ): Promise<{ finalUrl: string; shouldUseMirror: boolean; githubToken?: string }> {
        const githubToken = await this.config.getValue('github.token');
        const shouldUseMirror = mirrorSource !== 'direct' && !githubToken;
        let finalUrl = cloneUrl;

        // Token 已配置 + cloneUrl 是代理地址 → 还原为直连
        if (githubToken && mirrorSource !== 'direct') {
            const stripped = this.stripProxyUrl(cloneUrl);
            if (stripped !== cloneUrl) {
                finalUrl = stripped;
                this.logger.log(`检测到 Token 已配置，从代理 URL 还原为直连: ${mirrorSource} | ${fullName ?? cloneUrl}`);
            }
        }

        // 无 Token + 需要镜像代理 + 尚未被代理 → 包装为代理 URL
        if (shouldUseMirror) {
            const isAlreadyProxied = GITHUB_MIRROR_SOURCES.some((s) => s.url && cloneUrl.startsWith(s.url + '/'));
            if (!isAlreadyProxied) finalUrl = getMirrorUrl(cloneUrl, mirrorSource);
        }

        if (shouldUseMirror && fullName) {
            this.logger.log(`使用镜像代理: ${mirrorSource} | ${fullName}`);
        }
        return { finalUrl, shouldUseMirror, githubToken };
    }

    /**
     * 从镜像代理 URL 中还原原始 GitHub URL
     */
    private stripProxyUrl(url: string): string {
        for (const source of GITHUB_MIRROR_SOURCES) {
            if (source.url && url.startsWith(source.url + '/')) {
                const stripped = url.substring(source.url.length + 1);
                if (stripped.startsWith('https://') || stripped.startsWith('http://')) return stripped;
                return 'https://' + stripped;
            }
        }
        return url;
    }

    // ---- Empty URL ----

    /**
     * 处理 cloneUrl 为空的情况
     * 常见于仓库没有 HTTP clone URL 的特殊情况
     */
    private async handleEmptyCloneUrl(localPath: string, cloneUrl: string | null): Promise<{ success: boolean; error?: string } | null> {
        if (cloneUrl) return null; // cloneUrl 非空，无需处理
        if (!existsSync(localPath)) {
            return { success: false, error: '克隆 URL 为空，无法克隆' };
        }
        return null; // 本地已有路径，视为已存在，由后续逻辑处理
    }

    /**
     * 处理已有仓库（验证 + 修复 + 更新）
     */
    async handleExistingRepo(
        localPath: string,
        item: { id: bigint; fullName: string | null },
        finalUrl: string,
        shallow: boolean,
        githubToken?: string,
    ): Promise<{ success: boolean; error?: string } | null> {
        if (!existsSync(localPath)) return null;

        // 验证已有仓库
        const validation = await this.validateExistingRepo(localPath, finalUrl);
        if (validation.success) {
            // 仓库正常 → 尝试 pull 更新
            const pullResult = await this.executeGitPull(localPath, item.fullName, githubToken);
            if (pullResult.success) return { success: true };
            if (pullResult.needsReclone) {
                // pull 失败但需要重新克隆 → 删除目录，由调用方重新 clone
                this.logger.warn(`仓库 ${item.fullName} pull 失败，准备删除后重新克隆: ${pullResult.error}`);
                const dirDeleted = await this.cleanupService.removeCloneDir(localPath);
                if (!dirDeleted) {
                    const altPath = this.cleanupService.findAlternateClonePath(localPath);
                    this.logger.warn(`目录删除失败，使用备用路径: ${altPath} | ${item.fullName}`);
                    return { success: false, error: `目录被锁定，请手动删除: ${localPath}` };
                }
                return null; // 返回 null 表示"已删除，由上层重新 clone"
            }
            return { success: false, error: pullResult.error || '仓库更新失败' };
        }

        // 仓库损坏 → 尝试修复
        const repairResult = await this.tryRepairRepo(localPath, item, finalUrl, shallow, githubToken);
        if (repairResult.success) {
            await this.prisma.cloneTaskItem.update({
                where: { id: item.id },
                data: { errorMessage: null, retryCount: 0 },
            });
        }
        if (repairResult.success === false && repairResult.error) {
            // 修复失败 → 删除目录，由调用方重新 clone
            const dirDeleted = await this.cleanupService.removeCloneDir(localPath);
            if (!dirDeleted) {
                return { success: false, error: `仓库损坏且目录被锁定: ${localPath}` };
            }
            return null;
        }
        return repairResult;
    }

    // ---- Validation ----

    /**
     * 验证已有仓库是否正常
     */
    private async validateExistingRepo(localPath: string, expectedCloneUrl: string): Promise<{ success: boolean; error?: string }> {
        const gitDir = path.join(localPath, '.git');
        if (!existsSync(gitDir)) return { success: false, error: '.git 目录不存在' };

        const { git, cleanup } = await this.createGit({ baseDir: localPath });
        try {
            // 检查是否是有效的 git 仓库
            try {
                const entries = await git.raw(['rev-parse', '--git-dir']);
                if (!entries.trim()) return { success: false, error: '不是有效的 Git 仓库' };
            } catch {
                return { success: false, error: 'rev-parse 失败' };
            }

            // 检查非 .git 文件是否被清空
            try {
                const dirEntries = await git.raw(['ls-tree', '-r', '--name-only', 'HEAD']);
                if (!dirEntries.trim()) return { success: false, error: '仓库 HEAD 无文件' };
            } catch {
                // HEAD 不存在（空仓库或损坏）
            }

            // 检查 remote origin 是否匹配
            try {
                const remoteUrl = await git.raw(['remote', 'get-url', 'origin']);
                const normalizeUrl = (url: string) => url.replace(/^https:\/\//, '').replace(/\.git$/, '').toLowerCase();
                const urlMatch = normalizeUrl(remoteUrl.trim()).includes(normalizeUrl(expectedCloneUrl));
                if (!urlMatch) {
                    return { success: false, error: `remote origin 不匹配: ${remoteUrl.trim()}` };
                }
            } catch {
                return { success: false, error: 'remote origin 不存在' };
            }

            return { success: true };
        } catch (e: unknown) {
            const errorMsg = e instanceof Error ? e.message : String(e);
            return { success: false, error: errorMsg.substring(0, 500) };
        } finally {
            cleanup();
        }
    }

    /**
     * 尝试修复损坏的 Git 仓库
     */
    private async tryRepairRepo(
        localPath: string,
        item: { id: bigint; fullName: string | null },
        finalUrl: string,
        shallow: boolean,
        githubToken?: string,
    ): Promise<{ success: boolean; error?: string }> {
        const gitDir = path.join(localPath, '.git');
        if (!existsSync(gitDir)) {
            return await this.repairGitInit(localPath, item, finalUrl, shallow, githubToken);
        }

        // 尝试修复 lock 文件
        await this.repairLockFile(localPath);

        // 尝试修复 remote URL
        await this.repairRemoteUrl(localPath, finalUrl);

        // 重新验证
        const revalidation = await this.validateExistingRepo(localPath, finalUrl);
        if (revalidation.success) return { success: true };
        return { success: false, error: revalidation.error };
    }

    /**
     * 修复：删除 Git lock 文件
     */
    private async repairLockFile(localPath: string): Promise<void> {
        try {
            const lockFile = path.join(localPath, '.git', 'index.lock');
            if (existsSync(lockFile)) {
                await rm(lockFile, { force: true });
                this.logger.log(`已删除 index.lock: ${localPath}`);
            }
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            this.logger.warn(`删除 index.lock 失败: ${msg}`);
        }
    }

    /**
     * 修复：重新初始化 .git 目录
     */
    private async repairGitInit(
        localPath: string,
        item: { id: bigint; fullName: string | null },
        finalUrl: string,
        shallow: boolean,
        githubToken?: string,
    ): Promise<{ success: boolean; error?: string }> {
        // 检查路径是否被非 Git 目录占用
        const checkCleanup = async () => {
            if (existsSync(localPath)) {
                try {
                    await rm(localPath, { recursive: true, force: true });
                } catch (rmErr: unknown) {
                    const rmMsg = rmErr instanceof Error ? rmErr.message : String(rmErr);
                    return `无法删除目录: ${rmMsg}`;
                }
            }
            return null;
        };

        const dirErr = await checkCleanup();
        if (dirErr) return { success: false, error: dirErr };

        try {
            await this.cleanupService.cleanFailedCloneDir(localPath);
            const parentDir = path.dirname(localPath);
            await mkdir(parentDir, { recursive: true });

            const result = await this.executeGitClone(finalUrl, localPath, shallow, item.fullName, githubToken);
            return result;
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            return { success: false, error: `修复后重新克隆失败: ${msg.substring(0, 500)}` };
        }
    }

    /**
     * 修复：重置 remote origin URL
     */
    private async repairRemoteUrl(localPath: string, expectedUrl: string): Promise<void> {
        const { git, cleanup } = await this.createGit({ baseDir: localPath });
        try {
            try {
                const currentUrl = await git.raw(['remote', 'get-url', 'origin']);
                const normalizeUrl = (url: string) => url.replace(/^https:\/\//, '').replace(/\.git$/, '').toLowerCase();
                if (normalizeUrl(currentUrl.trim()).includes(normalizeUrl(expectedUrl))) {
                    return; // URL 匹配，无需修复
                }
            } catch {
                // remote 不存在
            }
            // 重置 remote
            try {
                await git.raw(['remote', 'remove', 'origin']);
            } catch { /* 忽略 */ }
            await git.raw(['remote', 'add', 'origin', expectedUrl]);
            this.logger.log(`已修复 remote origin: ${localPath}`);
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            this.logger.warn(`修复 remote URL 失败: ${msg}`);
        } finally {
            cleanup();
        }
    }

    /**
     * 修复：fetch origin 信息
     */
    async repairFetchOrigin(
        localPath: string,
        fullName?: string | null,
    ): Promise<{ success: boolean; error?: string }> {
        const { git, cleanup } = await this.createGit({ baseDir: localPath, timeoutMs: 30_000 });
        try {
            await git.fetch(['--all']);
            this.logger.log(`fetch origin 成功: ${fullName}`);
            return { success: true };
        } catch (e: unknown) {
            const errorMsg = e instanceof Error ? e.message : String(e);
            return { success: false, error: errorMsg.substring(0, 500) };
        } finally {
            cleanup();
        }
    }

    // ---- Branch detection ----

    /**
     * 检测本地仓库的默认分支
     */
    async detectDefaultBranch(localPath: string): Promise<string | null> {
        const { git, cleanup } = await this.createGit({ baseDir: localPath, timeoutMs: 10_000 });
        try {
            const stdout = await git.raw(['symbolic-ref', 'refs/remotes/origin/HEAD']);
            const match = /refs\/remotes\/origin\/(.+)/.exec(stdout.trim());
            return match ? match[1] : null;
        } catch {
            for (const candidate of ['main', 'master']) {
                try {
                    await git.raw(['rev-parse', `refs/remotes/origin/${candidate}`]);
                    return candidate;
                } catch { /* continue */ }
            }
            return null;
        } finally {
            cleanup();
        }
    }

    /**
     * 执行 Git Init + Fetch（用于重新初始化空仓库）
     */
    async doGitInit(localPath: string, remoteUrl: string, fullName?: string | null): Promise<{ success: boolean; error?: string }> {
        const { git, cleanup } = await this.createGit({ baseDir: localPath, timeoutMs: 60_000 });
        try {
            await git.raw(['init']);
            await git.raw(['remote', 'add', 'origin', remoteUrl]);
            this.logger.log(`git init 成功: ${fullName}`);
            return { success: true };
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            return { success: false, error: msg.substring(0, 500) };
        } finally {
            cleanup();
        }
    }

    // ---- Askpass script ----

    /**
     * 写入 GIT_ASKPASS 脚本
     *
     * 用于在不安全的命令行参数环境中安全传递 Git 凭据。
     * 脚本内容为输出 Token 的简单脚本。
     */
    private async writeAskpassScript(token: string): Promise<string> {
        const isWindows = os.platform() === 'win32';
        const tempDir = process.env.TEMP || '/tmp';
        const scriptPath = path.join(tempDir, `git-askpass-${Date.now()}.${isWindows ? 'bat' : 'sh'}`);

        if (isWindows) {
            const content = `@echo off\necho ${token}`;
            await writeFile(scriptPath, content, { encoding: 'utf8' });
        } else {
            const content = `#!/bin/sh\necho "${token}"`;
            await writeFile(scriptPath, content, { encoding: 'utf8' });
            await chmod(scriptPath, 0o700);
        }
        return scriptPath;
    }

    /**
     * 清理 GIT_ASKPASS 脚本
     */
    private async cleanupAskpassScript(scriptPath: string): Promise<void> {
        try {
            if (existsSync(scriptPath)) {
                await rm(scriptPath, { force: true });
            }
        } catch { /* 忽略清理失败 */ }
    }
}
