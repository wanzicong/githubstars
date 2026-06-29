import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '../config/config.service';
import {
    CLONE_TIMEOUT_MS,
    TASK_TIMEOUT_MS,
    SEMAPHORE_TIMEOUT_MS,
    MAX_HISTORY_TASKS,
    RETRYABLE_CLONE_ERROR_PATTERNS,
    NETWORK_ERROR_PATTERNS,
    MAX_NETWORK_RETRY_ATTEMPTS,
    RETRY_BASE_DELAY_MS,
    RETRY_MAX_DELAY_MS,
    GITHUB_MIRROR_SOURCES,
    type MirrorSourceName,
} from './clone.constants';
import { CreateCloneTaskDto } from './clone.dto';
import { simpleGit, type SimpleGit } from 'simple-git';
import * as path from 'path';
import { randomBytes } from 'crypto';
import * as os from 'os';
import { existsSync, readdirSync, readFileSync, unlinkSync } from 'fs';
import { chmod, mkdir, rm, rename, writeFile } from 'fs/promises';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

/**
 * 跨平台杀死进程树
 *
 * 在 Windows 上使用 taskkill /F /T /PID 杀死进程及其所有子进程，
 * 在 Unix 上使用 process.kill(-pid, 'SIGTERM') 杀死进程组。
 *
 * @param childProcess 子进程对象
 */

/**
 * 为 Promise 添加超时包装
 *
 * @param promise   原始 Promise
 * @param ms        超时时间（毫秒）
 * @param errorMsg  超时错误消息
 * @returns 原始 Promise 的结果，或超时后抛出错误
 */
function withTimeout<T>(promise: Promise<T>, ms: number, errorMsg: string): Promise<T> {
    return Promise.race([promise, new Promise<T>((_, reject) => setTimeout(() => reject(new Error(errorMsg)), ms))]);
}

/**
 * 延迟指定毫秒（用于重试间隔）
 */
function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 计算指数退避延迟时间
 *
 * @param attempt  当前重试次数（从 0 开始）
 * @param baseMs   基础延迟（毫秒）
 * @param maxMs    最大延迟（毫秒）
 * @returns 延迟时间（毫秒），加上随机抖动防止雷鸣效应
 */
function calculateBackoffDelay(attempt: number, baseMs: number = RETRY_BASE_DELAY_MS, maxMs: number = RETRY_MAX_DELAY_MS): number {
    const exponentialDelay = Math.min(baseMs * Math.pow(2, attempt), maxMs);
    // 添加 0-50% 的随机抖动，防止多个任务同时重试
    const randomFraction = randomBytes(4).readUInt32BE(0) / 0xffffffff;
    const jitter = exponentialDelay * randomFraction * 0.5;
    return Math.floor(exponentialDelay + jitter);
}

/**
 * 判断错误是否为网络错误（需要等待后重试）
 */
function isNetworkError(errorMsg: string): boolean {
    return NETWORK_ERROR_PATTERNS.some((pattern) => errorMsg.includes(pattern));
}

/**
 * 获取镜像代理 URL
 *
 * 将 GitHub URL 转换为镜像代理 URL，加速国内访问。
 *
 * @param originalUrl 原始 GitHub URL
 * @param mirrorSource 镜像源名称
 * @returns 转换后的 URL（如果是直连则返回原 URL）
 */
function getMirrorUrl(originalUrl: string, mirrorSource: MirrorSourceName = 'direct'): string {
    if (mirrorSource === 'direct' || !mirrorSource) {
        return originalUrl;
    }

    const source = GITHUB_MIRROR_SOURCES.find((s) => s.name === mirrorSource);
    if (!source || !source.url) {
        return originalUrl;
    }

    // 移除 originalUrl 的 https:// 前缀，兼容所有镜像代理的 URL 格式
    // gh-proxy:  支持 https://gh-proxy.com/https://github.com/... 和 https://gh-proxy.com/github.com/...
    // gitclone:  仅支持 https://gitclone.com/github.com/...（不接受双协议头）
    const strippedUrl = originalUrl.replace(/^https:\/\//i, '');
    return `${source.url}/${strippedUrl}`;
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

    /** 任务代际计数器，每 forceReleaseLock 递增，用于 processItem 判断是否应继续执行 */
    private generation = 0;

    /**
     * 已由 processItem 的超时分支写入过结果的子项 ID 集合
     *
     * 用于解决 withTimeout 不取消内部 Promise 导致的覆盖写入问题：
     * processItem finally 块写入 FAILED 后，processItemInner 在后台完成后又会覆盖为 COMPLETED。
     * processItemInner 在写入前检查此集合，若已存在则跳过写入。
     *
     * 在 resetSemaphore 中清空（新任务开始时）
     */
    private timeoutHandledItems = new Set<string>();

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

    /**
     * 创建配置好的 simple-git 实例
     *
     * @param options.baseDir       git 工作目录
     * @param options.timeoutMs      命令超时（毫秒），默认 CLONE_TIMEOUT_MS
     * @param options.githubToken    GitHub Token（用于 GIT_ASKPASS 认证）
     * @returns { git, cleanup }     git 实例 + 清理函数（删除临时 askpass 脚本）
     */
    private async createGit(options: {
        baseDir?: string;
        timeoutMs?: number;
        githubToken?: string;
    }): Promise<{ git: SimpleGit; cleanup: () => void }> {
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

        return {
            git,
            cleanup: () => {
                if (askpassPath) {
                    this.cleanupAskpassScript(askpassPath);
                }
            },
        };
    }
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
        // 清空上一轮任务的超时标记，避免跨任务误判
        this.timeoutHandledItems.clear();
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
        const { repoIds, targetDir, concurrency, shallow, mirrorSource } = dto;

        // 路径校验：必须是绝对路径
        if (!path.isAbsolute(targetDir)) {
            return { success: false, message: '目标目录必须是绝对路径（如 D:\\repos\\stars 或 /home/user/repos）' };
        }

        // 规范化路径（去除尾部分隔符，统一斜杠方向）
        const normalizedTargetDir = path.normalize(targetDir).replace(/[\\/]$/, '');

        // 安全校验：检查是否尝试写入系统关键目录
        // 统一使用 / 分隔符进行比较，兼容 Windows（path.normalize 会转 \ 为系统分隔符）
        const compareDir = normalizedTargetDir.toLowerCase().replace(/\\/g, '/');
        const SYSTEM_FORBIDDEN_PREFIXES = [
            'c:/windows',
            'c:/program files',
            'c:/program files (x86)',
            '/bin',
            '/boot',
            '/dev',
            '/etc',
            '/lib',
            '/lib64',
            '/proc',
            '/root',
            '/sbin',
            '/sys',
            '/usr',
            '/var',
        ];
        for (const prefix of SYSTEM_FORBIDDEN_PREFIXES) {
            if (compareDir === prefix || compareDir.startsWith(prefix + '/')) {
                return { success: false, message: `目标目录不能为系统关键目录: ${normalizedTargetDir}` };
            }
        }

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
                mirrorSource: mirrorSource || 'direct',
                totalItems: repos.length,
                createdAt: new Date(),
            },
        });

        // 创建任务明细（Token 仅在运行时注入，不存入数据库）
        const items = repos.map((repo) => {
            const fullName = repo.fullName || '';
            const slashIdx = fullName.indexOf('/');
            const owner = slashIdx > 0 ? fullName.substring(0, slashIdx) : '';
            const repoName = slashIdx > 0 && slashIdx < fullName.length - 1 ? fullName.substring(slashIdx + 1) : '';

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
                // 若配置了镜像代理，直接生成代理 URL 存入数据库
                // 这样 git clone 后 remote origin 自动指向代理地址，
                // 后续 git pull / validateExistingRepo 也走代理，不绕原始 GitHub
                cloneUrl:
                    mirrorSource && mirrorSource !== 'direct'
                        ? getMirrorUrl(`https://github.com/${safeOwner}/${safeRepoName}.git`, mirrorSource as MirrorSourceName)
                        : `https://github.com/${safeOwner}/${safeRepoName}.git`,
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

    /**
     * 根据子项状态统计计算任务最终状态
     * 统一 finishTask / getTaskProgress / getRecentTasks 三处的终态判断逻辑
     *
     * 注意：必须同时传入 totalCount，因为存在部分子项仍为 PENDING/PROCESSING
     * 但无 FAILED 的情况（如任务超时中断），此时应返回 PARTIAL 而非 COMPLETED。
     *
     * @param completedCount 已完成子项数
     * @param failedCount    失败子项数
     * @param totalCount     子项总数
     * @returns 任务状态字符串: COMPLETED | FAILED | PARTIAL
     */
    private static computeFinalTaskStatus(completedCount: number, failedCount: number, totalCount: number): string {
        const processedCount = completedCount + failedCount;
        if (processedCount === 0) return 'FAILED';
        if (failedCount === 0 && processedCount === totalCount) return 'COMPLETED';
        return 'PARTIAL';
    }

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
        this.generation++;
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
        if (this.running) {
            this.logger.warn(`executeTask 被跳过，因为 running 锁已被持有: taskId=${Number(taskId)}`);
            return;
        }

        this.running = true;
        this.lockAcquiredAt = new Date();
        this.currentTaskId = taskId;
        try {
            await withTimeout(
                this.executeTaskInner(taskId),
                TASK_TIMEOUT_MS,
                `克隆任务超时 (${TASK_TIMEOUT_MS / 60000}分钟): taskId=${Number(taskId)}`,
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
            // 只有当前任务仍是"自己"时才释放锁，防止 forceReleaseLock + 新任务启动后
            // 旧 executeTask 的 finally 错误地释放新任务的锁（Bug #1）
            if (this.currentTaskId === taskId) {
                this.running = false;
                this.lockAcquiredAt = null;
                this.currentTaskId = null;
                this.logger.log(`克隆任务执行结束，running 锁已释放: taskId=${Number(taskId)}`);
            } else {
                this.logger.warn(`跳过旧任务锁释放: taskId=${Number(taskId)}, currentTaskId=${this.currentTaskId}`);
            }
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

        const mirrorSource = (task.mirrorSource as MirrorSourceName) || 'direct';
        this.logger.log(
            `克隆任务开始执行: taskId=${Number(taskId)} pendingItems=${items.length} ` +
                `concurrency=${task.concurrency} mirrorSource=${mirrorSource}`,
        );

        // 并发执行所有 item（使用 allSettled 而非 all，避免单个 acquire 超时导致
        // 其他正在运行的 item 状态丢失和 finishTask 计数不完整的问题）
        const results = await Promise.allSettled(items.map((item) => this.processItem(item, task.shallow ?? true, mirrorSource)));
        const rejectedCount = results.filter((r) => r.status === 'rejected').length;
        if (rejectedCount > 0) {
            this.logger.warn(`executeTaskInner: ${rejectedCount} 个子项未处理（信号量超时或其他初始化失败）`);
        }

        await this.finishTask(taskId);
    }

    /**
     * 处理单个克隆子项（带超时保护）
     *
     * 整个子项处理流程（含数据库操作）受 ITEM_TIMEOUT_MS 约束，
     * 超时后标记为 FAILED 并释放信号量，防止任务假死。
     */
    /** 克隆子项的关键字段接口 */
    private async processItem(
        item: { id: bigint; fullName: string | null; localPath: string | null; cloneUrl: string | null },
        shallow: boolean,
        mirrorSource: MirrorSourceName = 'direct',
    ) {
        const capturedGen = this.generation;
        await this.acquire();
        let error: string | null = null;
        try {
            await this.processItemInner(item, shallow, mirrorSource, capturedGen);
        } catch (e: unknown) {
            error = e instanceof Error ? e.message : String(e);
            this.logger.error(`子项处理异常: ${item.fullName}`, e);
        } finally {
            if (this.generation === capturedGen) {
                if (error !== null) {
                    // 先标记超时，再写入结果：防止 processItemInner 后台完成后覆盖为 COMPLETED
                    this.timeoutHandledItems.add(String(item.id));
                    try {
                        await this.recordItemResult(item, false, error || '未知错误');
                    } catch (recordErr) {
                        this.logger.error('记录子项失败状态时出错', recordErr);
                    }
                }
                this.release();
            } else {
                this.logger.warn('跳过旧代际信号量释放');
            }
        }
    }

    /**
     * 子项处理内部逻辑
     */
    private async processItemInner(
        item: { id: bigint; fullName: string | null; localPath: string | null; cloneUrl: string | null },
        shallow: boolean,
        mirrorSource: MirrorSourceName = 'direct',
        capturedGen: number,
    ) {
        await this.prisma.cloneTaskItem.update({
            where: { id: item.id },
            data: { status: 'PROCESSING' },
        });

        const result = await this.executeClone(item, shallow, mirrorSource);

        if (this.generation !== capturedGen) {
            this.logger.warn('代际已变更，跳过状态写入: ' + item.fullName);
            return;
        }

        // processItem 可能已因超时写入 FAILED，若再写入会覆盖为 COMPLETED
        if (this.timeoutHandledItems.has(String(item.id))) {
            this.logger.warn(`子项 ${item.fullName} 已被 processItem 处理（超时），跳过 processItemInner 写入`);
            return;
        }

        await this.recordItemResult(item, result.success, result.error);
    }

    /**
     * 校验路径是否在目标目录内，防止路径遍历攻击
     *
     * @param targetPath 待校验的路径
     * @returns 路径是否安全
     */
    private isPathWithinTargetDir(targetPath: string, targetDir?: string): boolean {
        const effectiveTarget = targetDir ?? this.targetDir;
        if (!effectiveTarget) return true;
        const resolved = path.resolve(targetPath);
        const target = path.resolve(effectiveTarget);
        return resolved.startsWith(target + path.sep) || resolved === target;
    }

    /**
     * 执行实际的 git clone 或 git pull 操作
     *
     * 逻辑（不允许跳过）：
     * 1. cloneUrl 为空 → 删除目录并报错
     * 2. 目录不存在 → git clone（带重试）
     * 3. 目录已存在且验证通过 → git pull 更新
     * 4. 目录已存在但验证失败 → 删除并重新 git clone
     *
     * Token 在此处动态注入 cloneUrl，数据库中只存储不含凭据的原始 URL。
     *
     * 重试策略：
     * - Git 内部错误：删除目录后重试 1 次
     * - 网络错误：指数退避重试最多 3 次（5s → 10s → 20s，加随机抖动）
     */

    /**
     * 处理已存在的仓库目录：验证 → 修复 → 删除重克隆
     *
     * 提取自 executeClone，降低主方法的认知复杂度。
     *
     * @returns 操作结果；若目录不存在或已删除则返回 null（调用方继续执行 clone）
     */
    private async handleExistingRepo(
        localPath: string,
        item: { id: bigint; fullName: string | null; cloneUrl: string | null },
        finalUrl: string,
        shallow: boolean,
        githubToken?: string,
    ): Promise<{ success: boolean; error?: string } | null> {
        if (!existsSync(localPath)) return null;

        const validation = await this.validateExistingRepo(localPath, item.cloneUrl!);
        if (validation.success) {
            this.logger.log(`目录已存在且验证通过，执行 git pull 更新: ${item.fullName}`);
            return await this.executeGitPull(localPath, item.fullName, githubToken);
        }

        this.logger.warn(`仓库验证失败，尝试修复: ${item.fullName} | ${validation.error}`);
        const repairResult = await this.tryRepairRepo(localPath, item.cloneUrl!, item.fullName, githubToken);
        if (repairResult.success) {
            this.logger.log(`仓库修复成功，执行 git pull 更新: ${item.fullName}`);
            return await this.executeGitPull(localPath, item.fullName, githubToken);
        }

        this.logger.warn(`仓库修复失败，尝试删除重克隆: ${item.fullName} | ${repairResult.error}`);
        const dirDeleted = await this.removeCloneDir(localPath);
        if (!dirDeleted && existsSync(localPath)) {
            const altPath = this.findAlternateClonePath(localPath);
            this.logger.warn(`原路径无法释放，使用备用路径: ${item.fullName} | ${localPath} → ${altPath}`);
            await this.prisma.cloneTaskItem.update({
                where: { id: item.id },
                data: { localPath: altPath },
            });
            const parentDir = path.dirname(altPath);
            await mkdir(parentDir, { recursive: true });
            return await this.executeGitClone(finalUrl, altPath, shallow, item.fullName, githubToken);
        }

        // 目录已删除，返回 null 让调用方继续 clone
        return null;
    }

    private async executeClone(
        item: { id: bigint; fullName: string | null; localPath: string | null; cloneUrl: string | null },
        shallow: boolean,
        mirrorSource: MirrorSourceName = 'direct',
    ): Promise<{ success: boolean; error?: string }> {
        const localPath = item.localPath as string;

        if (!this.isPathWithinTargetDir(localPath)) {
            return { success: false, error: `路径安全校验失败: ${localPath} 不在目标目录内` };
        }

        const emptyUrlResult = await this.handleEmptyCloneUrl(item.cloneUrl, localPath);
        if (emptyUrlResult) return emptyUrlResult;

        const { finalUrl, githubToken } = await this.prepareCloneUrl(item.cloneUrl!, mirrorSource, item.fullName);

        try {
            const existingResult = await this.handleExistingRepo(localPath, item, finalUrl, shallow, githubToken);
            if (existingResult) return existingResult;

            const parentDir = path.dirname(localPath);
            await mkdir(parentDir, { recursive: true });

            return await this.executeGitClone(finalUrl, localPath, shallow, item.fullName, githubToken);
        } catch (e: unknown) {
            const errorMsg = e instanceof Error ? (e as Error & { stderr?: string }).stderr || e.message : String(e);

            await this.cleanFailedCloneDir(localPath);

            if (!RETRYABLE_CLONE_ERROR_PATTERNS.some((pattern) => errorMsg.includes(pattern))) {
                return { success: false, error: errorMsg.substring(0, 2000) };
            }

            const isNetwork = isNetworkError(errorMsg);
            const maxRetries = isNetwork ? MAX_NETWORK_RETRY_ATTEMPTS : 1;

            this.logger.warn(
                `检测到${isNetwork ? '网络' : 'Git内部'}错误，准备重试: ${item.fullName} | ` +
                    `错误: ${errorMsg.substring(0, 200)} | 最大重试次数: ${maxRetries}`,
            );

            return await this.executeRetryLoop(finalUrl, localPath, shallow, item.fullName, isNetwork, maxRetries, githubToken);
        }
    }

    /**
     * 准备克隆 URL（注入 Token + 应用镜像代理）
     *
     * 运行时注入 GitHub Token（不修改数据库），然后根据是否需要镜像代理转换 URL。
     *
     * @param cloneUrl     原始 clone URL
     * @param mirrorSource 镜像源名称
     * @param fullName     仓库全名（用于日志，需要镜像时打印）
     * @returns 包含最终 URL 和是否使用镜像的标记
     */

    /**
     * 反向解包代理 URL：如果 cloneUrl 已被包装为代理地址且 Token 已配置，
     * 需要还原为直连 URL，否则代理服务器无法识别 GitHub Token。
     *
     * @param cloneUrl 数据库中的 clone URL（可能已被代理包装）
     * @returns 还原后的直连 URL，或原 URL（非代理地址时）
     */
    private stripProxyUrl(cloneUrl: string): string {
        for (const source of GITHUB_MIRROR_SOURCES) {
            if (source.url && cloneUrl.startsWith(source.url + '/')) {
                // 新格式: https://gh-proxy.com/github.com/owner/repo.git → github.com/owner/repo.git
                // 需要补回 https:// 前缀得到完整的直连 URL
                let stripped = cloneUrl.substring(source.url.length + 1);
                if (!stripped.startsWith('https://') && !stripped.startsWith('http://')) {
                    stripped = 'https://' + stripped;
                }
                return stripped;
            }
        }
        return cloneUrl;
    }

    private async prepareCloneUrl(
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
            if (!isAlreadyProxied) {
                finalUrl = getMirrorUrl(cloneUrl, mirrorSource);
            }
        }

        if (shouldUseMirror && fullName) {
            this.logger.log(`使用镜像代理: ${mirrorSource} | ${fullName}`);
        }

        return { finalUrl, shouldUseMirror, githubToken };
    }

    /**
     * 清理失败的克隆目录
     */
    private async cleanFailedCloneDir(localPath: string): Promise<void> {
        try {
            if (existsSync(localPath)) {
                await rm(localPath, { recursive: true, force: true });
            }
        } catch {
            // 忽略清理失败
        }
    }

    /**
     * 处理 cloneUrl 为空的情况：删除可能存在的目录并返回错误
     *
     * @returns 如果 cloneUrl 为空返回错误结果，否则返回 null
     */
    private async handleEmptyCloneUrl(cloneUrl: string | null, localPath: string): Promise<{ success: false; error: string } | null> {
        if (cloneUrl) return null;
        if (existsSync(localPath)) {
            await this.removeCloneDir(localPath);
            this.logger.warn(`cloneUrl 为空，已删除目录: ${localPath}`);
        }
        return { success: false, error: 'cloneUrl 为空，无法克隆或更新仓库' };
    }

    /**
     * 执行单次重试尝试（清理目录 + 创建父目录 + git clone）
     */
    private async executeSingleRetry(
        finalUrl: string,
        localPath: string,
        shallow: boolean,
        fullName: string | null,
        githubToken?: string,
    ): Promise<{ success: boolean; error?: string }> {
        if (existsSync(localPath)) {
            await rm(localPath, { recursive: true, force: true });
        }
        const parentDir = path.dirname(localPath);
        await mkdir(parentDir, { recursive: true });
        return await this.executeGitClone(finalUrl, localPath, shallow, fullName, githubToken);
    }

    /**
     * 带指数退避的重试循环
     *
     * 网络错误等待后重试（指数退避），Git 内部错误立即重试。
     */
    private async executeRetryLoop(
        finalUrl: string,
        localPath: string,
        shallow: boolean,
        fullName: string | null,
        isNetwork: boolean,
        maxRetries: number,
        githubToken?: string,
    ): Promise<{ success: boolean; error?: string }> {
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            if (isNetwork && attempt > 0) {
                const backoffMs = calculateBackoffDelay(attempt);
                this.logger.log(`等待 ${backoffMs}ms 后重试 (${attempt}/${maxRetries}): ${fullName}`);
                await delay(backoffMs);
            }

            try {
                this.logger.log(`开始重试 (${attempt + 1}/${maxRetries}): ${fullName}`);
                const result = await this.executeSingleRetry(finalUrl, localPath, shallow, fullName, githubToken);
                if (result.success) {
                    this.logger.log(`重试成功 (${attempt + 1}/${maxRetries}): ${fullName}`);
                }
                return result;
            } catch (retryErr: unknown) {
                const retryErrorMsg =
                    retryErr instanceof Error ? (retryErr as Error & { stderr?: string }).stderr || retryErr.message : String(retryErr);
                if (attempt === maxRetries - 1) {
                    await this.cleanFailedCloneDir(localPath);
                    return { success: false, error: `重试 ${maxRetries} 次后仍失败: ${retryErrorMsg.substring(0, 1900)}` };
                }
                this.logger.warn(`重试失败 (${attempt + 1}/${maxRetries}): ${fullName} | ` + `错误: ${retryErrorMsg.substring(0, 200)}`);
            }
        }
        return { success: false, error: '重试逻辑异常' };
    }

    /**
     * 执行 git clone 命令
     *
     * 构建克隆参数并执行，处理 checkout 警告。
     *
     * @param authenticatedUrl 已注入 Token 的 clone URL
     * @param localPath        本地目标路径
     * @param shallow          是否浅克隆
     * @param fullName         仓库全名（用于日志）
     * @returns 操作结果
     *
     * @callers executeClone()
     * @depends git CLI
     */
    private async executeGitClone(
        cloneUrl: string,
        localPath: string,
        shallow: boolean,
        fullName: string | null,
        githubToken?: string,
    ): Promise<{ success: boolean; error?: string }> {
        const parentDir = path.dirname(localPath);

        // Windows: 预创建目标目录，避免 git clone --depth 1 时 .git 子目录创建竞态
        // 症状: "fatal: Unable to create '.../.git/shallow.lock': No such file or directory"
        // 原因: git 在 Windows 上可能先尝试创建 .git 内文件，但 .git 目录尚未被文件系统感知
        if (!existsSync(localPath)) {
            await mkdir(localPath, { recursive: true });
        }

        const { git, cleanup } = await this.createGit({
            baseDir: parentDir,
            timeoutMs: CLONE_TIMEOUT_MS,
            githubToken,
        });

        // -c core.longpaths=true 解决 Windows 长路径限制
        // -c core.protectNTFS=false 允许文件名包含特殊字符
        const args = shallow ? ['--depth', '1'] : [];

        try {
            await git.clone(cloneUrl, localPath, args);
            this.logger.log(`git clone 成功: ${fullName}`);
            return { success: true };
        } catch (e: unknown) {
            const errorMsg = e instanceof Error ? e.message : String(e);
            // checkout 警告（Windows 文件名字符问题）视为成功
            if (errorMsg.includes('warning: Clone succeeded, but checkout failed')) {
                this.logger.warn(`克隆成功但 checkout 失败（可能是文件名包含特殊字符）: ${fullName}`);
                return { success: true };
            }
            return { success: false, error: errorMsg.substring(0, 2000) };
        } finally {
            cleanup();
        }
    }

    /**
     * @param fullName  仓库全名（用于日志）
     * @returns 操作结果
     *
     * @callers executeClone()
     * @depends git CLI
     */
    private async executeGitPull(
        localPath: string,
        fullName: string | null,
        githubToken?: string,
    ): Promise<{ success: boolean; error?: string }> {
        const { git, cleanup } = await this.createGit({
            baseDir: localPath,
            timeoutMs: CLONE_TIMEOUT_MS,
            githubToken,
        });

        try {
            // 先获取当前分支名
            const branchName = (await git.revparse(['--abbrev-ref', 'HEAD'])).trim();

            // detached HEAD 场景（如 shallow clone 后处于 tag/commit）
            if (branchName === 'HEAD') {
                this.logger.log(`仓库处于 detached HEAD 状态，执行 fetch + merge: ${fullName}`);
                await git.fetch(['origin']);
                const defaultBranch = await this.detectDefaultBranch(localPath);
                if (defaultBranch) {
                    await git.merge(['--ff-only', `origin/${defaultBranch}`]);
                }
                return { success: true };
            }

            // 正常分支：显式指定远程和分支名
            try {
                await git.pull(['--ff-only', '--no-edit', 'origin', branchName]);
                this.logger.log(`git pull 成功: ${fullName}`);
                return { success: true };
            } catch (pullErr: unknown) {
                const pullErrorMsg = pullErr instanceof Error ? pullErr.message : String(pullErr);
                // 非 fast-forward 错误：本地分支已分歧，强制重置到远程状态后重试
                if (pullErrorMsg.includes('Not possible to fast-forward') || pullErrorMsg.includes('not possible to fast-forward')) {
                    this.logger.warn(`git pull --ff-only 失败（历史分歧），执行 reset --hard 后重试: ${fullName}`);
                    await git.reset(['--hard', `origin/${branchName}`]);
                    await git.pull(['--ff-only', '--no-edit', 'origin', branchName]);
                    this.logger.log(`git pull 成功（reset 后）: ${fullName}`);
                    return { success: true };
                }
                // 其他 pull 错误
                this.logger.error(`git pull 失败: ${fullName}`, pullErr);
                return { success: false, error: `git pull 失败: ${pullErrorMsg.substring(0, 1900)}` };
            }
        } catch (e: unknown) {
            const errorMsg = e instanceof Error ? e.message : String(e);
            this.logger.error(`git pull 失败: ${fullName}`, e);
            return { success: false, error: `git pull 失败: ${errorMsg.substring(0, 1900)}` };
        } finally {
            cleanup();
        }
    }

    /**
     * 检测仓库的默认远程分支名（main / master / 其他）
     *
     * 通过 `git symbolic-ref refs/remotes/origin/HEAD` 获取，
     * 失败时 fallback 到检查 main 和 master 是否存在。
     */
    private async detectDefaultBranch(localPath: string): Promise<string | null> {
        const { git, cleanup } = await this.createGit({
            baseDir: localPath,
            timeoutMs: 10_000,
        });

        try {
            // 通过 git symbolic-ref 获取默认分支
            const stdout = await git.raw(['symbolic-ref', 'refs/remotes/origin/HEAD']);
            const match = /refs\/remotes\/origin\/(.+)/.exec(stdout.trim());
            return match ? match[1] : null;
        } catch {
            // fallback：检查 main 或 master
            for (const candidate of ['main', 'master']) {
                try {
                    await git.raw(['rev-parse', `refs/remotes/origin/${candidate}`]);
                    return candidate;
                } catch {
                    // 继续尝试下一个
                }
            }
            return null;
        } finally {
            cleanup();
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
        const { git, cleanup } = await this.createGit({
            baseDir: localPath,
            timeoutMs: 10_000,
        });

        try {
            await git.revparse(['--git-dir']);
        } catch {
            cleanup();
            return { success: false, error: `git 仓库结构损坏（rev-parse 失败）: ${localPath}` };
        }

        // 检查目录是否非空（排除只有 .git 而无工作区文件的异常情况）
        try {
            const entries = readdirSync(localPath);
            const nonGitEntries = entries.filter((e) => e !== '.git');
            if (nonGitEntries.length === 0) {
                cleanup();
                return { success: false, error: `git 仓库工作区为空: ${localPath}` };
            }
        } catch {
            cleanup();
            return { success: false, error: `无法读取目录内容: ${localPath}` };
        }

        // 检查 remote origin URL 是否匹配
        try {
            const configPath = path.join(gitDir, 'config');
            if (existsSync(configPath)) {
                const config = readFileSync(configPath, 'utf-8');
                const urlMatch = /\[remote\s+"origin"\][^[]*url\s*=\s*(.+)/.exec(config);
                if (urlMatch) {
                    const remoteUrl = urlMatch[1].trim();
                    const normalizeUrl = (u: string) => u.replace(/https:\/\/[^@]+@/, 'https://').replace(/\.git$/, '');
                    if (normalizeUrl(remoteUrl) !== normalizeUrl(expectedCloneUrl || '')) {
                        cleanup();
                        return { success: false, error: `remote URL 不匹配: 期望 ${expectedCloneUrl}, 实际 ${remoteUrl}` };
                    }
                }
            }
        } catch {
            // config 读取失败不阻塞，仍视为有效
        }

        cleanup();
        // 所有校验通过
        return { success: true };
    }

    /**
     * 尝试修复已有仓库，避免直接删除重克隆
     *
     * 验证失败 != 仓库不可用 —— 许多 git 问题可以原地修复：
     * 1. index.lock 残留 → 删除锁文件（git 被强制杀死后的最常见残留）
     * 2. .git 结构损坏/缺失 → git init 重建
     * 3. remote origin URL 不匹配 → 修正为预期 URL
     * 4. git fetch 验证远程可达并更新 refs
     *
     * 修复后的仓库可以正常走 git pull 更新路径，无需删除重克隆，
     * 既避免了 Windows 文件锁导致删不掉的 BUG，
     * 也节省了大仓库重复下载的时间和带宽。
     *
     * @param localPath        本地仓库路径
     * @param expectedCloneUrl 期望的 remote origin URL
     * @param fullName         仓库全名（用于日志）
     * @param githubToken      GitHub Token（用于认证），可选
     * @returns 修复后的验证结果：success=true 可继续 git pull
     */
    private async tryRepairRepo(
        localPath: string,
        expectedCloneUrl: string,
        fullName: string | null,
        githubToken?: string,
    ): Promise<{ success: boolean; error?: string }> {
        const gitDir = path.join(localPath, '.git');

        try {
            // Step 1: 删除 index.lock（git 被强制杀死后最常见的残留锁文件）
            this.repairLockFile(gitDir, fullName);

            // Step 2: 如果 .git 缺失，用 git init 重建
            const initError = await this.repairGitInit(localPath, gitDir, fullName, githubToken);
            if (initError) return { success: false, error: initError };

            // Step 3: 修正 remote origin URL（镜像源/直连切换可能导致 URL 不匹配）
            await this.repairRemoteUrl(localPath, expectedCloneUrl, fullName, githubToken);

            // Step 4: 重新验证仓库完整性
            const revalidation = await this.validateExistingRepo(localPath, expectedCloneUrl);
            if (!revalidation.success) return revalidation;

            // Step 5: 用 git fetch --prune 验证远程可达并更新 refs
            await this.repairFetchOrigin(localPath, fullName, githubToken);

            return { success: true };
        } finally {
            // 子步骤各自管理自己的 askpass 临时文件，此处无需清理
        }
    }

    /**
     * 修复子步骤 1：删除 index.lock 残留锁文件
     */
    private repairLockFile(gitDir: string, fullName: string | null): void {
        const lockFile = path.join(gitDir, 'index.lock');
        if (!existsSync(lockFile)) return;
        try {
            unlinkSync(lockFile);
            this.logger.log(`修复: 已删除残留锁文件 index.lock | ${fullName}`);
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            this.logger.warn(`修复: 删除 index.lock 失败（跳过）: ${msg} | ${fullName}`);
        }
    }

    /**
     * 修复子步骤 2：确保 .git 目录存在且可用
     *
     * 三种情况：
     * - .git 不存在 → git init 重建
     * - .git 存在且可用 → 跳过
     * - .git 存在但损坏（如克隆中断留下的残骸）→ 删除后 git init 重建
     *
     * 第三种情况是本次修复的核心：Windows 上 git clone 被超时强制杀死后，
     * 残留的 .git 目录结构不完整（rev-parse 失败），之前的逻辑会跳过 repairGitInit
     * 导致后续修复全部失败（remote/get-url 不是 git 仓库报错）。
     *
     * @returns 错误消息，无错误返回 null
     */
    private async repairGitInit(localPath: string, gitDir: string, fullName: string | null, githubToken?: string): Promise<string | null> {
        if (!existsSync(gitDir)) {
            // .git 不存在，直接 init
            return await this.doGitInit(localPath, fullName, githubToken);
        }

        // .git 存在，检查是否可用
        const { git: checkGit, cleanup: checkCleanup } = await this.createGit({
            baseDir: localPath,
            timeoutMs: 10_000,
            githubToken,
        });
        try {
            await checkGit.revparse(['--git-dir']);
            // rev-parse 成功 → .git 可用，无需重建
            return null;
        } catch {
            // rev-parse 失败 → .git 目录损坏，删除后重建
            this.logger.warn(`修复: .git 目录存在但结构损坏，删除后重建 | ${fullName}`);
            try {
                await rm(gitDir, { recursive: true, force: true });
            } catch (rmErr: unknown) {
                const rmMsg = rmErr instanceof Error ? rmErr.message : String(rmErr);
                return `仓库修复失败（无法删除损坏的 .git 目录）: ${rmMsg}`;
            }
            return await this.doGitInit(localPath, fullName, githubToken);
        } finally {
            checkCleanup();
        }
    }

    /**
     * 执行 git init（从 repairGitInit 提取）
     */
    private async doGitInit(localPath: string, fullName: string | null, githubToken?: string): Promise<string | null> {
        const { git, cleanup } = await this.createGit({
            baseDir: localPath,
            timeoutMs: 10_000,
            githubToken,
        });
        try {
            await git.init();
            this.logger.log(`修复: git init 重建 .git 目录成功 | ${fullName}`);
            return null;
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            return `仓库修复失败（git init 出错）: ${msg}`;
        } finally {
            cleanup();
        }
    }

    /**
     * 修复子步骤 3：修正 remote origin URL
     * 镜像源和直连模式切换后，git config 中的 URL 可能不匹配，需要修正。
     */
    private async repairRemoteUrl(
        localPath: string,
        expectedCloneUrl: string,
        fullName: string | null,
        githubToken?: string,
    ): Promise<void> {
        const { git, cleanup } = await this.createGit({
            baseDir: localPath,
            timeoutMs: 10_000,
            githubToken,
        });

        try {
            const currentUrl = await git.raw(['remote', 'get-url', 'origin']).catch(() => '');

            const normalizeUrl = (u: string) => u.replace(/\.git$/, '').trim();
            const current = normalizeUrl(currentUrl);
            const expected = normalizeUrl(expectedCloneUrl);

            if (!current) {
                await git.raw(['remote', 'add', 'origin', expectedCloneUrl]);
                this.logger.log(`修复: 已添加 remote origin | ${fullName}`);
            } else if (current !== expected) {
                await git.raw(['remote', 'set-url', 'origin', expectedCloneUrl]);
                this.logger.log(`修复: 已修正 remote origin: ${current} -> ${expected} | ${fullName}`);
            }
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            this.logger.warn(`修复: remote origin 操作失败（跳过）: ${msg} | ${fullName}`);
        } finally {
            cleanup();
        }
    }

    /**
     * 修复子步骤 4：git fetch --prune 验证远程可达并更新 refs
     * fetch 失败不阻塞，pull 阶段会带上完整认证重试。
     */
    private async repairFetchOrigin(localPath: string, fullName: string | null, githubToken?: string): Promise<void> {
        const { git, cleanup } = await this.createGit({
            baseDir: localPath,
            timeoutMs: CLONE_TIMEOUT_MS,
            githubToken,
        });

        try {
            await git.fetch(['--prune', 'origin']);
            this.logger.log(`修复: git fetch 成功，仓库可用 | ${fullName}`);
        } catch (e: unknown) {
            const errorMsg = e instanceof Error ? e.message : String(e);
            this.logger.warn(
                `修复: git fetch 失败，但仓库结构已验证通过，后续走 git pull 重试: ${errorMsg.substring(0, 200)} | ${fullName}`,
            );
        } finally {
            cleanup();
        }
    }

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
        const totalCount = items.length;

        const status = CloneService.computeFinalTaskStatus(completedCount, failedCount, totalCount);

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
        const processingItems = task.items.filter((i) => i.status === 'PROCESSING').length;
        const total = task.items.length;
        const processed = completedItems + failedItems;

        // 根据子项状态实时计算任务状态
        let status = task.status;
        if (task.status !== 'PROCESSING' && task.status !== 'PENDING') {
            status = CloneService.computeFinalTaskStatus(completedItems, failedItems, total);
        }

        // 进度计算：对于 PENDING（重试后）场景，已完成项也应计入进度
        const progress = total > 0 ? Math.round((processed * 100) / total) : 0;

        const failedDetails = task.items.filter((i) => i.status === 'FAILED').map((i) => ({ fullName: i.fullName, error: i.errorMessage }));

        const processingDetails = task.items
            .filter((i) => i.status === 'PROCESSING')
            .map((i) => ({ fullName: i.fullName, localPath: i.localPath }));

        return {
            success: true,
            taskId: Number(task.id),
            status,
            targetDir: task.targetDir,
            concurrency: task.concurrency,
            totalItems: total,
            completedItems,
            failedItems,
            processingItems,
            skippedItems: 0,
            progress,
            createdAt: task.createdAt?.toISOString(),
            startedAt: task.startedAt?.toISOString(),
            finishedAt: task.finishedAt?.toISOString(),
            failedDetails,
            processingDetails,
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
        if (this.running) {
            return { success: false, message: '当前有任务正在执行，请稍后再试' };
        }

        const task = await this.prisma.cloneTask.findUnique({
            where: { id: BigInt(taskId) },
            select: { id: true, targetDir: true },
        });

        if (!task) return { success: false, message: '任务不存在' };

        const taskTargetDir = task.targetDir;

        const items = await this.prisma.cloneTaskItem.findMany({
            where: {
                taskId: BigInt(taskId),
                status: 'FAILED',
            },
        });

        if (!items.length) return { success: false, message: '没有需要重试的项' };

        // 先删除旧目录，再执行数据库事务（原子操作）
        // 删除目录必须在事务之前完成，否则调度器 1 秒 tick 可能 pick up 任务并开始克隆，
        // 导致后续目录删除与进行中的克隆产生竞态（TOCTOU）
        for (const item of items) {
            await this.removeCloneDir(item.localPath, taskTargetDir);
        }

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

        // 仅当正在执行的任务就是当前要重置的任务时，才强制释放锁
        // 避免误杀不相关的正在运行的任务
        if (this.running && this.currentTaskId === BigInt(taskId)) {
            this.logger.warn(`重置正在执行的任务，强制释放锁: taskId=${taskId}`);
            this.forceReleaseLock();
        } else if (this.running) {
            this.logger.warn(`重置操作跳过锁释放：当前运行的是 taskId=${this.currentTaskId}，与目标 taskId=${taskId} 不同`);
        }

        // 查询失败项的目录路径（用于后续删除）
        const failedItems = await this.prisma.cloneTaskItem.findMany({
            where: {
                taskId: BigInt(taskId),
                status: 'FAILED',
            },
            select: { id: true, localPath: true, fullName: true },
        });

        const taskTargetDir = task.targetDir;

        // 先删除失败项的目录，再执行事务
        // 防止调度器在事务提交后 1 秒内 pick up 任务并开始克隆，产生 TOCTOU 竞态
        for (const item of failedItems) {
            await this.removeCloneDir(item.localPath, taskTargetDir);
        }

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

        const [task, item] = await Promise.all([
            this.prisma.cloneTask.findUnique({
                where: { id: BigInt(taskId) },
                select: { id: true, targetDir: true },
            }),
            this.prisma.cloneTaskItem.findFirst({
                where: { taskId: BigInt(taskId), fullName },
            }),
        ]);

        if (!task) return { success: false, message: '任务不存在' };
        if (!item) return { success: false, message: '未找到该任务项' };

        const taskTargetDir = task.targetDir;

        if (item.status === 'PROCESSING') {
            return { success: false, message: '任务正在执行中，无法重试' };
        }

        // 先删除旧目录，再执行数据库事务
        // 防止调度器在事务提交后 pick up 此任务时开始克隆到旧目录，产生 TOCTOU 竞态
        await this.removeCloneDir(item.localPath, taskTargetDir);

        // 执行数据库事务（原子操作），确保状态一致性
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

        this.logger.log(`克隆项重试: taskId=${taskId} fullName=${fullName}`);
        return { success: true, message: `已重置 ${fullName}，等待重新执行` };
    }

    /**
     * 删除克隆目录（三层兜底策略）
     *
     * Layer 1 — 直接删除 + 重试（最多 3 次，间隔递增）
     * Layer 2 — 找到并杀死占用该目录的 git 进程，再重试删除
     * Layer 3 — 重命名目录（rename 比 delete 更不容易被 Windows 锁），
     *           原路径被腾空后返回 true，后续克隆到原路径
     *
     * @param localPath 要删除的目录路径
     * @returns true=原路径已可用（删除或重命名成功） / false=所有兜底方案均失败
     */

    /**
     * Layer 1: 直接删除 + 最多 3 次重试
     *
     * @returns true=删除成功，false=需要尝试 Layer 2
     */
    private async removeCloneDirLayer1(localPath: string): Promise<boolean> {
        const MAX_RETRIES = 3;
        for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
            try {
                await rm(localPath, { recursive: true, force: true });
                this.logger.log(`已删除克隆目录: ${localPath}`);
                return true;
            } catch (e: unknown) {
                const msg = e instanceof Error ? e.message : String(e);
                if (!existsSync(localPath)) {
                    this.logger.log(`rm 报错但目录已不存在，视为删除成功: ${localPath} | ${msg}`);
                    return true;
                }
                if (attempt < MAX_RETRIES - 1) {
                    this.logger.warn(
                        `删除克隆目录失败（第${attempt + 1}次）: ${localPath} | ${msg.substring(0, 150)}，${attempt + 1}秒后重试`,
                    );
                    await delay((attempt + 1) * 1000);
                }
            }
        }
        return false;
    }

    /**
     * Layer 2: 杀死占用进程后重试删除
     *
     * @returns true=删除成功，false=需要尝试 Layer 3
     */
    private async removeCloneDirLayer2(localPath: string): Promise<boolean> {
        const killed = await this.killGitProcessesInDir(localPath);
        if (killed === 0) return false;

        await delay(2000);
        try {
            await rm(localPath, { recursive: true, force: true });
            this.logger.log(`杀死 ${killed} 个进程后删除成功: ${localPath}`);
            return true;
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            if (!existsSync(localPath)) {
                this.logger.log(`杀死进程后 rm 报错但目录已不存在: ${localPath}`);
                return true;
            }
            this.logger.warn(`杀死进程后仍无法删除: ${localPath} | ${msg.substring(0, 150)}`);
            return false;
        }
    }

    /**
     * Layer 3: 重命名目录腾出原路径
     *
     * rename 只修改目录元数据，Windows 上成功率远高于 rm。
     *
     * @returns true=原路径已可用（重命名成功），false=所有兜底方案均失败
     */
    private async removeCloneDirLayer3(localPath: string): Promise<boolean> {
        const timestamp = Date.now();
        const renamedPath = `${localPath}.conflict.${timestamp}`;
        try {
            await rename(localPath, renamedPath);
            this.logger.warn(`无法删除原目录，已重命名为: ${renamedPath} | 原路径已腾空可供克隆`);
            return true;
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            this.logger.error(`重命名也失败，所有兜底方案耗尽: ${localPath} | ${msg.substring(0, 150)}`);
            return false;
        }
    }

    private async removeCloneDir(localPath: string | null, targetDir?: string): Promise<boolean> {
        if (!localPath) return true;

        if (!this.isPathWithinTargetDir(localPath, targetDir)) {
            this.logger.warn(`拒绝删除目标目录外的路径: ${localPath}`);
            return false;
        }

        if (!existsSync(localPath)) return true;

        // ─── Layer 1: 直接删除 + 重试 ───
        if (await this.removeCloneDirLayer1(localPath)) return true;

        // ─── Layer 2: 杀死占用进程后重试删除 ───
        if (await this.removeCloneDirLayer2(localPath)) return true;

        // ─── Layer 3: 重命名目录腾出原路径 ───
        if (await this.removeCloneDirLayer3(localPath)) return true;

        return false;
    }

    /**
     * 查找并杀死在指定目录中工作的残留 git 进程（Layer 2 辅助方法）
     *
     * Windows: 通过 PowerShell Get-CimInstance 查找 git.exe，匹配命令行中的目录路径
     * Unix:   通过 pgrep -f 查找，匹配命令行中的目录路径
     *
     * @param targetPath 目标目录路径
     * @returns 杀死的进程数
     */
    private async killGitProcessesInDir(targetPath: string): Promise<number> {
        try {
            if (process.platform === 'win32') {
                return await this.killGitProcessesWindows(targetPath);
            }
            return await this.killGitProcessesUnix(targetPath);
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            this.logger.warn(`查找残留 git 进程失败（跳过）: ${msg.substring(0, 200)}`);
            return 0;
        }
    }

    /**
     * Windows: 通过 PowerShell 查找并杀死 git 进程
     */
    private async killGitProcessesWindows(targetPath: string): Promise<number> {
        // 转义路径中的反斜杠（PowerShell 中 \\ 表示一个字面反斜杠）
        const escapedPath = targetPath.replace(/\\/g, '\\\\');
        const psScript = `
            Get-CimInstance Win32_Process -Filter "name='git.exe'" |
            Where-Object { $_.CommandLine -like '*${escapedPath}*' } |
            ForEach-Object {
                Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
                Write-Host $_.ProcessId
            }
        `;

        const { stdout } = await execFileAsync(
            'powershell',
            ['-NoProfile', '-NonInteractive', '-Command', psScript.replace(/\n/g, ' ').trim()],
            { timeout: 15000, windowsHide: true },
        );

        const pids = stdout.trim().split(/\s+/).filter(Boolean);
        if (pids.length > 0) {
            this.logger.log(`已杀死 ${pids.length} 个残留 git 进程 (PID: ${pids.join(', ')})，路径: ${targetPath}`);
        }
        return pids.length;
    }

    /**
     * Unix: 通过 pgrep + kill 查找并杀死 git 进程
     */
    private async killGitProcessesUnix(targetPath: string): Promise<number> {
        try {
            const { stdout } = await execFileAsync('pgrep', ['-f', `git.*${targetPath}`], { timeout: 5000 });
            const pids = stdout.trim().split('\n').filter(Boolean);
            if (pids.length > 0) {
                await execFileAsync('kill', ['-9', ...pids], { timeout: 5000 });
                this.logger.log(`已杀死 ${pids.length} 个残留 git 进程 (PID: ${pids.join(', ')})，路径: ${targetPath}`);
            }
            return pids.length;
        } catch {
            // pgrep 找不到进程时返回非零 exit code，这是正常的
            return 0;
        }
    }

    /**
     * 查找备用克隆路径（Layer 3 辅助方法）
     *
     * 当原路径无法释放时，在原路径基础上追加 .v2, .v3, ... 后缀，
     * 返回第一个不存在的路径。
     *
     * @param originalPath 原始路径
     * @returns 可用的备用路径
     */
    private findAlternateClonePath(originalPath: string): string {
        for (let i = 2; i <= 99; i++) {
            const altPath = `${originalPath}.v${i}`;
            if (!existsSync(altPath)) {
                return altPath;
            }
        }
        // 极端情况：99 个备用路径全部占用，使用时间戳确保唯一性
        return `${originalPath}.${Date.now()}`;
    }

    /**
     * 写入 GIT_ASKPASS 临时脚本
     *
     * git 在需要认证时会调用此脚本，脚本输出 Token 作为密码。
     * 使用临时文件而非命令行参数传递 Token，避免 Token 被其他进程截获。
     *
     * @param token GitHub Token
     * @returns 临时脚本的绝对路径，调用方需在完成后调用 cleanupAskpassScript 删除
     */
    private async writeAskpassScript(token: string): Promise<string> {
        const scriptPath = path.join(
            os.tmpdir(),
            `githubstars-askpass-${randomBytes(8).toString('hex')}${process.platform === 'win32' ? '.bat' : '.sh'}`,
        );

        if (process.platform === 'win32') {
            // Windows: 使用 bat 脚本
            const content = `@echo off\r\necho ${token}\r\n`;
            await writeFile(scriptPath, content, 'utf-8');
        } else {
            // Unix: 使用 sh 脚本
            const content = `#!/bin/sh\necho "${token}"\n`;
            await writeFile(scriptPath, content, 'utf-8');
            await chmod(scriptPath, 0o755);
        }

        return scriptPath;
    }

    /**
     * 清理 GIT_ASKPASS 临时脚本
     *
     * @param scriptPath 临时脚本的绝对路径
     */
    private cleanupAskpassScript(scriptPath: string): void {
        try {
            if (existsSync(scriptPath)) {
                unlinkSync(scriptPath);
            }
        } catch {
            // 忽略清理失败
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
                    status = CloneService.computeFinalTaskStatus(completedItems, failedItems, total);
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
     * 删除任务及其所有子项记录。
     * 如果任务正在执行中，会强制停止并释放锁。
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

        // 如果任务正在执行中，强制停止并释放锁
        if (task.status === 'PROCESSING' && this.running && this.currentTaskId === BigInt(taskId)) {
            this.logger.warn(`删除正在执行的任务，强制释放锁: taskId=${taskId}`);
            this.forceReleaseLock();
        }

        // 删除子项和任务记录
        await this.prisma.cloneTaskItem.deleteMany({ where: { taskId: BigInt(taskId) } });
        await this.prisma.cloneTask.delete({ where: { id: BigInt(taskId) } });

        this.logger.log(`克隆任务已删除: taskId=${taskId} previousStatus=${task.status}`);
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
