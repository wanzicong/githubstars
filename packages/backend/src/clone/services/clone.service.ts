/**
 * CloneService — 批量克隆服务
 */
import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { ConfigService } from '../../config/config.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CloneTaskService } from './clone-task.service';
import { GithubRepoService } from '../../github/services/github-repo.service';

const MAX_RETRIES = 3;
const RETRY_BACKOFF = [5, 15, 45];
const CLONE_TIMEOUT_S = 600;
const MAX_HISTORY = 20;
const NON_RETRYABLE = ['repository not found', 'not found', 'authentication failed', 'access denied', 'permission denied'];

@Injectable()
export class CloneService implements OnModuleInit {
    private taskCounter = 0;
    private runningTasks = new Map<string, any>();
    private cancelledTasks = new Set<string>();
    private readonly logger = new Logger(CloneService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly configService: ConfigService,
        private readonly cloneTaskService: CloneTaskService,
        private readonly githubRepoService: GithubRepoService,
    ) {}

    /**
     * 模块初始化时从数据库恢复 taskCounter，确保重启后任务编号连续
     */
    async onModuleInit() {
        const maxNum = await this.cloneTaskService.getMaxTaskCounterNumber();
        this.taskCounter = maxNum;
        // 清理重启前遗留的僵尸任务（状态为 RUNNING/PENDING 但进程已不存在）
        const zombieTasks = await this.prisma.cloneTask.findMany({
            where: { status: { in: ['RUNNING', 'PENDING'] } },
            select: { taskId: true },
        });
        for (const t of zombieTasks) {
            await this.prisma.cloneTask.update({
                where: { taskId: t.taskId },
                data: { status: 'FAILED', errorMessage: '服务重启，任务中断', finishedAt: new Date() },
            });
            this.logger.warn('清理僵尸克隆任务: taskId=' + t.taskId);
        }
        this.logger.log('CloneService 初始化完成, taskCounter 恢复到: ' + maxNum + ', 清理僵尸任务: ' + zombieTasks.length);
    }

    /**
     * 清理指定任务的内存缓存（cancelledTasks Set + runningTasks Map）
     *
     * @param taskId 任务 ID
     */
    removeTaskFromCache(taskId: string): void {
        this.cancelledTasks.delete(taskId);
        this.runningTasks.delete(taskId);
    }

    /**
     * 获取克隆根目录路径，优先使用系统配置中的 clone.directory
     *
     * @returns 克隆根目录路径
     */
    private async getBaseDir(): Promise<string> {
        return this.configService.getValueDefault('clone.directory', 'D:/github-stars');
    }

    /**
     * 路径规范化与安全检查，防止路径遍历攻击和无效路径
     *
     * @param subDir 用户输入的子目录
     * @returns 规范化后的子目录路径
     * @throws 路径包含盘符、无效路径段或非法字符时抛出异常
     */
    sanitizeSubdirectory(subDir: string): string {
        const dir = (subDir || '')
            .trim()
            .replace(/\\/g, '/')
            .replace(/^\/+|\/+$/g, '');
        if (dir.includes(':')) throw new Error('路径不能包含盘符');
        for (const seg of dir.split('/')) {
            if (seg === '' || seg === '.' || seg === '..') throw new Error(`无效路径段: ${seg}`);
            if (/[<>:"|?*\x00-\x1f]/.test(seg)) throw new Error(`非法字符: ${seg}`);
            const reserved = [
                'CON',
                'PRN',
                'AUX',
                'NUL',
                'COM1',
                'COM2',
                'COM3',
                'COM4',
                'COM5',
                'COM6',
                'COM7',
                'COM8',
                'COM9',
                'LPT1',
                'LPT2',
                'LPT3',
                'LPT4',
                'LPT5',
                'LPT6',
                'LPT7',
                'LPT8',
                'LPT9',
            ];
            if (reserved.includes(seg.toUpperCase())) throw new Error(`保留名: ${seg}`);
        }
        return dir;
    }

    /**
     * 真实磁盘空间检查，估算克隆所需空间并与可用空间对比
     *
     * @param subDirectory 子目录路径
     * @param repoCount 预计克隆的仓库数量
     * @returns 磁盘空间检查结果，包含可用空间、估算所需空间、是否充足等信息
     */
    async checkDiskSpace(subDirectory: string, repoCount: number, cloneDepth = 1, maxRepoSizeMb = 500) {
        try {
            const dir = subDirectory
                ? path.join(await this.getBaseDir(), this.sanitizeSubdirectory(subDirectory))
                : await this.getBaseDir();
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

            let freeMB = 0;
            try {
                // 优先使用 statfsSync（Node 18.15+ 支持 Windows）
                const stats = (fs as any).statfsSync(dir);
                freeMB = Math.floor((stats.bfree * stats.bsize) / (1024 * 1024));
            } catch {
                // 兜底：Windows 下使用 PowerShell 获取磁盘空间
                try {
                    const drive = dir.substring(0, 2); // e.g. "D:"
                    const result = await this.spawnCommand('powershell', ['-Command', `(Get-PSDrive ${drive[0]}).Free`], 5000);
                    const bytes = parseInt(result.trim());
                    freeMB = isNaN(bytes) ? 102400 : Math.floor(bytes / (1024 * 1024));
                } catch {
                    freeMB = 102400;
                }
            }

            // 智能估算：浅克隆 ~10MB/仓库，完整克隆使用 maxRepoSizeMb，1.5x 安全系数
            const perRepoMB = cloneDepth === 1 ? 10 : Math.min(maxRepoSizeMb, 50);
            const estimatedMB = repoCount * perRepoMB * 1.5;
            return {
                success: true,
                freeSpaceMB: freeMB,
                estimatedSizeMB: Math.round(estimatedMB),
                requiredSizeMB: Math.round(estimatedMB),
                sufficient: freeMB >= estimatedMB,
                message:
                    freeMB >= estimatedMB
                        ? `磁盘空间充足 (${freeMB}MB >= ${Math.round(estimatedMB)}MB)`
                        : `磁盘空间不足 (${freeMB}MB < ${Math.round(estimatedMB)}MB)，请清理后重试`,
            };
        } catch (e) {
            this.logger.error('磁盘检查失败: ' + (e instanceof Error ? e.message : String(e)));
            return {
                success: false,
                freeSpaceMB: 0,
                estimatedSizeMB: repoCount * 10 * 1.5,
                requiredSizeMB: 0,
                sufficient: false,
                message: '磁盘检查失败: ' + (e instanceof Error ? e.message : String(e)),
            };
        }
    }

    /**
     * 构建克隆 URL，支持通过代理加速访问 GitHub
     *
     * @param htmlUrl GitHub 仓库的 HTML 地址（如 https://github.com/user/repo）
     * @returns 完整的克隆地址，优先使用配置中的代理 URL
     */
    async buildCloneUrl(htmlUrl: string): Promise<string> {
        const proxyUrl = await this.configService.getValueDefault('clone.proxy.url', '');
        if (proxyUrl) {
            const sep = proxyUrl.endsWith('/') ? '' : '/';
            return `${proxyUrl}${sep}${htmlUrl}`;
        }
        return htmlUrl + '.git';
    }

    /**
     * 使用信号量模式控制并发执行，限制同时运行的任务数量。
     * 单个项目执行失败不会中断其他 worker。
     */
    private async executeWithSemaphore<T>(items: T[], concurrency: number, fn: (item: T) => Promise<void>): Promise<void> {
        let idx = 0;
        const worker = async () => {
            while (idx < items.length) {
                const i = idx++;
                try {
                    await fn(items[i]);
                } catch (e) {
                    this.logger.error('executeWithSemaphore 项目执行异常: ' + (e instanceof Error ? e.message : String(e)));
                }
            }
        };
        await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
    }

    /**
     * 封装 spawn 执行命令，返回 Promise<string>
     */
    private spawnCommand(cmd: string, args: string[], timeoutMs = CLONE_TIMEOUT_S * 1000): Promise<string> {
        return new Promise((resolve, reject) => {
            const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], shell: false });
            let stdout = '';
            let stderr = '';
            const timer = setTimeout(() => {
                child.kill('SIGTERM');
                reject(new Error(`命令超时 (${timeoutMs}ms)`));
            }, timeoutMs);
            child.stdout?.on('data', (d) => (stdout += d.toString()));
            child.stderr?.on('data', (d) => (stderr += d.toString()));
            child.on('close', (code) => {
                clearTimeout(timer);
                if (code === 0) resolve(stdout || stderr);
                else reject(new Error(stderr || stdout || `退出码 ${code}`));
            });
            child.on('error', (e) => {
                clearTimeout(timer);
                reject(e);
            });
        });
    }

    /**
     * 使用 spawn 执行 git clone（避免命令注入）
     */
    private async spawnGitClone(url: string, dir: string, cloneDepth: number): Promise<{ stderr: string }> {
        const args = ['clone'];
        if (cloneDepth > 0) args.push('--depth', String(cloneDepth));
        args.push(url, dir);
        const output = await this.spawnCommand('git', args);
        return { stderr: output };
    }

    /**
     * 在已有 git 仓库目录中执行 git pull（避免命令注入）
     */
    private async spawnGitPull(dir: string): Promise<{ stderr: string }> {
        const output = await this.spawnCommand('git', ['-C', dir, 'pull'], 300000);
        return { stderr: output };
    }

    /**
     * 检查目录是否为有效的 git 仓库（存在 .git 目录）并目录非空
     */
    private isValidGitRepo(dir: string): boolean {
        if (!fs.existsSync(dir)) return false;
        try {
            if (fs.readdirSync(dir).length === 0) return false;
        } catch {
            return false;
        }
        return fs.existsSync(path.join(dir, '.git'));
    }

    /**
     * 执行单次 git clone 操作，包含目录存在性检查、强制重试目录清理
     *
     * @param fullName 仓库完整名称（如 user/repo）
     * @param repoName 仓库名
     * @param dir 目标目录路径
     * @param htmlUrl GitHub HTML 地址
     * @param forceRetry 是否强制清理已存在目录后重试
     * @param cloneDepth 克隆深度（--depth 参数值）
     * @returns 克隆结果，包含状态（CLONED/SKIPPED/FAILED）和消息
     */
    private async doClone(
        fullName: string,
        repoName: string,
        dir: string,
        htmlUrl: string,
        forceRetry: boolean,
        cloneDepth: number,
    ): Promise<{ status: string; message: string }> {
        if (!repoName) return { status: 'FAILED', message: '仓库名为空' };
        if (fs.existsSync(dir)) {
            if (forceRetry) {
                fs.rmSync(dir, { recursive: true, force: true });
                if (fs.existsSync(dir)) return { status: 'FAILED', message: '无法清理目录' };
            } else if (this.isValidGitRepo(dir)) {
                // 已有有效 git 仓库 → git pull 更新
                try {
                    await this.spawnGitPull(dir);
                    return { status: 'CLONED', message: 'git pull 更新成功' };
                } catch (e) {
                    const msg = e instanceof Error ? e.message : String(e);
                    this.logger.warn('git pull 失败，降级为重新 clone: ' + fullName);
                    try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
                }
            } else {
                // 目录存在但不是有效 git 仓库 → 清理后重新克隆
                try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
            }
        }
        fs.mkdirSync(path.dirname(dir), { recursive: true });
        const url = await this.buildCloneUrl(htmlUrl);
        try {
            await this.spawnGitClone(url, dir, cloneDepth);
            return fs.existsSync(dir) && fs.readdirSync(dir).length > 0
                ? { status: 'CLONED', message: 'OK' }
                : { status: 'FAILED', message: '克隆后目录为空' };
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            this.logger.error('git clone 失败: 仓库=' + fullName + ', 错误=' + msg.substring(0, 200));
            try {
                fs.rmSync(dir, { recursive: true, force: true });
            } catch {}
            return { status: 'FAILED', message: msg.substring(0, 500) };
        }
    }

    /**
     * 带重试机制的克隆操作，失败时按退避策略自动重试，最多重试 MAX_RETRIES 次
     *
     * @param fullName 仓库完整名称（如 user/repo）
     * @param repoName 仓库名
     * @param dir 目标目录路径
     * @param htmlUrl GitHub HTML 地址
     * @param cloneDepth 克隆深度
     * @param taskId 任务 ID，用于检查取消状态
     * @returns 克隆结果，包含仓库名、最终状态和消息
     */
    private async cloneWithRetry(
        fullName: string,
        repoName: string,
        dir: string,
        htmlUrl: string,
        cloneDepth: number,
        taskId: string,
    ): Promise<{ fullName: string; status: string; message: string }> {
        let lastResult: { status: string; message: string } = { status: 'FAILED', message: '未执行' };
        for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
            if (this.cancelledTasks.has(taskId)) return { fullName, status: 'FAILED', message: '用户取消' };
            const result = await this.doClone(fullName, repoName, dir, htmlUrl, attempt > 0, cloneDepth);
            lastResult = result;
            if (result.status === 'CLONED')
                return { fullName, status: 'CLONED', message: result.message };
            if (NON_RETRYABLE.some((e) => result.message.toLowerCase().includes(e)))
                return { fullName, status: 'FAILED', message: result.message };
            if (attempt < MAX_RETRIES - 1) await new Promise((r) => setTimeout(r, RETRY_BACKOFF[attempt] * 1000));
            else {
                this.logger.error('克隆重试耗尽: 仓库=' + fullName + ', 错误=' + lastResult.message.substring(0, 200));
                try {
                    fs.rmSync(dir, { recursive: true, force: true });
                } catch {}
            }
        }
        return { fullName, status: 'FAILED', message: `[已重试${MAX_RETRIES}次] ${lastResult.message}` };
    }

    /**
     * 启动批量克隆任务，进行磁盘空间检查后异步执行克隆
     *
     * @param params 批量克隆参数
     * @param params.keyword 搜索关键词
     * @param params.language 编程语言过滤
     * @param params.categoryIds 分类 ID 过滤
     * @param params.maxCount 最大克隆数量
     * @param params.subDirectory 目标子目录
     * @param params.dateField 日期过滤字段
     * @param params.startDate 起始日期
     * @param params.endDate 结束日期
     * @param params.sortBy 排序字段
     * @param params.sortOrder 排序方向
     * @param params.concurrency 并发数
     * @param params.cloneDepth 克隆深度
     * @param params.maxRepoSizeMb 单仓库最大体积（MB）
     * @returns 任务创建结果，包含 taskId 和目标目录
     */
    async startBatchClone(params: {
        keyword?: string;
        language?: string;
        categoryIds?: string;
        maxCount?: number;
        subDirectory?: string;
        dateField?: string;
        startDate?: string;
        endDate?: string;
        sortBy?: string;
        sortOrder?: string;
        concurrency?: number;
        cloneDepth?: number;
        maxRepoSizeMb?: number;
        untranslatedOnly?: boolean;
    }) {
        const subDir = this.sanitizeSubdirectory(params.subDirectory || '');
        const targetDir = subDir ? path.join(await this.getBaseDir(), subDir).replace(/\\/g, '/') : await this.getBaseDir();
        const maxCount = params.maxCount || 50;
        const concurrency = params.concurrency || 5;
        const cloneDepth = params.cloneDepth ?? 1;
        const maxRepoSizeMb = params.maxRepoSizeMb || 500;

        try {
            // 清理超时未启动的僵死 PENDING 任务（>30 秒未转为 RUNNING）
            const staleThreshold = new Date(Date.now() - 30000);
            const stalePendings = await this.prisma.cloneTask.findMany({
                where: { status: 'PENDING', createdAt: { lt: staleThreshold } },
                select: { taskId: true },
            });
            for (const z of stalePendings) {
                await this.prisma.cloneTask.update({
                    where: { taskId: z.taskId },
                    data: { status: 'FAILED', errorMessage: '任务超时未启动，已被新任务覆盖', finishedAt: new Date() },
                });
                this.logger.warn('清理僵尸 PENDING 任务: taskId=' + z.taskId);
            }

            const diskCheck = await this.checkDiskSpace(params.subDirectory || '', maxCount, cloneDepth, maxRepoSizeMb);
            if (!diskCheck.success || !diskCheck.sufficient) {
                return { success: false, message: diskCheck.message };
            }

            const taskId = 'clone_' + ++this.taskCounter;
            this.logger.log('开始批量克隆: taskId=' + taskId + ', maxCount=' + maxCount + ', 目标目录=' + targetDir);

            const task = await this.prisma.cloneTask.create({
                data: {
                    taskId,
                    status: 'PENDING',
                    totalRepos: 0,
                    keyword: params.keyword || null,
                    language: params.language || null,
                    categoryIds: params.categoryIds || null,
                    dateField: params.dateField || null,
                    startDate: params.startDate || null,
                    endDate: params.endDate || null,
                    sortBy: params.sortBy || 'stars_count',
                    sortOrder: params.sortOrder || 'desc',
                    subDirectory: subDir || null,
                    targetDir,
                    concurrency,
                    cloneDepth,
                    maxRepoSizeMb,
                    createdAt: new Date(),
                },
            });

            this.runningTasks.set(taskId, task);

            // P0 FIX: 传递过滤参数到 executeBatchClone
            this.executeBatchClone(taskId, maxCount, concurrency, cloneDepth, maxRepoSizeMb, subDir, {
                keyword: params.keyword || '',
                language: params.language || '',
                categoryIds: params.categoryIds || '',
                dateField: params.dateField || '',
                startDate: params.startDate || '',
                endDate: params.endDate || '',
                sortBy: params.sortBy || 'stars_count',
                sortOrder: params.sortOrder || 'desc',
                untranslatedOnly: params.untranslatedOnly,
            }).catch((e) => this.logger.error('executeBatchClone 异常: ' + (e instanceof Error ? e.message : String(e))));

            return { success: true, taskId, targetDirectory: targetDir };
        } catch (e) {
            this.logger.error('启动批量克隆失败: ' + (e instanceof Error ? e.message : String(e)));
            return { success: false, message: e instanceof Error ? e.message : String(e) };
        }
    }

    /**
     * 异步执行批量克隆的核心方法，查询仓库列表后并发克隆每个仓库
     *
     * @param taskId 任务 ID
     * @param maxCount 最大克隆数量
     * @param concurrency 并发数
     * @param cloneDepth 克隆深度
     * @param maxRepoSizeMb 单仓库最大体积（MB）
     * @param subDir 目标子目录
     * @param filterParams 仓库筛选参数
     */
    private async executeBatchClone(
        taskId: string,
        maxCount: number,
        concurrency: number,
        cloneDepth: number,
        maxRepoSizeMb: number,
        subDir: string,
        filterParams: {
            keyword: string;
            language: string;
            categoryIds: string;
            dateField: string;
            startDate: string;
            endDate: string;
            sortBy: string;
            sortOrder: string;
            untranslatedOnly?: boolean;
        },
    ) {
        const task = await this.prisma.cloneTask.findUnique({ where: { taskId } });
        if (!task) {
            this.logger.error('执行批量克隆: 任务不存在 taskId=' + taskId);
            return;
        }
        await this.prisma.cloneTask.update({ where: { taskId }, data: { status: 'RUNNING', startedAt: new Date() } });
        this.logger.log('批量克隆开始执行: taskId=' + taskId);

        const targetDir = subDir ? path.join(await this.getBaseDir(), subDir).replace(/\\/g, '/') : await this.getBaseDir();

        try {
            const reposResult = await this.githubRepoService.findPage({
                page: 1,
                size: maxCount,
                keyword: filterParams.keyword,
                language: filterParams.language,
                categoryIds: filterParams.categoryIds,
                sortBy: filterParams.sortBy,
                sortOrder: filterParams.sortOrder,
                dateField: filterParams.dateField,
                startDate: filterParams.startDate,
                endDate: filterParams.endDate,
                untranslatedOnly: filterParams.untranslatedOnly,
            });
            const allRepos = (reposResult.records as any[]).filter((r: any) => r.fullName && r.htmlUrl);

            if (this.cancelledTasks.has(taskId)) {
                await this.prisma.cloneTask.update({
                    where: { taskId },
                    data: { status: 'FAILED', errorMessage: '用户取消', finishedAt: new Date(), cancelled: 1 },
                });
                return;
            }

            // maxRepoSizeMb 过滤：跳过超大仓库
            const repos: any[] = [];
            const oversizedRepos: any[] = [];
            for (const repo of allRepos) {
                const sizeKb = repo.sizeKb || repo.size || 0;
                if (maxRepoSizeMb > 0 && sizeKb > maxRepoSizeMb * 1024) {
                    oversizedRepos.push(repo);
                } else {
                    repos.push(repo);
                }
            }

            await this.prisma.cloneTask.update({
                where: { taskId },
                data: { totalRepos: allRepos.length, completedRepos: 0, failedRepos: oversizedRepos.length, skippedRepos: 0 },
            });

            // 批量创建所有仓库的记录：PENDING（待克隆），超大仓库直接 FAILED
            if (repos.length > 0) {
                await this.prisma.cloneTaskItem.createMany({
                    data: repos.map((r) => ({
                        taskId,
                        fullName: r.fullName || '',
                        status: 'PENDING',
                        message: '',
                        createdAt: new Date(),
                    })),
                });
            }
            if (oversizedRepos.length > 0) {
                await this.prisma.cloneTaskItem.createMany({
                    data: oversizedRepos.map((r) => ({
                        taskId,
                        fullName: r.fullName || '',
                        status: 'FAILED',
                        message: `仓库体积超过限制 (${Math.round((r.sizeKb || r.size || 0) / 1024)}MB > ${maxRepoSizeMb}MB)`,
                        createdAt: new Date(),
                    })),
                });
            }

            // 查询刚创建的 PENDING 记录，建立 fullName → id 映射
            const pendingItems = await this.prisma.cloneTaskItem.findMany({
                where: { taskId, status: 'PENDING' },
                select: { id: true, fullName: true },
            });
            const itemIdByFullName = new Map(pendingItems.map((i) => [i.fullName, i.id]));

            let completed = 0,
                failed = oversizedRepos.length,
                skipped = 0;
            await this.executeWithSemaphore(repos, concurrency, async (repo) => {
                const repoName = repo.repoName || repo.fullName?.split('/').pop() || '';
                const repoDir = path.join(targetDir, repoName);
                const itemId = itemIdByFullName.get(repo.fullName || '');

                if (this.cancelledTasks.has(taskId)) {
                    if (itemId) {
                        try {
                            await this.prisma.cloneTaskItem.update({
                                where: { id: itemId },
                                data: { status: 'FAILED', message: '任务已取消' },
                            });
                            await this.prisma.cloneTask.update({ where: { taskId }, data: { failedRepos: { increment: 1 } } });
                        } catch {}
                    }
                    failed++;
                    return;
                }

                // 标记为 CLONING
                if (itemId) {
                    await this.prisma.cloneTaskItem.update({
                        where: { id: itemId },
                        data: { status: 'CLONING', message: '正在克隆...' },
                    });
                }

                const result = await this.cloneWithRetry(repo.fullName || '', repoName, repoDir, repo.htmlUrl || '', cloneDepth, taskId);

                try {
                    if (itemId) {
                        await this.prisma.cloneTaskItem.update({
                            where: { id: itemId },
                            data: { status: result.status, message: result.message },
                        });
                    } else {
                        await this.prisma.cloneTaskItem.create({
                            data: { taskId, fullName: repo.fullName || '', status: result.status, message: result.message, createdAt: new Date() },
                        });
                    }

                    const incrementField = result.status === 'CLONED' ? 'completedRepos' : 'failedRepos';
                    await this.prisma.cloneTask.update({ where: { taskId }, data: { [incrementField]: { increment: 1 } } });

                    if (result.status === 'CLONED') completed++;
                    else failed++;
                } catch (dbErr) {
                    this.logger.error(
                        '批量克隆 DB 写入异常: repo=' + repo.fullName + ', err=' + (dbErr instanceof Error ? dbErr.message : String(dbErr)),
                    );
                    try {
                        if (itemId) {
                            await this.prisma.cloneTaskItem.update({
                                where: { id: itemId },
                                data: { status: 'FAILED', message: 'DB写入异常: ' + (dbErr instanceof Error ? dbErr.message : String(dbErr)).substring(0, 300) },
                            });
                        }
                        await this.prisma.cloneTask.update({ where: { taskId }, data: { failedRepos: { increment: 1 } } });
                    } catch {}
                    failed++;
                }

                const cached = this.runningTasks.get(taskId);
                if (cached) {
                    cached.completedRepos = completed;
                    cached.failedRepos = failed;
                    cached.skippedRepos = skipped;
                }
            });

            const cancelled = this.cancelledTasks.has(taskId);
            let finalStatus: string;
            if (cancelled) {
                finalStatus = 'FAILED';
            } else if (completed === 0 && failed > 0) {
                finalStatus = 'FAILED';
            } else {
                finalStatus = 'COMPLETED';
            }
            await this.prisma.cloneTask.update({ where: { taskId }, data: { status: finalStatus, finishedAt: new Date() } });
            this.logger.log(
                '批量克隆完成: taskId=' +
                    taskId +
                    ', 完成=' +
                    completed +
                    ', 失败=' +
                    failed +
                    ', 跳过=' +
                    skipped +
                    ', 状态=' +
                    finalStatus,
            );
            await this.saveHistory(subDir);
        } catch (e) {
            const errMsg = e instanceof Error ? e.message : String(e);
            this.logger.error('批量克隆异常: taskId=' + taskId + ', 错误=' + errMsg);
            await this.prisma.cloneTask.update({
                where: { taskId },
                data: { status: 'FAILED', errorMessage: errMsg, finishedAt: new Date() },
            });
        } finally {
            this.cancelledTasks.delete(taskId);
            const cached = this.runningTasks.get(taskId);
            if (cached) {
                const updated = await this.prisma.cloneTask.findUnique({ where: { taskId }, select: { status: true } });
                if (updated) cached.status = updated.status;
            }
            setTimeout(() => this.runningTasks.delete(taskId), 2000);
        }
    }

    /**
     * 获取克隆任务详情（优先从内存缓存读取运行中的任务）
     *
     * @param taskId 任务 ID
     * @returns 任务详情，包含任务项列表
     */
    async getTask(taskId: string) {
        const cached = this.runningTasks.get(taskId);
        if (cached) {
            const [items, dbTask] = await Promise.all([
                this.prisma.cloneTaskItem.findMany({ where: { taskId }, take: 100, orderBy: { createdAt: 'asc' } }),
                this.prisma.cloneTask.findUnique({
                    where: { taskId },
                    select: { completedRepos: true, failedRepos: true, skippedRepos: true, totalRepos: true },
                }),
            ]);
            return {
                ...cached,
                completedRepos: dbTask?.completedRepos ?? cached.completedRepos,
                failedRepos: dbTask?.failedRepos ?? cached.failedRepos,
                skippedRepos: dbTask?.skippedRepos ?? cached.skippedRepos,
                totalRepos: dbTask?.totalRepos ?? cached.totalRepos,
                items,
            };
        }
        return this.prisma.cloneTask.findUnique({ where: { taskId }, include: { items: { take: 100, orderBy: { createdAt: 'asc' } } } });
    }

    /**
     * 取消正在运行或等待中的克隆任务
     *
     * @param taskId 任务 ID
     * @returns 是否取消成功
     */
    async cancelTask(taskId: string) {
        const task = await this.prisma.cloneTask.findUnique({ where: { taskId } });
        if (!task || (task.status !== 'RUNNING' && task.status !== 'PENDING')) return false;
        this.logger.log('取消克隆任务: taskId=' + taskId);
        await this.prisma.cloneTask.update({
            where: { taskId },
            data: { status: 'FAILED', errorMessage: '用户取消', finishedAt: new Date(), cancelled: 1 },
        });
        this.cancelledTasks.add(taskId);
        return true;
    }

    /**
     * 递归清理目标目录下的空文件夹。
     * 失败的克隆操作可能留下空目录，重试前需清理以避免 "目录已存在" 的误判。
     *
     * @param dir 要清理的目录路径
     */
    private cleanupEmptyDirs(dir: string): void {
        if (!fs.existsSync(dir)) return;
        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch {
            return;
        }
        for (const entry of entries) {
            if (entry.isDirectory()) {
                const fullPath = path.join(dir, entry.name);
                this.cleanupEmptyDirs(fullPath);
                // 递归清理子目录后，检查当前目录是否为空
                try {
                    const remaining = fs.readdirSync(fullPath);
                    if (remaining.length === 0) {
                        fs.rmdirSync(fullPath);
                        this.logger.log('清理空目录: ' + fullPath);
                    }
                } catch {
                    // 忽略权限等错误
                }
            }
        }
    }

    /**
     * 重试克隆未成功项（含 FAILED 和 SKIPPED），自动过滤已成功克隆（CLONED）的仓库。
     * 只要成功数量 ≠ 总仓库数量，就可以重试——不限于 FAILED，SKIPPED（如"目录已存在"）也一并重试。
     * 重试前自动清理空目录和残留目录，确保干净的克隆环境。
     *
     * @param taskId 任务 ID
     * @returns 重试结果，包含成功/失败计数
     *
     * @callers
     *   - CloneController.retryTask()  — 单个任务重试
     *   - CloneController.retryAll()   — 批量重试全部未成功项
     *
     * @depends
     *   - CloneTaskItem 表（查询 FAILED + SKIPPED 项、更新状态）
     *   - CloneTask 表（更新状态和计数器）
     *   - cleanupEmptyDirs() — 清理空目录
     *   - spawnGitClone()    — 执行 git clone
     */
    async retryFailedClones(taskId: string, concurrencyOverride?: number) {
        const task = await this.prisma.cloneTask.findUnique({ where: { taskId } });
        if (!task) return { success: false, message: '任务不存在' };
        if (task.status === 'RUNNING') return { success: false, message: '任务正在运行中，无法重试' };

        const retryItems = await this.prisma.cloneTaskItem.findMany({
            where: { taskId, status: { in: ['FAILED', 'PENDING'] } },
        });
        if (retryItems.length === 0) {
            return { success: false, message: '没有需要重试的未成功项' };
        }

        if (task.completedRepos >= task.totalRepos) {
            return { success: false, message: '所有仓库已克隆成功，无需重试' };
        }

        const concurrency = concurrencyOverride && concurrencyOverride > 0 ? Math.min(concurrencyOverride, 200) : Math.min(task.concurrency, 200);

        const wasFailedCount = retryItems.filter((i) => i.status === 'FAILED').length;

        this.cancelledTasks.delete(taskId);

        const targetDir = task.targetDir || (await this.getBaseDir());

        // 重试前清理空目录，但保留有效 git 仓库（后续会 git pull 更新）
        this.cleanupEmptyDirs(targetDir);
        // 删除无 .git 的残留目录（上次克隆失败的残留）
        for (const item of retryItems) {
            const repoName = item.fullName.split('/').pop() || '';
            const repoDir = path.join(targetDir, repoName);
            if (fs.existsSync(repoDir) && !this.isValidGitRepo(repoDir)) {
                try {
                    fs.rmSync(repoDir, { recursive: true, force: true });
                    this.logger.log('重试前清理残留目录: ' + repoDir);
                } catch (e) {
                    this.logger.warn('清理残留目录异常: ' + repoDir + ', ' + (e instanceof Error ? e.message : String(e)));
                }
            }
        }

        this.logger.log(
            '重试克隆未成功项: taskId=' + taskId + ', 需重试=' + retryItems.length + ', 目标目录=' + targetDir,
        );
        await this.prisma.cloneTask.update({
            where: { taskId },
            data: { status: 'RUNNING', cancelled: 0, errorMessage: null },
        });

        // 加入 runningTasks 缓存以支持前端实时进度轮询
        this.runningTasks.set(taskId, {
            ...task,
            status: 'RUNNING',
            completedRepos: task.completedRepos,
            failedRepos: task.failedRepos,
            skippedRepos: task.skippedRepos,
        });

        let completed = 0,
            failed = 0;
        await this.executeWithSemaphore(retryItems, concurrency, async (item) => {
            if (this.cancelledTasks.has(taskId)) return;
            const repoName = item.fullName.split('/').pop() || '';
            const htmlUrl = `https://github.com/${item.fullName}`;
            const cloneUrl = await this.buildCloneUrl(htmlUrl);
            const repoDir = path.join(targetDir, repoName);

            // 标记为 CLONING，前端可实时看到正在重试的仓库
            await this.prisma.cloneTaskItem.update({
                where: { id: item.id },
                data: { status: 'CLONING', message: '正在重试...' },
            });

            let result: { status: string; message: string };

            // 基于磁盘实际情况判断：已有有效 git 仓库 → git pull；否则 → 全新 clone
            if (this.isValidGitRepo(repoDir)) {
                try {
                    await this.spawnGitPull(repoDir);
                    result = { status: 'CLONED', message: 'git pull 更新成功' };
                    this.logger.log('重试 git pull 成功: ' + item.fullName);
                } catch (e) {
                    const msg = e instanceof Error ? e.message : String(e);
                    this.logger.warn('git pull 失败，尝试重新 clone: repo=' + item.fullName + ', err=' + msg.substring(0, 200));
                    try {
                        fs.rmSync(repoDir, { recursive: true, force: true });
                    } catch {}
                    // 降级为全新 clone
                    try {
                        fs.mkdirSync(path.dirname(repoDir), { recursive: true });
                        await this.spawnGitClone(cloneUrl, repoDir, task.cloneDepth);
                        result =
                            fs.existsSync(repoDir) && fs.readdirSync(repoDir).length > 0
                                ? { status: 'CLONED', message: 'OK' }
                                : { status: 'FAILED', message: '克隆后目录为空' };
                    } catch (cloneErr) {
                        const cloneMsg = cloneErr instanceof Error ? cloneErr.message : String(cloneErr);
                        this.logger.error('重试 clone 也失败: 仓库=' + item.fullName + ', 错误=' + cloneMsg.substring(0, 200));
                        try {
                            if (fs.existsSync(repoDir)) fs.rmSync(repoDir, { recursive: true, force: true });
                        } catch {}
                        result = { status: 'FAILED', message: cloneMsg.substring(0, 500) };
                    }
                }
            } else {
                fs.mkdirSync(path.dirname(repoDir), { recursive: true });
                try {
                    await this.spawnGitClone(cloneUrl, repoDir, task.cloneDepth);
                    result =
                        fs.existsSync(repoDir) && fs.readdirSync(repoDir).length > 0
                            ? { status: 'CLONED', message: 'OK' }
                            : { status: 'FAILED', message: '克隆后目录为空' };
                } catch (e) {
                    const msg = e instanceof Error ? e.message : String(e);
                    this.logger.error('重试克隆失败: 仓库=' + item.fullName + ', 错误=' + msg.substring(0, 200));
                    try {
                        if (fs.existsSync(repoDir)) {
                            fs.rmSync(repoDir, { recursive: true, force: true });
                        }
                    } catch {}
                    result = { status: 'FAILED', message: msg.substring(0, 500) };
                }
            }

            await this.prisma.cloneTaskItem.update({
                where: { id: item.id },
                data: { status: result.status, message: result.message },
            });
            if (result.status === 'CLONED') completed++;
            else failed++;

            const cached = this.runningTasks.get(taskId);
            if (cached) {
                cached.completedRepos = (task.completedRepos || 0) + completed;
                cached.failedRepos = (task.failedRepos || 0) + failed - wasFailedCount;
                cached.skippedRepos = 0;
            }
        });

        this.cleanupEmptyDirs(targetDir);

        const actualCounts = await this.prisma.cloneTaskItem.groupBy({
            by: ['status'],
            where: { taskId },
            _count: true,
        });
        let actualCompleted = 0,
            actualFailed = 0,
            actualCloning = 0;
        for (const row of actualCounts) {
            if (row.status === 'CLONED') actualCompleted = row._count;
            else if (row.status === 'FAILED') actualFailed = row._count;
            else if (row.status === 'CLONING') actualCloning = row._count;
        }

        const cancelled = this.cancelledTasks.has(taskId);
        let finalStatus: string;
        if (cancelled) {
            finalStatus = 'FAILED';
        } else if (actualCompleted === 0 && actualFailed > 0 && actualCloning === 0) {
            finalStatus = 'FAILED';
        } else {
            finalStatus = 'COMPLETED';
        }

        await this.prisma.cloneTask.update({
            where: { taskId },
            data: {
                status: finalStatus,
                finishedAt: new Date(),
                errorMessage: cancelled ? '用户取消' : null,
                completedRepos: actualCompleted,
                failedRepos: actualFailed,
                skippedRepos: 0,
            },
        });

        this.cancelledTasks.delete(taskId);
        const cached = this.runningTasks.get(taskId);
        if (cached) {
            const updated = await this.prisma.cloneTask.findUnique({ where: { taskId }, select: { status: true } });
            if (updated) cached.status = updated.status;
        }
        setTimeout(() => this.runningTasks.delete(taskId), 2000);

        this.logger.log(
            '重试克隆完成: taskId=' +
                taskId +
                ', 成功=' +
                completed +
                ', 失败=' +
                failed +
                ', 需重试=' +
                retryItems.length +
                ', 状态=' +
                finalStatus,
        );
        return {
            success: true,
            message: `重试完成: ${completed}成功, ${failed}失败`,
            retryCount: retryItems.length,
        };
    }

    /**
     * 获取克隆配置信息，包含基础目录、子目录历史、活动任务等
     *
     * @returns 克隆配置对象
     */
    async getCloneConfig() {
        const historyStr = await this.configService.getValueDefault('clone.subdirectory.history', '[]');
        let history: string[] = [];
        try {
            history = JSON.parse(historyStr);
        } catch {
            history = [];
        }
        const activeTask = await this.prisma.cloneTask.findFirst({
            where: { status: { in: ['RUNNING', 'PENDING'] } },
            select: { taskId: true },
        });
        return {
            success: true,
            baseDirectory: await this.getBaseDir(),
            subdirectoryHistory: history,
            lastSubdirectory: await this.configService.getValueDefault('clone.subdirectory.last', ''),
            hasActiveTask: !!activeTask,
            defaultCloneDepth: 1,
            defaultMaxRepoSizeMb: 500,
        };
    }

    /**
     * 将子目录路径保存到历史记录，去重后限制最大条数
     *
     * @param subDir 子目录路径
     */
    private async saveHistory(subDir: string) {
        const str = await this.configService.getValueDefault('clone.subdirectory.history', '[]');
        let history: string[] = [];
        try {
            history = JSON.parse(str);
        } catch {}
        if (subDir) {
            history = [subDir, ...history.filter((h) => h !== subDir)].slice(0, MAX_HISTORY);
            await this.configService.update('clone.subdirectory.history', JSON.stringify(history));
            await this.configService.update('clone.subdirectory.last', subDir);
        }
    }

    /**
     * 生成可执行的克隆脚本（Windows PowerShell 或 Linux Bash），使用过滤参数筛选仓库
     *
     * @param params 脚本生成参数
     * @param params.osType 操作系统类型（windows/linux）
     * @param params.keyword 搜索关键词
     * @param params.language 编程语言过滤
     * @param params.categoryIds 分类 ID 过滤
     * @param params.maxCount 最大仓库数量
     * @param params.subDirectory 目标子目录
     * @param params.cloneDepth 克隆深度
     * @param params.dateField 日期过滤字段
     * @param params.startDate 起始日期
     * @param params.endDate 结束日期
     * @param params.sortBy 排序字段
     * @param params.sortOrder 排序方向
     * @returns 克隆脚本内容（字符串）
     */
    async generateCloneScript(params: {
        osType: string;
        keyword?: string;
        language?: string;
        categoryIds?: string;
        maxCount?: number;
        subDirectory?: string;
        cloneDepth?: number;
        dateField?: string;
        startDate?: string;
        endDate?: string;
        sortBy?: string;
        sortOrder?: string;
        untranslatedOnly?: boolean;
    }) {
        const maxCount = params.maxCount || 50;
        const depth = (params.cloneDepth || 1) > 0 ? ` --depth ${params.cloneDepth}` : '';
        const subDir = this.sanitizeSubdirectory(params.subDirectory || '');
        const targetDir = subDir ? path.join(await this.getBaseDir(), subDir).replace(/\\/g, '/') : await this.getBaseDir();
        this.logger.log('生成克隆脚本: OS=' + params.osType + ', maxCount=' + maxCount + ', 目标目录=' + targetDir);

        const result = await this.githubRepoService.findPage({
            page: 1,
            size: maxCount,
            keyword: params.keyword || '',
            language: params.language || '',
            categoryIds: params.categoryIds || '',
            sortBy: params.sortBy || 'stars_count',
            sortOrder: params.sortOrder || 'desc',
            dateField: params.dateField || '',
            startDate: params.startDate || '',
            endDate: params.endDate || '',
            untranslatedOnly: params.untranslatedOnly,
        });
        const repos = (result.records as any[]).filter((r: any) => r.htmlUrl);

        if (params.osType === 'windows') {
            let script = `$targetDir = "${targetDir}"\nif (!(Test-Path $targetDir)) { New-Item -ItemType Directory -Path $targetDir -Force }\nSet-Location $targetDir\n\n`;
            for (const r of repos) {
                const name = (r.repoName || r.fullName?.split('/').pop() || '').replace(/[`$"]/g, '`$&');
                const cloneUrl = (await this.buildCloneUrl(r.htmlUrl)).replace(/[`$"]/g, '`$&');
                script += `if (Test-Path "${name}") { Write-Host "SKIP: ${name}" } else { git clone${depth} "${cloneUrl}" "${name}" }\n`;
            }
            return script;
        }
        let script = `#!/bin/bash\nset -e\nTARGET='${targetDir.replace(/'/g, "'\\''")}'\nmkdir -p "$TARGET" || exit 1\ncd "$TARGET" || exit 1\n\n`;
        for (const r of repos) {
            const name = (r.repoName || r.fullName?.split('/').pop() || '').replace(/'/g, "'\\''");
            const cloneUrl = (await this.buildCloneUrl(r.htmlUrl)).replace(/'/g, "'\\''");
            script += `if [ -d '${name}' ]; then echo "SKIP: ${name}"; else git clone${depth} '${cloneUrl}' '${name}'; fi\n`;
        }
        return script;
    }
}
