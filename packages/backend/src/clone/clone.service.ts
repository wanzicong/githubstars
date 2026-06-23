import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '../config/config.service';
import {
    CLONE_TIMEOUT_MS,
    ITEM_TIMEOUT_MS,
    TASK_TIMEOUT_MS,
    SEMAPHORE_TIMEOUT_MS,
    STUCK_TASK_THRESHOLD_MS,
    MAX_HISTORY_TASKS,
    MAX_RETRY_ATTEMPTS,
    RETRYABLE_CLONE_ERROR_PATTERNS,
} from './clone.constants';
import { CreateCloneTaskDto } from './clone.dto';
import { execFile } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import { existsSync, readdirSync, readFileSync } from 'fs';
import { mkdir, rm } from 'fs/promises';

const execFileAsync = promisify(execFile);

/**
 * 为 Promise 添加超时包装
 *
 * @param promise   原始 Promise
 * @param ms        超时时间（毫秒）
 * @param errorMsg  超时错误消息
 * @returns 原始 Promise 的结果，或超时后抛出错误
 */
function withTimeout<T>(promise: Promise<T>, ms: number, errorMsg: string): Promise<T> {
    let timer: ReturnType<typeof setTimeout>;
    return Promise.race([
        promise,
        new Promise<T>((_, reject) => {
            timer = setTimeout(() => reject(new Error(errorMsg)), ms);
        }),
    ]).finally(() => clearTimeout(timer));
}

@Injectable()
export class CloneService {
    private readonly logger = new Logger(CloneService.name);

    /** 任务级运行锁：同时只执行一个克隆任务 */
    private running = false;

    /** 锁获取时间，用于检测锁是否卡住 */
    private lockAcquiredAt: Date | null = null;

    /** 当前正在执行的任务 ID */
    private currentTaskId: bigint | null = null;

    /** 信号量并发控制 */
    private semaphore = 0;
    private maxConcurrent = 5;
    private waitQueue: Array<{ fn: () => void; cancelled: boolean }> = [];

    /** 当前任务的目标目录，用于路径安全校验 */
    private targetDir: string | null = null;

    constructor(
        private readonly prisma: PrismaService,
        private readonly config: ConfigService,
    ) {}

    /**
     * 获取信号量许可（带超时保护和取消机制）
     *
     * 超时后标记 waiter 为 cancelled，防止 release() 调用已超时的 waiter 导致信号量丢失。
     */
    private acquire(): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            if (this.semaphore < this.maxConcurrent) {
                this.semaphore++;
                resolve();
            } else {
                const waiter = { fn: () => resolve(), cancelled: false };
                this.waitQueue.push(waiter);

                // 超时保护：标记 waiter 已取消，防止 release() 调用时浪费信号量
                setTimeout(() => {
                    if (!waiter.cancelled) {
                        waiter.cancelled = true;
                        reject(new Error('信号量获取超时，可能存在死锁'));
                    }
                }, SEMAPHORE_TIMEOUT_MS);
            }
        });
    }

    /**
     * 释放信号量许可，并唤醒队列中下一个有效 waiter
     *
     * 使用循环跳过已超时的 waiter，确保释放的信号量不会被浪费。
     */
    private release() {
        this.semaphore = Math.max(0, this.semaphore - 1);
        this.drainWaitQueue();
    }

    /**
     * 从等待队列中取出下一个未取消的 waiter 并唤醒
     *
     * 跳过所有已超时的 waiter，直到找到有效 waiter 或队列为空。
     */
    private drainWaitQueue() {
        while (this.waitQueue.length > 0) {
            const waiter = this.waitQueue.shift()!;
            if (!waiter.cancelled) {
                this.semaphore++;
                queueMicrotask(waiter.fn);
                return;
            }
            // 已取消的 waiter 直接跳过，继续取下一个
        }
    }

    /**
     * 重置信号量状态（任务开始时调用）
     */
    private resetSemaphore(concurrency: number) {
        // 先取消所有现有 waiter，防止其超时回调干扰新任务的信号量
        for (const waiter of this.waitQueue) {
            waiter.cancelled = true;
        }
        if (this.waitQueue.length > 0) {
            this.logger.warn(`重置信号量: 丢弃 ${this.waitQueue.length} 个等待中的请求`);
        }
        this.waitQueue = [];
        this.semaphore = 0;
        this.maxConcurrent = concurrency;
    }

    /**
     * 创建克隆任务
     *
     * 校验仓库 ID 列表，批量创建任务明细，返回任务 ID。
     * 任务状态为 PENDING，由定时调度器 pick up 执行。
     *
     * @callers CloneController.createTask()
     * @depends PrismaService.githubRepo / cloneTask / cloneTaskItem
     */
    async createTask(dto: CreateCloneTaskDto): Promise<{ success: boolean; taskId?: number; message?: string }> {
        const { repoIds, targetDir, concurrency, shallow } = dto;

        // 路径校验：必须是绝对路径
        if (!path.isAbsolute(targetDir)) {
            return { success: false, message: '目标目录必须是绝对路径（如 D:\\repos\\stars 或 /home/user/repos）' };
        }

        // 规范化路径（去除尾部分隔符，统一斜杠方向）
        const normalizedTargetDir = path.normalize(targetDir).replace(/[\/\\]$/, '');

        // 查询仓库信息
        const repos = await this.prisma.githubRepo.findMany({
            where: { id: { in: repoIds.map((id) => BigInt(id)) } },
            select: { id: true, fullName: true, htmlUrl: true },
        });

        if (repos.length === 0) {
            return { success: false, message: '未找到指定仓库' };
        }

        // 创建主任务
        const task = await this.prisma.cloneTask.create({
            data: {
                status: 'PENDING',
                targetDir: normalizedTargetDir,
                concurrency,
                shallow,
                totalItems: repos.length,
                createdAt: new Date(),
            },
        });

        // 创建任务明细（Token 仅在运行时注入，不存入数据库）
        const items = repos.map((repo) => {
            const fullName = repo.fullName || '';
            const slashIdx = fullName.indexOf('/');
            const owner = slashIdx > 0 ? fullName.substring(0, slashIdx) : '';
            const repoName = slashIdx > 0 && slashIdx < fullName.length - 1
                ? fullName.substring(slashIdx + 1) : '';

            // 路径安全：校验仓库名格式，防止路径遍历
            const safeOwner = owner || 'unknown';
            const safeRepoName = repoName || 'unknown';
            // 使用 path.join 而非 path.resolve，避免基于工作目录解析
            const localPath = path.join(normalizedTargetDir, safeOwner, safeRepoName);
            if (!localPath.startsWith(normalizedTargetDir + path.sep) && localPath !== normalizedTargetDir) {
                this.logger.warn(`路径安全校验失败，跳过仓库: ${fullName} -> ${localPath}`);
                return null;
            }

            return {
                taskId: task.id,
                repoId: repo.id,
                fullName,
                cloneUrl: `https://github.com/${safeOwner}/${safeRepoName}.git`,
                localPath,
                status: 'PENDING' as const,
                retryCount: 0,
                createdAt: new Date(),
            };
        });

        // 过滤掉路径安全校验失败的仓库
        const validItems = items.filter((i): i is NonNullable<typeof i> => i !== null);
        if (validItems.length === 0) {
            await this.prisma.cloneTask.delete({ where: { id: task.id } });
            return { success: false, message: '所有仓库的路径校验均失败' };
        }

        // 若有被过滤的仓库，更新总数
        if (validItems.length < repos.length) {
            await this.prisma.cloneTask.update({
                where: { id: task.id },
                data: { totalItems: validItems.length },
            });
        }

        await this.prisma.cloneTaskItem.createMany({ data: validItems });

        this.logger.log(`克隆任务已创建: taskId=${Number(task.id)} repos=${validItems.length} target=${normalizedTargetDir}`);
        return { success: true, taskId: Number(task.id), message: `已创建克隆任务，共 ${validItems.length} 个仓库` };
    }

    /**
     * 获取常用克隆目录列表
     *
     * 从历史任务中提取已使用过的目录，去重后返回。
     *
     * @callers CloneController.getRecentDirectories()
     * @depends PrismaService.cloneTask
     */
    async getRecentDirectories() {
        const tasks = await this.prisma.cloneTask.findMany({
            select: { targetDir: true },
            orderBy: { createdAt: 'desc' },
            take: 50,
        });

        // 去重并保持顺序
        const uniqueDirs = [...new Set(tasks.map((t) => t.targetDir))];

        return {
            success: true,
            directories: uniqueDirs.slice(0, 10),
        };
    }

    /**
     * 查找下一个待执行的 PENDING 任务
     */
    async findNextPendingTask() {
        return this.prisma.cloneTask.findFirst({
            where: { status: 'PENDING' },
            orderBy: { createdAt: 'asc' },
            select: { id: true, concurrency: true },
        });
    }

    /**
     * 检查是否有任务正在执行
     */
    isRunning(): boolean {
        return this.running;
    }

    /**
     * 获取锁持有时间（毫秒）
     * 如果锁未被持有，返回 -1
     */
    getLockAge(): number {
        if (!this.running || !this.lockAcquiredAt) return -1;
        return Date.now() - this.lockAcquiredAt.getTime();
    }

    /**
     * 获取当前正在执行的任务 ID
     */
    getCurrentTaskId(): bigint | null {
        return this.currentTaskId;
    }

    /**
     * 强制释放锁（仅用于假死恢复）
     */
    forceReleaseLock() {
        this.running = false;
        this.lockAcquiredAt = null;
        this.currentTaskId = null;
        this.logger.warn('锁已被强制释放');
    }

    /**
     * 执行克隆任务（带任务级超时保护）
     *
     * 更新状态为 PROCESSING → 并发执行所有 PENDING 子项 → 判断终态。
     * 整体任务受 TASK_TIMEOUT_MS 约束，超时后强制标记为 FAILED，
     * 并确保 running 锁释放，防止调度器永久阻塞。
     */
    async executeTask(taskId: bigint) {
        if (this.running) return;

        this.running = true;
        this.lockAcquiredAt = new Date();
        this.currentTaskId = taskId;
        try {
            await withTimeout(
                this.executeTaskInner(taskId),
                TASK_TIMEOUT_MS,
                `任务整体超时: taskId=${Number(taskId)}`,
            );
        } catch (e: unknown) {
            this.logger.error(`克隆任务执行异常: taskId=${Number(taskId)}`, e);
            try {
                await this.prisma.cloneTask.update({
                    where: { id: taskId },
                    data: { status: 'FAILED', finishedAt: new Date() },
                });
            } catch (updateErr) {
                this.logger.error('更新任务失败状态时出错', updateErr);
            }
        } finally {
            this.running = false;
            this.lockAcquiredAt = null;
            this.currentTaskId = null;
            this.logger.log(`克隆任务执行结束，running 锁已释放: taskId=${Number(taskId)}`);
        }
    }

    /**
     * 任务执行内部逻辑
     */
    private async executeTaskInner(taskId: bigint) {
        const task = await this.prisma.cloneTask.findUnique({ where: { id: taskId } });
        if (!task) return;

        this.targetDir = task.targetDir;

        await this.prisma.cloneTask.update({
            where: { id: taskId },
            data: { status: 'PROCESSING', startedAt: new Date() },
        });

        this.resetSemaphore(task.concurrency);

        const items = await this.prisma.cloneTaskItem.findMany({
            where: { taskId, status: 'PENDING' },
        });

        this.logger.log(`克隆任务开始执行: taskId=${Number(taskId)} pendingItems=${items.length} concurrency=${task.concurrency}`);

        // 并发执行所有 item
        await Promise.all(items.map((item) => this.processItem(item, task.shallow ?? true)));

        await this.finishTask(taskId);
    }

    /**
     * 处理单个克隆子项（带超时保护）
     *
     * 整个子项处理流程（含数据库操作）受 ITEM_TIMEOUT_MS 约束，
     * 超时后标记为 FAILED 并释放信号量，防止任务假死。
     */
    /** 克隆子项的关键字段接口 */
    private async processItem(item: { id: bigint; fullName: string | null; localPath: string | null; cloneUrl: string | null }, shallow: boolean) {
        await this.acquire();
        try {
            await withTimeout(
                this.processItemInner(item, shallow),
                ITEM_TIMEOUT_MS,
                `子项处理超时: ${item.fullName}`,
            );
        } catch (e: unknown) {
            // 超时或其他未捕获异常，记录为失败
            const errorMsg = e instanceof Error ? e.message : String(e);
            this.logger.error(`子项处理异常: ${item.fullName}`, e);
            try {
                await this.recordItemResult(item, false, errorMsg || '未知错误');
            } catch (recordErr) {
                this.logger.error('记录子项失败状态时出错', recordErr);
            }
        } finally {
            this.release();
        }
    }

    /**
     * 子项处理内部逻辑
     */
    private async processItemInner(item: { id: bigint; fullName: string | null; localPath: string | null; cloneUrl: string | null }, shallow: boolean) {
        await this.prisma.cloneTaskItem.update({
            where: { id: item.id },
            data: { status: 'PROCESSING' },
        });

        const result = await this.executeClone(item, shallow);
        await this.recordItemResult(item, result.success, result.error);
    }

    /**
     * 校验路径是否在目标目录内，防止路径遍历攻击
     *
     * @param targetPath 待校验的路径
     * @returns 路径是否安全
     */
    private isPathWithinTargetDir(targetPath: string): boolean {
        if (!this.targetDir) return true;
        const resolved = path.resolve(targetPath);
        const target = path.resolve(this.targetDir);
        return resolved.startsWith(target + path.sep) || resolved === target;
    }

    /**
     * 执行实际的 git clone 或 git pull 操作
     *
     * 逻辑（不允许跳过）：
     * 1. cloneUrl 为空 → 删除目录并报错
     * 2. 目录不存在 → git clone
     * 3. 目录已存在且验证通过 → git pull 更新
     * 4. 目录已存在但验证失败 → 删除并重新 git clone
     *
     * Token 在此处动态注入 cloneUrl，数据库中只存储不含凭据的原始 URL。
     */
    private async executeClone(item: { id: bigint; fullName: string | null; localPath: string | null; cloneUrl: string | null }, shallow: boolean): Promise<{ success: boolean; error?: string }> {
        const localPath = item.localPath as string;

        // 路径安全校验
        if (!this.isPathWithinTargetDir(localPath)) {
            return { success: false, error: `路径安全校验失败: ${localPath} 不在目标目录内` };
        }

        // cloneUrl 为空：删除目录并报错（无地址无法克隆或更新）
        if (!item.cloneUrl) {
            if (existsSync(localPath)) {
                await this.removeCloneDir(localPath);
                this.logger.warn(`cloneUrl 为空，已删除目录: ${localPath}`);
            }
            return { success: false, error: 'cloneUrl 为空，无法克隆或更新仓库' };
        }

        try {
            // 检查目录是否已存在
            if (existsSync(localPath)) {
                const validation = await this.validateExistingRepo(localPath, item.cloneUrl);
                if (validation.success) {
                    // 验证通过：执行 git pull 更新
                    this.logger.log(`目录已存在且验证通过，执行 git pull 更新: ${item.fullName}`);
                    return await this.executeGitPull(localPath, item.fullName);
                }
                // 验证失败：删除损坏的目录，继续重新克隆
                this.logger.warn(`仓库验证失败，删除并重新克隆: ${item.fullName} | ${validation.error}`);
                await this.removeCloneDir(localPath);
            }

            // 确保父目录存在（异步操作，不阻塞事件循环）
            const parentDir = path.dirname(localPath);
            await mkdir(parentDir, { recursive: true });

            // 运行时注入 Token（不修改数据库中的 cloneUrl）
            let cloneUrl = item.cloneUrl;
            const githubToken = await this.config.getValue('github.token');
            if (githubToken) {
                cloneUrl = cloneUrl.replace(
                    'https://github.com/',
                    `https://x-access-token:${githubToken}@github.com/`,
                );
            }

            // 构建 git clone 命令
            // -c core.longpaths=true 解决 Windows 长路径限制（文件名超过 260 字符）
            // -c core.protectNTFS=false 允许文件名包含特殊字符（如中文书名号《》）
            const args = ['-c', 'core.longpaths=true', '-c', 'core.protectNTFS=false', 'clone'];
            if (shallow) args.push('--depth', '1');
            args.push(cloneUrl, localPath);

            try {
                await execFileAsync('git', args, {
                    timeout: CLONE_TIMEOUT_MS,
                    windowsHide: true,
                });
                return { success: true };
            } catch (cloneErr: unknown) {
                const cloneErrorMsg = cloneErr instanceof Error ? (cloneErr as Error & { stderr?: string }).stderr || cloneErr.message : String(cloneErr);
                
                // 检查是否是 checkout 失败（克隆成功但 checkout 失败）
                // 这种情况通常是因为文件名包含 Windows 不支持的字符（如 ?）
                if (cloneErrorMsg.includes('warning: Clone succeeded, but checkout failed')) {
                    this.logger.warn(`克隆成功但 checkout 失败（可能是文件名包含特殊字符）: ${item.fullName}`);
                    // 仓库数据已下载，标记为成功
                    return { success: true };
                }
                
                // 其他克隆错误，继续抛出
                throw cloneErr;
            }
        } catch (e: unknown) {
            const errorMsg = e instanceof Error ? (e as Error & { stderr?: string }).stderr || e.message : String(e);

            // 清理失败的克隆目录
            try {
                if (existsSync(localPath)) {
                    await rm(localPath, { recursive: true, force: true });
                }
            } catch {
                // 忽略清理失败
            }

            // 自动重试：特定 Git 内部错误通常是瞬时性的（浅克隆竞态、refs 残留等）
            // 删除目录后重新克隆一次即可恢复
            if (RETRYABLE_CLONE_ERROR_PATTERNS.some((pattern) => errorMsg.includes(pattern))) {
                this.logger.warn(`检测到可重试错误，自动重试克隆: ${item.fullName} | 错误: ${errorMsg.substring(0, 200)}`);
                try {
                    const retryArgs = ['-c', 'core.longpaths=true', '-c', 'core.protectNTFS=false', 'clone'];
                    if (shallow) retryArgs.push('--depth', '1');
                    retryArgs.push(item.cloneUrl!, localPath);

                    await execFileAsync('git', retryArgs, {
                        timeout: CLONE_TIMEOUT_MS,
                        windowsHide: true,
                    });
                    return { success: true };
                } catch (retryErr: unknown) {
                    const retryErrorMsg = retryErr instanceof Error ? (retryErr as Error & { stderr?: string }).stderr || retryErr.message : String(retryErr);
                    // 重试也失败了，清理目录并返回错误
                    try {
                        if (existsSync(localPath)) {
                            await rm(localPath, { recursive: true, force: true });
                        }
                    } catch {
                        // 忽略清理失败
                    }
                    return { success: false, error: `重试后仍失败: ${retryErrorMsg.substring(0, 1900)}` };
                }
            }

            return { success: false, error: errorMsg.substring(0, 2000) };
        }
    }

    /**
     * 执行 git pull 更新已存在的仓库
     *
     * 先获取当前分支名，再显式指定 `git pull --ff-only origin <branch>`，
     * 避免 "fatal: Cannot fast-forward to multiple branches" 错误。
     * 同时添加 --no-edit 防止因合并提交消息弹出编辑器。
     *
     * @param localPath 本地仓库路径
     * @param fullName  仓库全名（用于日志）
     * @returns 操作结果
     *
     * @callers executeClone()
     * @depends git CLI
     */
    private async executeGitPull(localPath: string, fullName: string | null): Promise<{ success: boolean; error?: string }> {
        try {
            // 先获取当前分支名
            const { stdout: branchName } = await execFileAsync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
                cwd: localPath,
                timeout: 10_000,
                windowsHide: true,
            });
            const branch = branchName.trim();

            // detached HEAD 场景（如 shallow clone 后处于 tag/commit）
            // 使用 git fetch + merge 而非 pull
            if (branch === 'HEAD') {
                this.logger.log(`仓库处于 detached HEAD 状态，执行 fetch + merge: ${fullName}`);
                await execFileAsync('git', ['fetch', 'origin'], {
                    cwd: localPath,
                    timeout: CLONE_TIMEOUT_MS,
                    windowsHide: true,
                });
                // 尝试合并到默认分支（main/master）
                const defaultBranch = await this.detectDefaultBranch(localPath);
                if (defaultBranch) {
                    await execFileAsync('git', ['merge', '--ff-only', `origin/${defaultBranch}`], {
                        cwd: localPath,
                        timeout: CLONE_TIMEOUT_MS,
                        windowsHide: true,
                    });
                }
                return { success: true };
            }

            // 正常分支：显式指定远程和分支名
            const { stdout } = await execFileAsync('git', ['pull', '--ff-only', '--no-edit', 'origin', branch], {
                cwd: localPath,
                timeout: CLONE_TIMEOUT_MS,
                windowsHide: true,
            });
            this.logger.log(`git pull 成功: ${fullName} | ${stdout.trim()}`);
            return { success: true };
        } catch (e: unknown) {
            const errorMsg = e instanceof Error ? (e as Error & { stderr?: string }).stderr || e.message : String(e);
            this.logger.error(`git pull 失败: ${fullName}`, e);
            return { success: false, error: `git pull 失败: ${errorMsg.substring(0, 1900)}` };
        }
    }

    /**
     * 检测仓库的默认远程分支名（main / master / 其他）
     *
     * 通过 `git symbolic-ref refs/remotes/origin/HEAD` 获取，
     * 失败时 fallback 到检查 main 和 master 是否存在。
     */
    private async detectDefaultBranch(localPath: string): Promise<string | null> {
        try {
            const { stdout } = await execFileAsync('git', ['symbolic-ref', 'refs/remotes/origin/HEAD'], {
                cwd: localPath,
                timeout: 5_000,
                windowsHide: true,
            });
            // 输出格式: refs/remotes/origin/main → 提取 main
            const match = stdout.trim().match(/refs\/remotes\/origin\/(.+)/);
            return match ? match[1] : null;
        } catch {
            // fallback：检查 main 或 master
            for (const candidate of ['main', 'master']) {
                try {
                    await execFileAsync('git', ['rev-parse', `refs/remotes/origin/${candidate}`], {
                        cwd: localPath,
                        timeout: 5_000,
                        windowsHide: true,
                    });
                    return candidate;
                } catch {
                    // 继续尝试下一个
                }
            }
            return null;
        }
    }

    /**
     * 验证已存在的目录是否为有效的克隆仓库
     *
     * 检查项：
     * 1. 是否为 git 仓库（.git 目录存在）
     * 2. 仓库内部结构是否完整（git rev-parse --git-dir 验证）
     * 3. 目录是否非空
     * 4. remote origin URL 是否匹配预期仓库
     *
     * 第 2 项解决了"目录存在但 .git 损坏"的场景（如之前克隆中断留下的残骸），
     * 避免验证通过后走到 git pull 路径却报 "not a git repository" 错误。
     */
    private async validateExistingRepo(localPath: string, expectedCloneUrl: string): Promise<{ success: boolean; error?: string }> {
        const gitDir = path.join(localPath, '.git');

        // 检查是否为 git 仓库
        if (!existsSync(gitDir)) {
            return { success: false, error: `目录存在但不是 git 仓库: ${localPath}` };
        }

        // 仓库完整性校验：通过 git rev-parse 确认 .git 结构可用
        // 解决了 .git 目录存在但内部损坏（缺少 HEAD、refs 不完整等）导致 git pull 报错的问题
        try {
            await execFileAsync('git', ['rev-parse', '--git-dir'], {
                cwd: localPath,
                timeout: 10_000,
                windowsHide: true,
            });
        } catch {
            return { success: false, error: `git 仓库结构损坏（rev-parse 失败）: ${localPath}` };
        }

        // 检查目录是否非空（排除只有 .git 而无工作区文件的异常情况）
        try {
            const entries = readdirSync(localPath);
            const nonGitEntries = entries.filter((e) => e !== '.git');
            if (nonGitEntries.length === 0) {
                return { success: false, error: `git 仓库工作区为空: ${localPath}` };
            }
        } catch {
            return { success: false, error: `无法读取目录内容: ${localPath}` };
        }

        // 检查 remote origin URL 是否匹配
        try {
            const configPath = path.join(gitDir, 'config');
            if (existsSync(configPath)) {
                const config = readFileSync(configPath, 'utf-8');
                // 从 git config 中提取 remote "origin" 的 url
                const urlMatch = config.match(/\[remote\s+"origin"\][^[]*url\s*=\s*(.+)/);
                if (urlMatch) {
                    const remoteUrl = urlMatch[1].trim();
                    // 规范化比较：去掉 token 和 .git 后缀差异
                    const normalizeUrl = (u: string) => u.replace(/https:\/\/[^@]+@/, 'https://').replace(/\.git$/, '');
                    if (normalizeUrl(remoteUrl) !== normalizeUrl(expectedCloneUrl || '')) {
                        return { success: false, error: `remote URL 不匹配: 期望 ${expectedCloneUrl}, 实际 ${remoteUrl}` };
                    }
                }
            }
        } catch {
            // config 读取失败不阻塞，仍视为有效
        }

        // 所有校验通过
        return { success: true };
    }

    /**
     * 记录子项结果
     *
     * 不再更新父任务计数器，getTaskProgress 会根据子项状态实时计算。
     */
    private async recordItemResult(item: { id: bigint; fullName: string | null }, success: boolean, error?: string) {
        const status = success ? 'COMPLETED' : 'FAILED';

        await this.prisma.cloneTaskItem.update({
            where: { id: item.id },
            data: {
                status,
                errorMessage: success ? null : error,
                updatedAt: new Date(),
            },
        });
    }

    /**
     * 完成任务并设置终态
     *
     * 根据子项的实际状态判断任务终态，避免依赖计数器。
     */
    private async finishTask(taskId: bigint) {
        // 查询子项状态统计
        const items = await this.prisma.cloneTaskItem.findMany({
            where: { taskId },
            select: { status: true },
        });

        const completedCount = items.filter((i) => i.status === 'COMPLETED').length;
        const failedCount = items.filter((i) => i.status === 'FAILED').length;

        let status: string;
        if (failedCount === 0) {
            status = 'COMPLETED';
        } else if (completedCount === 0) {
            status = 'FAILED';
        } else {
            status = 'PARTIAL';
        }

        await this.prisma.cloneTask.update({
            where: { id: taskId },
            data: { status, finishedAt: new Date() },
        });

        this.logger.log(`克隆任务完成: taskId=${Number(taskId)} status=${status} completed=${completedCount} failed=${failedCount}`);

        // 清理历史任务（隔离异常，不影响主流程）
        try {
            await this.cleanOldTasks();
        } catch (e) {
            this.logger.error('清理历史任务失败', e);
        }
    }

    /**
     * 查询任务进度
     *
     * 根据子项的实际状态实时计算各项数量，避免计数器不一致问题。
     */
    async getTaskProgress(taskId: number) {
        const task = await this.prisma.cloneTask.findUnique({
            where: { id: BigInt(taskId) },
            include: {
                items: {
                    select: {
                        fullName: true,
                        status: true,
                        localPath: true,
                        errorMessage: true,
                    },
                },
            },
        });

        if (!task) return { success: false, message: '任务不存在' };

        // 根据子项实际状态实时计算数量
        const completedItems = task.items.filter((i) => i.status === 'COMPLETED').length;
        const failedItems = task.items.filter((i) => i.status === 'FAILED').length;
        const total = task.items.length;
        const processed = completedItems + failedItems;

        // 根据子项状态实时计算任务状态
        let status = task.status;
        if (task.status !== 'PROCESSING' && task.status !== 'PENDING') {
            if (failedItems === 0) {
                status = 'COMPLETED';
            } else if (completedItems === 0) {
                status = 'FAILED';
            } else {
                status = 'PARTIAL';
            }
        }

        const failedDetails = task.items
            .filter((i) => i.status === 'FAILED')
            .map((i) => ({ fullName: i.fullName, error: i.errorMessage }));

        return {
            success: true,
            taskId: Number(task.id),
            status,
            targetDir: task.targetDir,
            concurrency: task.concurrency,
            totalItems: total,
            completedItems,
            failedItems,
            skippedItems: 0,
            progress: total > 0 ? Math.round((processed * 100) / total) : 0,
            createdAt: task.createdAt?.toISOString(),
            startedAt: task.startedAt?.toISOString(),
            finishedAt: task.finishedAt?.toISOString(),
            failedDetails,
            skippedDetails: [],
            allItems: task.items,
        };
    }

    /**
     * 重试失败项
     *
     * 将所有 FAILED 状态的子项重置为 PENDING，重新执行。
     * 重试前会删除原目录。
     */
    async retryFailed(taskId: number) {
        const items = await this.prisma.cloneTaskItem.findMany({
            where: {
                taskId: BigInt(taskId),
                status: 'FAILED',
            },
        });

        if (!items.length) return { success: false, message: '没有需要重试的项' };

        // 先执行数据库事务（原子操作），确保状态一致性
        await this.prisma.$transaction([
            // 重置子项状态为 PENDING
            this.prisma.cloneTaskItem.updateMany({
                where: {
                    taskId: BigInt(taskId),
                    status: 'FAILED',
                },
                data: { status: 'PENDING', errorMessage: null, retryCount: { increment: 1 } },
            }),
            // 重置任务状态为 PENDING（让调度器重新 pick up）
            this.prisma.cloneTask.update({
                where: { id: BigInt(taskId) },
                data: {
                    status: 'PENDING',
                    startedAt: null,
                    finishedAt: null,
                },
            }),
        ]);

        // 事务成功后再删除目录（文件系统操作无法回滚，失败仅记录日志）
        for (const item of items) {
            await this.removeCloneDir(item.localPath);
        }

        this.logger.log(`克隆任务重试: taskId=${taskId} failed=${items.length}`);
        return { success: true, taskId, message: `已重置 ${items.length} 项失败项` };
    }

    /**
     * 重置整个克隆任务
     *
     * 将任务及其所有子项重置为 PENDING 状态，允许重新执行。
     * 适用于任务失败、卡在运行中或需要重新执行的场景。
     *
     * 安全策略：
     * - 允许重置任何状态的任务（包括 PROCESSING）
     * - 如果当前有任务在执行中（running=true），会强制释放锁
     * - 仅删除失败项的目录，保留成功克隆的目录
     * - 重置后调度器会重新 pick up 该任务
     *
     * @param taskId 任务 ID
     * @returns 操作结果
     *
     * @callers CloneController.resetTask()
     * @depends PrismaService.cloneTask / cloneTaskItem
     */
    async resetTask(taskId: number) {
        const task = await this.prisma.cloneTask.findUnique({
            where: { id: BigInt(taskId) },
            select: { id: true, status: true, targetDir: true },
        });

        if (!task) {
            return { success: false, message: '任务不存在' };
        }

        // 如果当前有任务在执行中，强制释放锁
        // 这是为了防止任务卡在 PROCESSING 状态无法恢复
        if (this.running) {
            this.logger.warn(`重置任务时检测到有任务正在执行，强制释放锁: currentTaskId=${this.currentTaskId}, targetTaskId=${taskId}`);
            this.forceReleaseLock();
        }

        // 设置目标目录，用于路径安全校验
        this.targetDir = task.targetDir;

        // 查询失败项的目录路径（用于后续删除）
        const failedItems = await this.prisma.cloneTaskItem.findMany({
            where: {
                taskId: BigInt(taskId),
                status: 'FAILED',
            },
            select: { id: true, localPath: true, fullName: true },
        });

        // 执行事务：重置任务和所有子项状态
        await this.prisma.$transaction([
            // 重置所有子项状态为 PENDING
            this.prisma.cloneTaskItem.updateMany({
                where: { taskId: BigInt(taskId) },
                data: { status: 'PENDING', errorMessage: null, retryCount: 0 },
            }),
            // 重置任务状态为 PENDING
            this.prisma.cloneTask.update({
                where: { id: BigInt(taskId) },
                data: {
                    status: 'PENDING',
                    startedAt: null,
                    finishedAt: null,
                    completedItems: 0,
                    failedItems: 0,
                    skippedItems: 0,
                },
            }),
        ]);

        // 事务成功后删除失败项的目录（文件系统操作无法回滚，失败仅记录日志）
        for (const item of failedItems) {
            await this.removeCloneDir(item.localPath);
        }

        this.logger.log(`克隆任务已重置: taskId=${taskId} previousStatus=${task.status} deletedDirs=${failedItems.length}`);
        return { success: true, taskId, message: `任务已重置，已清理 ${failedItems.length} 个失败目录` };
    }

    /**
     * 重试单个克隆项
     *
     * @param taskId 任务 ID
     * @param fullName 仓库全名（如 owner/repo）
     * 重试前会删除原目录（不论是否存在）
     */
    async retryItem(taskId: number, fullName: string) {
        if (this.running) {
            return { success: false, message: '当前有任务正在执行，请稍后再试' };
        }

        const item = await this.prisma.cloneTaskItem.findFirst({
            where: { taskId: BigInt(taskId), fullName },
        });

        if (!item) return { success: false, message: '未找到该任务项' };

        if (item.status === 'PROCESSING') {
            return { success: false, message: '任务正在执行中，无法重试' };
        }

        // 先执行数据库事务（原子操作），确保状态一致性
        // 在事务内检查状态，避免 TOCTOU 竞态条件
        try {
            await this.prisma.$transaction(async (tx) => {
                const updated = await tx.cloneTaskItem.updateMany({
                    where: { id: item.id, status: { notIn: ['PROCESSING', 'PENDING'] } },
                    data: { status: 'PENDING', errorMessage: null, retryCount: { increment: 1 } },
                });
                if (updated.count === 0) {
                    throw new Error('任务项正在执行中或已是待执行状态，无法重试');
                }
                await tx.cloneTask.update({
                    where: { id: BigInt(taskId) },
                    data: { status: 'PENDING', startedAt: null, finishedAt: null },
                });
            });
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            return { success: false, message: msg };
        }

        // 事务成功后再删除目录（文件系统操作无法回滚，失败仅记录日志）
        await this.removeCloneDir(item.localPath);

        this.logger.log(`克隆项重试: taskId=${taskId} fullName=${fullName}`);
        return { success: true, message: `已重置 ${fullName}，等待重新执行` };
    }

    /**
     * 删除克隆目录（安全操作，忽略不存在的情况）
     */
    private async removeCloneDir(localPath: string | null) {
        if (!localPath) return;

        // 安全校验：只允许删除目标目录内的路径
        if (this.targetDir && !this.isPathWithinTargetDir(localPath)) {
            this.logger.warn(`拒绝删除目标目录外的路径: ${localPath}`);
            return;
        }

        try {
            if (existsSync(localPath)) {
                await rm(localPath, { recursive: true, force: true });
                this.logger.log(`已删除克隆目录: ${localPath}`);
            }
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            this.logger.warn(`删除克隆目录失败: ${localPath} | ${msg}`);
        }
    }

    /**
     * 获取最近任务列表
     *
     * 根据子项的实际状态实时计算各项数量。
     */
    async getRecentTasks() {
        const tasks = await this.prisma.cloneTask.findMany({
            orderBy: { createdAt: 'desc' },
            take: 20,
            include: {
                items: {
                    select: { status: true },
                },
            },
        });

        return {
            success: true,
            tasks: tasks.map((t) => {
                const completedItems = t.items.filter((i) => i.status === 'COMPLETED').length;
                const failedItems = t.items.filter((i) => i.status === 'FAILED').length;
                const total = t.items.length;

                // 根据子项状态实时计算任务状态
                let status = t.status;
                if (t.status !== 'PROCESSING' && t.status !== 'PENDING') {
                    if (failedItems === 0) {
                        status = 'COMPLETED';
                    } else if (completedItems === 0) {
                        status = 'FAILED';
                    } else {
                        status = 'PARTIAL';
                    }
                }

                return {
                    taskId: Number(t.id),
                    status,
                    targetDir: t.targetDir,
                    concurrency: t.concurrency,
                    totalItems: total,
                    completedItems,
                    failedItems,
                    skippedItems: 0,
                    createdAt: t.createdAt?.toISOString(),
                    startedAt: t.startedAt?.toISOString(),
                    finishedAt: t.finishedAt?.toISOString(),
                };
            }),
        };
    }

    /**
     * 删除指定克隆任务
     *
     * 删除任务及其所有子项记录。不允许删除正在执行的任务。
     *
     * @param taskId 任务 ID
     * @returns 操作结果
     *
     * @callers CloneController.deleteTask()
     * @depends PrismaService.cloneTask / cloneTaskItem
     */
    async deleteTask(taskId: number) {
        const task = await this.prisma.cloneTask.findUnique({
            where: { id: BigInt(taskId) },
            select: { id: true, status: true },
        });

        if (!task) {
            return { success: false, message: '任务不存在' };
        }

        // 不允许删除正在执行的任务
        if (task.status === 'PROCESSING' && this.running && this.currentTaskId === BigInt(taskId)) {
            return { success: false, message: '任务正在执行中，无法删除' };
        }

        // 删除子项和任务记录
        await this.prisma.cloneTaskItem.deleteMany({ where: { taskId: BigInt(taskId) } });
        await this.prisma.cloneTask.delete({ where: { id: BigInt(taskId) } });

        this.logger.log(`克隆任务已删除: taskId=${taskId}`);
        return { success: true, taskId, message: '任务已删除' };
    }

    /**
     * 清理历史任务（保留最近 N 条）
     */
    private async cleanOldTasks() {
        const old = await this.prisma.cloneTask.findMany({
            where: { status: { in: ['COMPLETED', 'FAILED', 'PARTIAL'] } },
            orderBy: { createdAt: 'desc' },
            skip: MAX_HISTORY_TASKS,
            take: 1000,
            select: { id: true },
        });

        if (old.length > 0) {
            this.logger.log(`清理 ${old.length} 条历史克隆任务`);
        }

        for (const t of old) {
            await this.prisma.cloneTaskItem.deleteMany({ where: { taskId: t.id } });
            await this.prisma.cloneTask.delete({ where: { id: t.id } });
        }
    }
}
