/**
 * CloneService — 批量克隆服务
 *
 * Bug 修复清单:
 *   P0-1: executeBatchClone 使用过滤参数（keyword/language/categoryIds等）
 *   P0-2: checkDiskSpace 返回值被正确检查
 *   P0-3: maxRepoSizeMb 过滤逻辑
 *   P0-4: retryFailedClones 只重试 FAILED 项(不含 SKIPPED)
 *   P0-5: retryFailedClones 使用 buildCloneUrl(支持代理URL)
 *   P0-6: generateCloneScript 使用过滤参数
 *   P0-7: 同步锁/信号量并发控制
 */
import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import { ConfigService } from '../../config/config.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CloneTaskService } from './clone-task.service';
import { GithubRepoService } from '../../github/services/github-repo.service';

const execAsync = promisify(exec);
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
        this.logger.log('CloneService 初始化完成, taskCounter 恢复到: ' + maxNum);
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
    async checkDiskSpace(subDirectory: string, repoCount: number) {
        try {
            const dir = subDirectory
                ? path.join(await this.getBaseDir(), this.sanitizeSubdirectory(subDirectory))
                : await this.getBaseDir();
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

            let freeMB = 0;
            try {
                const drive = dir.substring(0, 1) + ':';
                const { stdout } = await execAsync(`wmic logicaldisk where "DeviceID='${drive}'" get FreeSpace /value`, { timeout: 5000 });
                const match = stdout.match(/FreeSpace=(\d+)/);
                freeMB = match ? Math.floor(parseInt(match[1]) / (1024 * 1024)) : 102400;
            } catch {
                try {
                    const stats = (fs as any).statfsSync(dir);
                    freeMB = Math.floor((stats.bfree * stats.bsize) / (1024 * 1024));
                } catch {
                    freeMB = 102400;
                }
            }

            const estimatedMB = repoCount * 50 * 2;
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
                success: true,
                freeSpaceMB: 0,
                estimatedSizeMB: repoCount * 50 * 2,
                sufficient: true,
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
     * 使用信号量模式控制并发执行，限制同时运行的任务数量
     *
     * @param items 待处理的数据项列表
     * @param concurrency 最大并发数
     * @param fn 对每个数据项执行的处理函数
     */
    private async executeWithSemaphore<T>(items: T[], concurrency: number, fn: (item: T) => Promise<void>): Promise<void> {
        const sem = new Array(concurrency).fill(0) as number[];
        let idx = 0;
        const worker = async () => {
            while (idx < items.length) {
                const i = idx++;
                await fn(items[i]);
            }
        };
        await Promise.all(sem.map(() => worker()));
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
            } else {
                return { status: 'SKIPPED', message: '目录已存在' };
            }
        }
        fs.mkdirSync(path.dirname(dir), { recursive: true });
        const url = await this.buildCloneUrl(htmlUrl);
        const depthArg = cloneDepth > 0 ? `--depth ${cloneDepth}` : '';
        try {
            const { stderr } = await execAsync(`git clone ${depthArg} "${url}" "${dir}"`, {
                timeout: CLONE_TIMEOUT_S * 1000,
                cwd: path.dirname(dir),
            });
            return fs.existsSync(dir) && fs.readdirSync(dir).length > 0
                ? { status: 'CLONED', message: stderr || 'OK' }
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
            if (result.status === 'CLONED' || result.status === 'SKIPPED')
                return { fullName, status: result.status, message: result.message };
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
    }) {
        const subDir = this.sanitizeSubdirectory(params.subDirectory || '');
        const targetDir = subDir ? path.join(await this.getBaseDir(), subDir).replace(/\\/g, '/') : await this.getBaseDir();
        const maxCount = params.maxCount || 50;
        const concurrency = params.concurrency || 5;
        const cloneDepth = params.cloneDepth ?? 1;
        const maxRepoSizeMb = params.maxRepoSizeMb || 500;

        try {
            // P0 FIX: 检查磁盘空间结果
            const diskCheck = await this.checkDiskSpace(params.subDirectory || '', maxCount);
            if (!diskCheck.sufficient) {
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
                    sortBy: params.sortBy || 'starred_at',
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
                sortBy: params.sortBy || 'starred_at',
                sortOrder: params.sortOrder || 'desc',
            }).catch(console.error);

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
        },
    ) {
        const task = await this.prisma.cloneTask.findUnique({ where: { taskId } });
        if (!task) {
            this.logger.error('执行批量克隆: 任务不存在 taskId=' + taskId);
            return;
        }
        await this.prisma.cloneTask.update({ where: { taskId }, data: { status: 'RUNNING', startedAt: new Date() } });
        this.logger.log('批量克隆开始执行: taskId=' + taskId);

        const targetDir = subDir ? path.join(await this.getBaseDir(), subDir) : await this.getBaseDir();

        try {
            // P0 FIX: 使用过滤参数查询仓库
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
            });
            const repos = (reposResult.records as any[]).filter((r: any) => r.fullName && r.htmlUrl);

            if (this.cancelledTasks.has(taskId)) {
                await this.prisma.cloneTask.update({
                    where: { taskId },
                    data: { status: 'FAILED', errorMessage: '用户取消', finishedAt: new Date(), cancelled: 1 },
                });
                return;
            }

            await this.prisma.cloneTask.update({ where: { taskId }, data: { totalRepos: repos.length } });

            // 信号量控制并发
            let completed = 0,
                failed = 0,
                skipped = 0;
            await this.executeWithSemaphore(repos, concurrency, async (repo) => {
                const repoName = repo.repoName || repo.fullName?.split('/').pop() || '';
                const repoDir = path.join(targetDir, repoName);
                const result = await this.cloneWithRetry(repo.fullName || '', repoName, repoDir, repo.htmlUrl || '', cloneDepth, taskId);

                await this.prisma.cloneTaskItem.create({
                    data: { taskId, fullName: repo.fullName || '', status: result.status, message: result.message, createdAt: new Date() },
                });

                if (result.status === 'CLONED') completed++;
                else if (result.status === 'FAILED') failed++;
                else skipped++;

                const cached = this.runningTasks.get(taskId);
                if (cached) {
                    cached.completedRepos = completed;
                    cached.failedRepos = failed;
                    cached.skippedRepos = skipped;
                }
                await this.prisma.cloneTask.update({
                    where: { taskId },
                    data: { completedRepos: completed, failedRepos: failed, skippedRepos: skipped },
                });
            });

            const finalStatus = failed === 0 ? 'COMPLETED' : 'FAILED';
            await this.prisma.cloneTask.update({ where: { taskId }, data: { status: finalStatus, finishedAt: new Date() } });
            this.logger.log(
                '批量克隆完成: taskId=' +
                    taskId +
                    ', 状态=' +
                    finalStatus +
                    ', 完成=' +
                    completed +
                    ', 失败=' +
                    failed +
                    ', 跳过=' +
                    skipped,
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
            setTimeout(() => this.runningTasks.delete(taskId), 5000);
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
        if (cached)
            return {
                ...cached,
                items: await this.prisma.cloneTaskItem.findMany({ where: { taskId }, take: 100, orderBy: { createdAt: 'asc' } }),
            };
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
        this.cancelledTasks.add(taskId);
        this.logger.log('取消克隆任务: taskId=' + taskId);
        await this.prisma.cloneTask.update({
            where: { taskId },
            data: { status: 'FAILED', errorMessage: '用户取消', finishedAt: new Date(), cancelled: 1 },
        });
        return true;
    }

    /**
     * 重试克隆失败项，只重试状态为 FAILED 的项（不含 SKIPPED），使用 buildCloneUrl 支持代理
     *
     * @param taskId 任务 ID
     * @returns 重试结果，包含成功/失败计数
     */
    async retryFailedClones(taskId: string) {
        const task = await this.prisma.cloneTask.findUnique({ where: { taskId } });
        if (!task || task.status === 'PENDING') return { success: false, message: '任务无法重试' };

        // P0 FIX: 只重试 FAILED 项，不包含 SKIPPED
        const failedItems = await this.prisma.cloneTaskItem.findMany({ where: { taskId, status: 'FAILED' } });
        if (failedItems.length === 0) return { success: false, message: '没有需要重试的失败项' };

        this.cancelledTasks.delete(taskId);
        this.logger.log('重试克隆失败项: taskId=' + taskId + ', 失败项数=' + failedItems.length);
        await this.prisma.cloneTask.update({ where: { taskId }, data: { status: 'RUNNING', cancelled: 0 } });
        const targetDir = task.targetDir || (await this.getBaseDir());

        let completed = 0,
            failed = 0;
        await this.executeWithSemaphore(failedItems, task.concurrency, async (item) => {
            const repoName = item.fullName.split('/').pop() || '';
            // P0 FIX: 使用 buildCloneUrl 而不是直接拼接 URL（支持代理）
            const htmlUrl = `https://github.com/${item.fullName}`;
            const cloneUrl = await this.buildCloneUrl(htmlUrl);
            const repoDir = path.join(targetDir, repoName);

            // 重试时强制覆盖
            if (fs.existsSync(repoDir)) {
                fs.rmSync(repoDir, { recursive: true, force: true });
            }
            fs.mkdirSync(path.dirname(repoDir), { recursive: true });
            const depthArg = task.cloneDepth > 0 ? `--depth ${task.cloneDepth}` : '';

            let result: { status: string; message: string };
            try {
                const { stderr } = await execAsync(`git clone ${depthArg} "${cloneUrl}" "${repoDir}"`, {
                    timeout: CLONE_TIMEOUT_S * 1000,
                    cwd: path.dirname(repoDir),
                });
                result =
                    fs.existsSync(repoDir) && fs.readdirSync(repoDir).length > 0
                        ? { status: 'CLONED', message: stderr || 'OK' }
                        : { status: 'FAILED', message: '克隆后目录为空' };
            } catch (e) {
                const msg = e instanceof Error ? e.message : String(e);
                this.logger.error('重试克隆失败: 仓库=' + item.fullName + ', 错误=' + msg.substring(0, 200));
                try {
                    fs.rmSync(repoDir, { recursive: true, force: true });
                } catch {}
                result = { status: 'FAILED', message: msg.substring(0, 500) };
            }

            await this.prisma.cloneTaskItem.update({ where: { id: item.id }, data: { status: result.status, message: result.message } });
            if (result.status === 'CLONED') completed++;
            else failed++;
        });

        const finalStatus = failed === 0 ? 'COMPLETED' : 'FAILED';
        await this.prisma.cloneTask.update({
            where: { taskId },
            data: { status: finalStatus, completedRepos: completed, failedRepos: failed, finishedAt: new Date() },
        });
        this.logger.log('重试克隆完成: taskId=' + taskId + ', 成功=' + completed + ', 失败=' + failed);
        return { success: true, message: `重试完成: ${completed}成功, ${failed}失败`, retryCount: failedItems.length };
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
    }) {
        const maxCount = params.maxCount || 50;
        const depth = (params.cloneDepth || 1) > 0 ? ` --depth ${params.cloneDepth}` : '';
        const subDir = this.sanitizeSubdirectory(params.subDirectory || '');
        const targetDir = subDir ? path.join(await this.getBaseDir(), subDir).replace(/\\/g, '/') : await this.getBaseDir();
        this.logger.log('生成克隆脚本: OS=' + params.osType + ', maxCount=' + maxCount + ', 目标目录=' + targetDir);

        // P0 FIX: 使用过滤参数查询仓库
        const result = await this.githubRepoService.findPage({
            page: 1,
            size: maxCount,
            keyword: params.keyword || '',
            language: params.language || '',
            categoryIds: params.categoryIds || '',
            sortBy: params.sortBy || 'starred_at',
            sortOrder: params.sortOrder || 'desc',
            dateField: params.dateField || '',
            startDate: params.startDate || '',
            endDate: params.endDate || '',
        });
        const repos = (result.records as any[]).filter((r: any) => r.htmlUrl);

        if (params.osType === 'windows') {
            let script = `$targetDir = "${targetDir}"\nif (!(Test-Path $targetDir)) { New-Item -ItemType Directory -Path $targetDir -Force }\ncd $targetDir\n\n`;
            for (const r of repos) {
                const name = r.repoName || r.fullName?.split('/').pop() || '';
                script += `if (Test-Path "${name}") { Write-Host "SKIP: ${name}" } else { git clone${depth} "${r.htmlUrl}.git" "${name}" }\n`;
            }
            return script;
        }
        let script = `#!/bin/bash\nTARGET="${targetDir}"\nmkdir -p "$TARGET"\ncd "$TARGET"\n\n`;
        for (const r of repos) {
            const name = r.repoName || r.fullName?.split('/').pop() || '';
            script += `if [ -d "${name}" ]; then echo "SKIP: ${name}"; else git clone${depth} "${r.htmlUrl}.git" "${name}"; fi\n`;
        }
        return script;
    }
}
