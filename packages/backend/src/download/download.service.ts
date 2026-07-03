import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '../config/config.service';
import {
    DOWNLOAD_TIMEOUT_MS,
    TASK_TIMEOUT_MS,
    SEMAPHORE_TIMEOUT_MS,
    MAX_HISTORY_TASKS,
    NETWORK_ERROR_PATTERNS,
    MAX_NETWORK_RETRY_ATTEMPTS,
    RETRY_BASE_DELAY_MS,
    RETRY_MAX_DELAY_MS,
    RETRYABLE_HTTP_STATUSES,
    getOrderedMirrorUrls,
    type MirrorSourceName,
} from './download.constants';
import { CreateDownloadTaskDto } from './download.dto';
import { SYSTEM_FORBIDDEN_PREFIXES } from '../common/constants/system.constants';
import * as path from 'path';
import { randomBytes } from 'crypto';
import { existsSync, openSync, readSync, closeSync, statSync } from 'fs';
import { createWriteStream } from 'fs';
import { mkdir, rm, rename, stat, writeFile } from 'fs/promises';
import AdmZip from 'adm-zip';

/**
 * 为 Promise 添加超时包装
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
 */
function calculateBackoffDelay(attempt: number, baseMs: number = RETRY_BASE_DELAY_MS, maxMs: number = RETRY_MAX_DELAY_MS): number {
    const exponentialDelay = Math.min(baseMs * Math.pow(2, attempt), maxMs);
    const randomFraction = randomBytes(4).readUInt32BE(0) / 0xffffffff;
    const jitter = exponentialDelay * randomFraction * 0.5;
    return Math.floor(exponentialDelay + jitter);
}

/**
 * 判断错误是否为网络错误
 */
function isNetworkError(errorMsg: string): boolean {
    return NETWORK_ERROR_PATTERNS.some((pattern) => errorMsg.includes(pattern));
}

/**
 * 从 fullName 中提取 owner 和 repoName
 */
function parseFullName(fullName: string): { owner: string; repoName: string } {
    const slashIdx = fullName.indexOf('/');
    if (slashIdx <= 0 || slashIdx >= fullName.length - 1) {
        return { owner: 'unknown', repoName: 'unknown' };
    }
    return {
        owner: fullName.substring(0, slashIdx),
        repoName: fullName.substring(slashIdx + 1),
    };
}

/**
 * 验证文件是否为有效的 ZIP 文件（检查魔术字节）
 */
/**
 * 验证 ZIP 文件完整性（头尾双重校验）
 *
 * - 检查魔术字节（文件头 4 字节：PK\x03\x04）
 * - 检查 EOCD 尾部记录（文件末尾的 PK\x05\x06 签名）
 *
 * EOCD 检查能有效检测文件截断问题：镜像代理下载大文件时可能提前断开
 * 连接但未报错，导致文件头完整但内容被截断。
 *
 * 性能：仅读取文件头 4 字节 + 文件尾 64KB，不读取整个文件。
 */
function isValidZipFile(filePath: string): boolean {
    try {
        const fd = openSync(filePath, 'r');
        try {
            const size = statSync(filePath).size;
            if (size < 22) return false; // 最小有效 ZIP 22 字节

            // 检查魔术字节（文件头）
            const header = Buffer.alloc(4);
            readSync(fd, header, 0, 4, 0);
            if (header[0] !== 0x50 || header[1] !== 0x4b || header[2] !== 0x03 || header[3] !== 0x04) {
                return false;
            }

            // 检查 EOCD 尾部记录（文件末尾 22~65557 字节范围内搜索 PK\x05\x06）
            const searchSize = Math.min(size, 65557);
            const tail = Buffer.alloc(searchSize);
            readSync(fd, tail, 0, searchSize, size - searchSize);

            for (let i = searchSize - 22; i >= 0; i--) {
                if (tail[i] === 0x50 && tail[i + 1] === 0x4b && tail[i + 2] === 0x05 && tail[i + 3] === 0x06) {
                    return true;
                }
            }
            return false; // EOCD 未找到 → 文件被截断
        } finally {
            closeSync(fd);
        }
    } catch {
        return false;
    }
}

/** 解压完成标记文件名 */
const EXTRACT_MARKER_FILE = '.extracted_done';

@Injectable()
export class DownloadService {
    private readonly logger = new Logger(DownloadService.name);

    /** 任务级运行锁 */
    private running = false;

    /** 锁获取时间 */
    private lockAcquiredAt: Date | null = null;

    /** 当前正在执行的任务 ID */
    private currentTaskId: bigint | null = null;

    /** 信号量并发控制 */
    private semaphore = 0;
    private maxConcurrent = 5;
    private waitQueue: Array<{ fn: () => void; cancelled: boolean }> = [];

    /** 当前任务的目标目录 */
    private targetDir: string | null = null;

    /** 任务代际计数器 */
    private generation = 0;

    /** 已由 processItem 超时处理过的子项 ID 集合 */
    private timeoutHandledItems = new Set<string>();

    /** 批量解压进度追踪 key=taskId */
    private extractProgress = new Map<
        number,
        {
            status: 'extracting' | 'completed';
            total: number;
            current: number;
            extracted: number;
            skipped: number;
            failed: number;
            details: Array<{ fullName: string; status: string; message?: string }>;
            message: string;
        }
    >();

    constructor(
        private readonly prisma: PrismaService,
        private readonly config: ConfigService,
    ) {}

    /**
     * 获取 GitHub Token（从配置读取）
     */
    private async getGitHubToken(): Promise<string | undefined> {
        return this.config.getValue('github.token');
    }

    /**
     * 获取信号量许可（带超时保护和取消机制）
     */
    private acquire(): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            if (this.semaphore < this.maxConcurrent) {
                this.semaphore++;
                resolve();
            } else {
                const waiter = { fn: () => resolve(), cancelled: false };
                this.waitQueue.push(waiter);

                setTimeout(() => {
                    if (!waiter.cancelled) {
                        waiter.cancelled = true;
                        reject(new Error('信号量获取超时'));
                    }
                }, SEMAPHORE_TIMEOUT_MS);
            }
        });
    }

    /**
     * 释放信号量许可
     */
    private release() {
        this.semaphore = Math.max(0, this.semaphore - 1);
        this.drainWaitQueue();
    }

    /**
     * 从等待队列中取出下一个未取消的 waiter
     */
    private drainWaitQueue() {
        while (this.waitQueue.length > 0) {
            const waiter = this.waitQueue.shift()!;
            if (!waiter.cancelled) {
                this.semaphore++;
                queueMicrotask(waiter.fn);
                return;
            }
        }
    }

    /**
     * 重置信号量状态
     */
    private resetSemaphore(concurrency: number) {
        for (const waiter of this.waitQueue) {
            waiter.cancelled = true;
        }
        if (this.waitQueue.length > 0) {
            this.logger.warn(`重置信号量: 丢弃 ${this.waitQueue.length} 个等待中的请求`);
        }
        this.waitQueue = [];
        this.semaphore = 0;
        this.maxConcurrent = concurrency;
        this.timeoutHandledItems.clear();
    }

    /**
     * 创建下载任务
     */
    async createTask(dto: CreateDownloadTaskDto): Promise<{ success: boolean; taskId?: number; message?: string }> {
        const { repoIds, targetDir, concurrency, mirrorSources } = dto;

        // 路径校验
        if (!path.isAbsolute(targetDir)) {
            return { success: false, message: '目标目录必须是绝对路径' };
        }
        const normalizedTargetDir = path.normalize(targetDir).replace(/[\\/]$/, '');

        // 安全校验
        const compareDir = normalizedTargetDir.toLowerCase().replace(/\\/g, '/');
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

        // 创建主任务（mirrorSources 存储为 JSON 数组字符串）
        const task = await this.prisma.downloadTask.create({
            data: {
                status: 'PENDING',
                targetDir: normalizedTargetDir,
                concurrency,
                mirrorSource: JSON.stringify(mirrorSources || ['direct']),
                totalItems: repos.length,
                createdAt: new Date(),
            },
        });

        // 创建任务明细（分支检测推迟到任务执行时，创建不做网络请求）
        const validItems: Array<{
            taskId: bigint;
            repoId: bigint;
            fullName: string;
            archiveUrl: string;
            localFilePath: string;
            extractDir: string | null;
            fileSize: bigint;
            defaultBranch: string | null;
            status: 'PENDING';
            retryCount: number;
            createdAt: Date;
        }> = [];

        for (const repo of repos) {
            const fullName = repo.fullName || '';
            const { owner, repoName } = parseFullName(fullName);

            // 使用 HEAD.zip（GitHub 自动 302 到默认分支），执行时再解析真实分支名
            const safeFileName = `${owner}_${repoName}.zip`.replace(/[<>:"/\\|?*]/g, '_');
            const downloadDir = path.join(normalizedTargetDir, owner);
            const localFilePath = path.join(downloadDir, safeFileName);

            // 路径安全校验
            if (!localFilePath.startsWith(normalizedTargetDir + path.sep)) {
                this.logger.warn(`路径安全校验失败，跳过: ${fullName}`);
                continue;
            }

            // archive URL 使用 HEAD.zip，执行时解析重定向后更新
            const archiveUrl = `https://github.com/${owner}/${repoName}/archive/HEAD.zip`;

            validItems.push({
                taskId: task.id,
                repoId: repo.id,
                fullName,
                archiveUrl,
                localFilePath,
                extractDir: null,
                fileSize: BigInt(0),
                defaultBranch: null,
                status: 'PENDING' as const,
                retryCount: 0,
                createdAt: new Date(),
            });
        }

        if (validItems.length === 0) {
            await this.prisma.downloadTask.delete({ where: { id: task.id } });
            return { success: false, message: '所有仓库的路径校验均失败' };
        }

        if (validItems.length < repos.length) {
            await this.prisma.downloadTask.update({
                where: { id: task.id },
                data: { totalItems: validItems.length },
            });
        }

        await this.prisma.downloadTaskItem.createMany({ data: validItems });

        this.logger.log(
            `下载任务已创建: taskId=${Number(task.id)} repos=${validItems.length} ` + `mirrors=${JSON.stringify(mirrorSources)}`,
        );

        return {
            success: true,
            taskId: Number(task.id),
            message: `已创建下载任务，共 ${validItems.length} 个仓库`,
        };
    }

    /**
     * 预估多个仓库的下载大小
     *
     * 对每个仓库的 archive URL 发 HEAD 请求获取 Content-Length（不下载 body），
     * 用于前端在创建下载任务前展示总计大小。
     *
     * @param repoIds 仓库 ID 列表
     * @returns 每个仓库的预估大小（字节）和总计
     *
     * @callers
     *   - DownloadController.estimateSizes()  — POST /api/download/estimate-sizes
     *
     * @depends
     *   - prisma.githubRepo.findMany()  — 查仓库信息
     *   - fetch(url, { method: 'HEAD' }) — 获取 Content-Length
     *   - getGitHubToken()              — 避免 GitHub API 限速
     */
    async estimateSizes(repoIds: number[]): Promise<{
        success: boolean;
        items: Array<{ repoId: number; fullName: string; sizeInBytes: number }>;
        totalBytes: number;
        failedCount: number;
    }> {
        const repos = await this.prisma.githubRepo.findMany({
            where: { id: { in: repoIds.map((id) => BigInt(id)) } },
            select: { id: true, fullName: true, repoSize: true },
        });
        if (repos.length === 0) {
            return { success: true, items: [], totalBytes: 0, failedCount: 0 };
        }

        // 按 fullName 排序保持确定性
        const sorted = [...repos].sort((a, b) => ((a.fullName || '') > (b.fullName || '') ? 1 : -1));

        const items: Array<{ repoId: number; fullName: string; sizeInBytes: number }> = [];
        let failedCount = 0;

        for (const repo of sorted) {
            const fullName = repo.fullName || '';

            if (repo.repoSize != null && repo.repoSize > 0) {
                // repo_size 是 git 仓库磁盘大小（KB），压缩包约为磁盘大小的 30%~50%
                // 取中间值 40% 作为估算系数
                const sizeInBytes = Math.round(repo.repoSize * 1024 * 0.4);
                items.push({ repoId: Number(repo.id), fullName, sizeInBytes });
            } else {
                // 没有 repo_size 数据，标记为失败
                items.push({ repoId: Number(repo.id), fullName, sizeInBytes: 0 });
                failedCount++;
            }
        }

        const totalBytes = items.reduce((sum, item) => sum + item.sizeInBytes, 0);

        this.logger.log(`下载大小预估完成: repos=${items.length} totalBytes=${totalBytes} failedCount=${failedCount}`);

        return { success: true, items, totalBytes, failedCount };
    }

    /**
     * 检测仓库默认分支
     *
     * 通过 GitHub API 获取仓库信息，提取 default_branch。
     * 如果 API 失败（如限速），尝试常见分支名的 archive URL 来探测正确分支。
     *
     * @param owner   仓库所有者
     * @param repoName 仓库名称
     * @param token    GitHub Token（可选）
     * @returns 检测到的默认分支名，所有探测失败时返回 'main'
     */
    private async detectDefaultBranch(owner: string, repoName: string, token?: string): Promise<string | null> {
        // 优先通过 GitHub API 获取
        try {
            const headers: Record<string, string> = {
                Accept: 'application/vnd.github.v3+json',
                'User-Agent': 'GithubStars-Manager',
            };
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }

            const response = await fetch(`https://api.github.com/repos/${owner}/${repoName}`, {
                headers,
                signal: AbortSignal.timeout(5_000),
            });

            if (response.ok) {
                const data = (await response.json()) as { default_branch?: string };
                if (data.default_branch) {
                    return data.default_branch;
                }
            }
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            this.logger.warn(`GitHub API 获取默认分支失败: ${owner}/${repoName} | ${msg}`);
        }

        // API 失败（限速/网络问题），通过 HEAD 请求探测常见分支名
        // 优先通过 ghproxy 镜像快速探测 master 和 main（国内网络友好），再直连探测所有候选
        const proxyPrefixes = ['https://ghproxy.net/https://github.com'];
        for (const prefix of proxyPrefixes) {
            for (const branch of ['master', 'main']) {
                try {
                    const headResponse = await fetch(`${prefix}/${owner}/${repoName}/archive/refs/heads/${branch}.zip`, {
                        method: 'HEAD',
                        signal: AbortSignal.timeout(3_000),
                    });
                    if (headResponse.ok || headResponse.status === 302 || headResponse.status === 307) {
                        this.logger.log(`通过镜像代理探测到默认分支: ${owner}/${repoName} -> ${branch}`);
                        return branch;
                    }
                } catch {
                    // 单个探测失败，继续
                }
            }
        }

        // 直连 GitHub 探测所有候选分支
        const candidates = ['master', 'main', 'develop', 'dev', 'trunk'];
        for (const branch of candidates) {
            try {
                const headResponse = await fetch(`https://github.com/${owner}/${repoName}/archive/refs/heads/${branch}.zip`, {
                    method: 'HEAD',
                    signal: AbortSignal.timeout(3_000),
                });
                if (headResponse.ok) {
                    this.logger.log(`通过 HEAD 直连探测到默认分支: ${owner}/${repoName} -> ${branch}`);
                    return branch;
                }
                if (headResponse.status === 302 || headResponse.status === 307) {
                    this.logger.log(`通过 HEAD 重定向探测到默认分支: ${owner}/${repoName} -> ${branch}`);
                    return branch;
                }
            } catch {
                // 单个分支探测失败，继续尝试下一个
            }
        }

        this.logger.warn(`所有分支探测失败，回退到 HEAD.zip 自动重定向: ${owner}/${repoName}`);
        return null;
    }

    /**
     * 获取常用下载目录列表
     */
    async getRecentDirectories() {
        const tasks = await this.prisma.downloadTask.findMany({
            select: { targetDir: true },
            orderBy: { createdAt: 'desc' },
            take: 50,
        });
        const uniqueDirs = [...new Set(tasks.map((t) => t.targetDir))];
        return { success: true, directories: uniqueDirs.slice(0, 10) };
    }

    /**
     * 查找下一个待执行的 PENDING 任务
     */
    async findNextPendingTask() {
        const task = await this.prisma.downloadTask.findFirst({
            where: { status: 'PENDING' },
            orderBy: { createdAt: 'asc' },
            select: { id: true, concurrency: true },
        });
        if (!task) return null;

        // 确保任务项已创建（防止 createItems 未完成时调度器误 pick up）
        const itemCount = await this.prisma.downloadTaskItem.count({
            where: { taskId: task.id },
        });
        if (itemCount === 0) {
            this.logger.warn(`调度器发现任务 ${Number(task.id)} 但子项尚未创建，跳过`);
            return null;
        }

        return task;
    }

    isRunning(): boolean {
        return this.running;
    }

    getLockAge(): number {
        if (!this.running || !this.lockAcquiredAt) return -1;
        return Date.now() - this.lockAcquiredAt.getTime();
    }

    getCurrentTaskId(): bigint | null {
        return this.currentTaskId;
    }

    forceReleaseLock() {
        this.generation++;
        this.running = false;
        this.lockAcquiredAt = null;
        this.currentTaskId = null;
        this.logger.warn('下载任务锁已被强制释放');
    }

    /**
     * 执行下载任务（带任务级超时保护）
     */
    async executeTask(taskId: bigint) {
        if (this.running) {
            this.logger.warn(`executeTask 被跳过，running 锁已被持有: taskId=${Number(taskId)}`);
            return;
        }

        this.running = true;
        this.lockAcquiredAt = new Date();
        this.currentTaskId = taskId;
        try {
            await withTimeout(
                this.executeTaskInner(taskId),
                TASK_TIMEOUT_MS,
                `下载任务超时 (${TASK_TIMEOUT_MS / 60000}分钟): taskId=${Number(taskId)}`,
            );
        } catch (e: unknown) {
            this.logger.error(`下载任务执行异常: taskId=${Number(taskId)}`, e);
            try {
                await this.prisma.downloadTask.update({
                    where: { id: taskId },
                    data: { status: 'FAILED', finishedAt: new Date() },
                });
            } catch (updateErr) {
                this.logger.error('更新任务失败状态时出错', updateErr);
            }
        } finally {
            if (this.currentTaskId === taskId) {
                this.running = false;
                this.lockAcquiredAt = null;
                this.currentTaskId = null;
                this.logger.log(`下载任务执行结束，running 锁已释放: taskId=${Number(taskId)}`);
            } else {
                this.logger.warn(`跳过旧任务锁释放: taskId=${Number(taskId)}, currentTaskId=${this.currentTaskId}`);
            }
        }
    }

    /**
     * 任务执行内部逻辑
     */
    private async executeTaskInner(taskId: bigint) {
        const task = await this.prisma.downloadTask.findUnique({ where: { id: taskId } });
        if (!task) return;

        this.targetDir = task.targetDir;

        await this.prisma.downloadTask.update({
            where: { id: taskId },
            data: { status: 'PROCESSING', startedAt: new Date() },
        });

        this.resetSemaphore(task.concurrency);

        const items = await this.prisma.downloadTaskItem.findMany({
            where: { taskId, status: 'PENDING' },
        });

        // 解析镜像源列表（兼容旧版单字符串格式）
        const mirrorSources = this.parseMirrorSources(task.mirrorSource);
        this.logger.log(
            `下载任务开始执行: taskId=${Number(taskId)} pendingItems=${items.length} ` +
                `concurrency=${task.concurrency} mirrorSources=${JSON.stringify(mirrorSources)}`,
        );

        // 优先从数据库读取所有 repo 的 defaultBranch 和 repoSize，避免不必要的网络请求
        const repoIds = items.map((item) => item.repoId).filter(Boolean);
        const reposWithBranch =
            repoIds.length > 0
                ? await this.prisma.githubRepo.findMany({
                      where: { id: { in: repoIds } },
                      select: { id: true, defaultBranch: true, repoSize: true },
                  })
                : [];
        const branchCache = new Map(reposWithBranch.map((r) => [Number(r.id), r.defaultBranch]));
        const sizeCache = new Map(reposWithBranch.map((r) => [Number(r.id), r.repoSize]));

        // 解析所有 PENDING 项的真实分支：优先从 DB 取，DB 没有再走 HEAD.zip 302 探测
        const token = await this.getGitHubToken();
        const branchResolvedItems = await Promise.all(
            items.map(async (item) => {
                const fullName = item.fullName || '';
                const { owner, repoName } = parseFullName(fullName);

                // Step 1: 优先从数据库取 defaultBranch
                let branch: string | null = item.repoId ? (branchCache.get(Number(item.repoId)) ?? null) : null;

                // Step 2: DB 没有 → 网络探测（HEAD.zip 302 重定向 + detectDefaultBranch 兜底）
                if (!branch) {
                    try {
                        const response = await fetch(`https://github.com/${owner}/${repoName}/archive/HEAD.zip`, {
                            method: 'HEAD',
                            redirect: 'manual',
                            signal: AbortSignal.timeout(5_000),
                        });
                        if (response.status === 302 || response.status === 301 || response.status === 307 || response.status === 308) {
                            const location = response.headers.get('location') || '';
                            const match = /\/archive\/refs\/heads\/(.+)\.zip$/i.exec(location);
                            branch = match?.[1] ?? null;
                        }
                    } catch {
                        // HEAD.zip 网络失败，交给 fallback
                    }

                    // HEAD.zip 未获取到有效分支 → 回退到传统分支检测
                    if (!branch) {
                        branch = await this.detectDefaultBranch(owner, repoName, token);
                    }

                    // 网络探测到的分支写回数据库，下次直接读取
                    if (branch && item.repoId) {
                        try {
                            await this.prisma.githubRepo
                                .update({
                                    where: { id: item.repoId },
                                    data: { defaultBranch: branch },
                                })
                                .catch(() => {
                                    /* 静默失败，不影响主流程 */
                                });
                        } catch {
                            /* 静默 */
                        }
                    }
                }

                // Step 3: 验证分支的压缩包是否存在，如果 404 则尝试另一种常见分支名
                let branchVerified = branch;
                if (branch) {
                    try {
                        const checkUrl = `https://github.com/${owner}/${repoName}/archive/refs/heads/${branch}.zip`;
                        const checkResponse = await fetch(checkUrl, {
                            method: 'HEAD',
                            signal: AbortSignal.timeout(5_000),
                        });
                        if (checkResponse.status === 404) {
                            const altBranch = branch === 'main' ? 'master' : 'main';
                            const altUrl = `https://github.com/${owner}/${repoName}/archive/refs/heads/${altBranch}.zip`;
                            const altResponse = await fetch(altUrl, {
                                method: 'HEAD',
                                signal: AbortSignal.timeout(5_000),
                            });
                            if (altResponse.ok) {
                                this.logger.log(`分支 ${branch} 不存在，自动切换到 ${altBranch}: ${fullName}`);
                                branchVerified = altBranch;
                            }
                        }
                    } catch {
                        // 验证失败，沿用原始分支
                    }
                }
                branch = branchVerified;

                const newArchiveUrl = branch
                    ? `https://github.com/${owner}/${repoName}/archive/refs/heads/${branch}.zip`
                    : `https://github.com/${owner}/${repoName}/archive/HEAD.zip`;
                const safeFileName = branch
                    ? `${owner}_${repoName}-${branch}.zip`.replace(/[<>:"/\\|?*]/g, '_')
                    : `${owner}_${repoName}.zip`.replace(/[<>:"/\\|?*]/g, '_');
                const downloadDir = path.join(this.targetDir!, owner);
                const newLocalFilePath = path.join(downloadDir, safeFileName);

                // 从数据库 repo_size 估算文件大小（repo_size KB × 0.4 压缩比 → bytes）
                const repoSize = item.repoId ? (sizeCache.get(Number(item.repoId)) ?? null) : null;
                const fileSize = repoSize != null && repoSize > 0
                    ? BigInt(Math.round(repoSize * 1024 * 0.4))
                    : BigInt(0);

                return { item, newArchiveUrl, newLocalFilePath, branch, fileSize };
            }),
        );

        // 批量更新 DB（archiveUrl/localFilePath/fileSize 均来自执行时解析，全部写入）
        const dbUpdates = branchResolvedItems.map((r) =>
            this.prisma.downloadTaskItem.update({
                where: { id: r.item.id },
                data: {
                    archiveUrl: r.newArchiveUrl,
                    localFilePath: r.newLocalFilePath,
                    defaultBranch: r.branch,
                    fileSize: r.fileSize,
                },
            }),
        );
        if (dbUpdates.length > 0) {
            await this.prisma.$transaction(dbUpdates);
        }

        // 更新内存中的 item 对象（后续 processItem 会直接使用）
        for (const r of branchResolvedItems) {
            r.item.archiveUrl = r.newArchiveUrl;
            r.item.localFilePath = r.newLocalFilePath;
        }

        const results = await Promise.allSettled(items.map((item) => this.processItem(item, mirrorSources)));
        const rejectedCount = results.filter((r) => r.status === 'rejected').length;
        if (rejectedCount > 0) {
            this.logger.warn(`executeTaskInner: ${rejectedCount} 个子项未处理（信号量超时）`);
        }

        await this.finishTask(taskId);
    }

    /**
     * 解析镜像源列表
     *
     * 兼容两种格式：
     * 1. JSON 数组字符串：["ghproxy","gh-proxy"]
     * 2. 旧版单字符串："ghproxy"
     */
    private parseMirrorSources(raw: string | null | undefined): MirrorSourceName[] {
        if (!raw) return ['direct'];
        try {
            const parsed = JSON.parse(raw) as unknown;
            if (Array.isArray(parsed) && parsed.length > 0) {
                return parsed as MirrorSourceName[];
            }
        } catch {
            // 旧版单字符串格式
            if (raw && typeof raw === 'string') {
                return [raw as MirrorSourceName];
            }
        }
        return ['direct'];
    }

    /**
     * 处理单个下载子项（带超时保护）
     */
    private async processItem(
        item: {
            id: bigint;
            taskId: bigint;
            fullName: string | null;
            localFilePath: string | null;
            archiveUrl: string | null;
            extractDir: string | null;
        },
        mirrorSources: MirrorSourceName[],
    ) {
        const capturedGen = this.generation;
        await this.acquire();
        let error: string | null = null;

        try {
            await this.processItemInner(item, capturedGen, mirrorSources);
        } catch (e: unknown) {
            error = e instanceof Error ? e.message : String(e);
            this.logger.error(`子项处理异常: ${item.fullName}`, e instanceof Error ? e : new Error(String(e)));
        } finally {
            if (this.generation === capturedGen) {
                if (error !== null) {
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
     *
     * 支持多镜像源回退：按 mirrorSources 顺序尝试每个源，
     * 只要有一个源下载成功就算成功。
     */
    private async processItemInner(
        item: {
            id: bigint;
            taskId: bigint;
            fullName: string | null;
            localFilePath: string | null;
            archiveUrl: string | null;
            extractDir: string | null;
        },
        capturedGen: number,
        mirrorSources: MirrorSourceName[],
    ) {
        await this.prisma.downloadTaskItem.update({
            where: { id: item.id },
            data: { status: 'PROCESSING' },
        });

        // 多镜像源回退下载：依次尝试每个镜像，直到成功或全部失败
        const result = await this.executeDownloadWithMirrorFallback(item, mirrorSources);

        if (this.generation !== capturedGen) {
            this.logger.warn('代际已变更，跳过状态写入: ' + item.fullName);
            return;
        }

        if (this.timeoutHandledItems.has(String(item.id))) {
            this.logger.warn(`子项 ${item.fullName} 已被 processItem 处理（超时），跳过 processItemInner 写入`);
            return;
        }

        // 下载+解压成功后，检查是否需要删除原压缩文件
        if (result.success && item.extractDir && item.localFilePath) {
            await this.cleanupAfterExtract(item);
        }

        await this.recordItemResult(item, result.success, result.error);
    }

    /**
     * 解压后清理压缩文件
     */
    private async cleanupAfterExtract(item: { id: bigint; taskId: bigint; fullName: string | null; localFilePath: string | null }) {
        try {
            const task = await this.prisma.downloadTask.findUnique({
                where: { id: item.taskId },
                select: { deleteArchiveAfterExtract: true },
            });
            if (task?.deleteArchiveAfterExtract && item.localFilePath) {
                try {
                    const { existsSync } = await import('fs');
                    if (existsSync(item.localFilePath)) {
                        await rm(item.localFilePath, { force: true });
                        this.logger.log(`解压后已删除压缩包: ${item.fullName}`);
                    }
                } catch {
                    // 忽略
                }
            }
        } catch {
            // 忽略清理失败
        }
    }

    /**
     * 多镜像源回退下载
     *
     * 按 mirrorSources 顺序尝试每个镜像源，只要有一个成功就返回。
     * 文件已存在时直接跳过下载。
     */
    private async executeDownloadWithMirrorFallback(
        item: {
            id: bigint;
            fullName: string | null;
            localFilePath: string | null;
            archiveUrl: string | null;
            extractDir: string | null;
        },
        mirrorSources: MirrorSourceName[],
    ): Promise<{ success: boolean; error?: string }> {
        const localFilePath = item.localFilePath as string;
        const archiveUrl = item.archiveUrl as string;

        if (!this.isPathWithinTargetDir(localFilePath)) {
            return { success: false, error: `路径安全校验失败: ${localFilePath}` };
        }

        if (!archiveUrl) {
            return { success: false, error: 'archiveUrl 为空' };
        }

        const parentDir = path.dirname(localFilePath);

        try {
            await mkdir(parentDir, { recursive: true });

            // 如果文件已存在，跳过下载
            if (existsSync(localFilePath)) {
                this.logger.log(`文件已存在，跳过下载: ${item.fullName} -> ${localFilePath}`);
            } else {
                // 获取按优先级排序的镜像 URL 列表
                const orderedUrls = getOrderedMirrorUrls(archiveUrl, mirrorSources);
                this.logger.log(
                    `开始多镜像下载: ${item.fullName} sources=${JSON.stringify(mirrorSources)} ` + `urls=${orderedUrls.length}个`,
                );

                // 依次尝试每个镜像源
                const downloadResult = await this.downloadFromMirrorChain(orderedUrls, localFilePath, item.fullName);

                if (!downloadResult.success) {
                    return downloadResult;
                }
            }

            // 只下载压缩包，解压由用户在任务列表中手动操作
            return { success: true };
        } catch (e: unknown) {
            const errorMsg = e instanceof Error ? e.message : String(e);
            return { success: false, error: errorMsg.substring(0, 2000) };
        }
    }

    /**
     * 从镜像 URL 链中依次尝试下载
     *
     * 对每个 URL 调用 downloadWithRetry，成功则返回，失败则尝试下一个 URL。
     * 收集所有失败原因，全部失败时返回汇总错误。
     */
    private async downloadFromMirrorChain(
        urls: string[],
        destPath: string,
        fullName: string | null,
    ): Promise<{ success: boolean; error?: string }> {
        const errors: string[] = [];

        for (let i = 0; i < urls.length; i++) {
            const url = urls[i];
            const sourceLabel = i < urls.length - 1 ? `镜像${i + 1}` : '原始源(兜底)';
            this.logger.log(`尝试 ${sourceLabel} 下载: ${fullName} url=${url.substring(0, 100)}...`);

            const result = await this.downloadWithRetry(url, destPath, fullName);

            if (result.success) {
                this.logger.log(`${sourceLabel} 下载成功: ${fullName}`);
                return { success: true };
            }

            const errorMsg = result.error || '未知错误';
            errors.push(`[${sourceLabel}] ${errorMsg}`);
            this.logger.warn(`${sourceLabel} 下载失败，尝试下一个: ${fullName} | ${errorMsg.substring(0, 200)}`);

            // 清理失败的文件，为下一个镜像做准备
            try {
                if (existsSync(destPath)) {
                    await rm(destPath, { force: true });
                }
            } catch {
                // 忽略清理错误
            }
        }

        const allErrors = errors.join('; ');
        this.logger.error(`所有镜像源均下载失败: ${fullName} | ${allErrors.substring(0, 300)}`);
        return { success: false, error: `所有镜像源均失败: ${allErrors.substring(0, 2000)}` };
    }

    /**
     * 带重试的下载
     */
    private async downloadWithRetry(url: string, destPath: string, fullName: string | null): Promise<{ success: boolean; error?: string }> {
        for (let attempt = 0; attempt < MAX_NETWORK_RETRY_ATTEMPTS; attempt++) {
            try {
                const parentDir = path.dirname(destPath);
                await mkdir(parentDir, { recursive: true });

                await this.downloadFile(url, destPath);

                // 验证文件完整性（头 + 尾双重校验）
                if (!isValidZipFile(destPath)) {
                    await rm(destPath, { force: true });
                    throw new Error('下载文件不是有效的 ZIP 文件（文件头损坏或文件被截断），可能是代理返回了错误页面');
                }

                // 大文件预检（超过 500MB 不下载，直接失败避免反复重试）
                const MAX_FILE_SIZE = 500 * 1024 * 1024;
                const size = (await stat(destPath)).size;
                if (size > MAX_FILE_SIZE) {
                    await rm(destPath, { force: true });
                    const sizeMB = (size / 1024 / 1024).toFixed(1);
                    throw new Error(`文件过大 (${sizeMB} MB)，超过 ${500} MB 限制，跳过下载`);
                }

                this.logger.log(`下载成功: ${fullName} -> ${destPath}`);
                return { success: true };
            } catch (e: unknown) {
                const errorMsg = e instanceof Error ? e.message : String(e);

                // 清理不完整的文件
                try {
                    if (existsSync(destPath)) {
                        await rm(destPath, { force: true });
                    }
                } catch {
                    // 忽略清理错误
                }

                if (attempt < MAX_NETWORK_RETRY_ATTEMPTS - 1) {
                    const isNetwork = isNetworkError(errorMsg);
                    if (isNetwork) {
                        const backoffMs = calculateBackoffDelay(attempt);
                        this.logger.warn(
                            `网络错误，${backoffMs}ms 后重试 (${attempt + 1}/${MAX_NETWORK_RETRY_ATTEMPTS}): ${fullName} | ${errorMsg.substring(0, 200)}`,
                        );
                        await delay(backoffMs);
                    } else {
                        // 非网络错误直接返回，不重试
                        this.logger.error(`下载失败（非网络错误，不重试）: ${fullName} | ${errorMsg.substring(0, 200)}`);
                        return { success: false, error: errorMsg.substring(0, 2000) };
                    }
                } else {
                    this.logger.error(`下载失败（已重试 ${MAX_NETWORK_RETRY_ATTEMPTS} 次）: ${fullName} | ${errorMsg.substring(0, 200)}`);
                    return { success: false, error: `下载失败: ${errorMsg.substring(0, 2000)}` };
                }
            }
        }
        return { success: false, error: '下载重试逻辑异常' };
    }

    /**
     * 下载单个文件（使用 fetch + 流式写入）
     */
    private async downloadFile(url: string, destPath: string): Promise<void> {
        const response = await fetch(url, {
            signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
        });

        if (!response.ok) {
            const statusText = response.statusText || 'Unknown Error';
            const isRetryable = RETRYABLE_HTTP_STATUSES.includes(response.status);
            throw new Error(`HTTP ${response.status}${statusText ? ` ${statusText}` : ''}${isRetryable ? ' (可重试)' : ''}`);
        }

        const body = response.body;
        if (!body) {
            throw new Error('响应体为空');
        }

        // 记录 Content-Length（部分代理会返回，可用于后续校验）
        const contentLength = response.headers.get('content-length');

        const writer = createWriteStream(destPath);
        const reader = body.getReader();

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                writer.write(value);
            }
        } catch (e: unknown) {
            writer.close();
            // 清理不完整的文件
            try {
                if (existsSync(destPath)) {
                    await rm(destPath, { force: true });
                }
            } catch {
                // 忽略清理错误
            }
            throw e;
        }

        await new Promise<void>((resolve, reject) => {
            writer.end();
            writer.on('finish', resolve);
            writer.on('error', reject);
        });

        // Content-Length 校验：如果代理返回了 Content-Length 头，验证实际下载大小是否匹配
        // 能额外拦截代理返回"虚假完成"响应的情况
        if (contentLength) {
            const expectedSize = Number.parseInt(contentLength, 10);
            const actualSize = (await stat(destPath)).size;
            if (actualSize !== expectedSize) {
                try {
                    await rm(destPath, { force: true });
                } catch {
                    // 忽略清理错误
                }
                throw new Error(
                    `文件大小不匹配：下载完成但实际大小 (${actualSize} 字节) 与预期 (${expectedSize} 字节) 不一致，文件可能被截断`,
                );
            }
        }
    }

    /**
     * 带重试的解压
     */
    private async extractWithRetry(
        zipPath: string,
        destDir: string,
        fullName: string | null,
    ): Promise<{ success: boolean; error?: string }> {
        // ZIP 炸弹预检
        const precheck = await this.precheckZipBomb(zipPath);
        if (!precheck.success) {
            return precheck;
        }

        for (let attempt = 0; attempt < 2; attempt++) {
            try {
                await mkdir(destDir, { recursive: true });

                // 读取 ZIP 并提取
                const zip = new AdmZip(zipPath);
                const entries = zip.getEntries();

                // 获取 ZIP 中的顶层目录名（如 "repo-main"）
                // GitHub archive 中的文件路径格式: {repoName}-{branch}/src/...
                const firstEntryName = entries[0].entryName;
                const topLevelDir = firstEntryName.includes('/') ? firstEntryName.substring(0, firstEntryName.indexOf('/')) : '';

                if (topLevelDir) {
                    // 有顶层目录：提取到临时目录，然后移动内容到目标
                    const tempDir = destDir + '.tmp';
                    await mkdir(tempDir, { recursive: true });

                    const zip2 = new AdmZip(zipPath);
                    zip2.extractAllTo(tempDir, true);

                    // 移动内容：从 tempDir/topLevelDir/xxx 到 destDir/xxx
                    const extractedContentDir = path.join(tempDir, topLevelDir);
                    if (existsSync(extractedContentDir)) {
                        // 如果目标目录已存在，先删除
                        if (existsSync(destDir)) {
                            await rm(destDir, { recursive: true, force: true });
                        }
                        await mkdir(path.dirname(destDir), { recursive: true });
                        await rename(extractedContentDir, destDir);
                    }

                    // 清理临时目录
                    try {
                        await rm(tempDir, { recursive: true, force: true });
                    } catch {
                        // 忽略
                    }
                } else {
                    // 无顶层目录，直接提取
                    zip.extractAllTo(destDir, true);
                }

                this.logger.log(`解压成功: ${fullName} -> ${destDir}`);
                return { success: true };
            } catch (e: unknown) {
                const errorMsg = e instanceof Error ? e.message : String(e);
                if (attempt < 1) {
                    this.logger.warn(`解压失败，重试中: ${fullName} | ${errorMsg.substring(0, 200)}`);
                    await delay(1000);
                } else {
                    this.logger.error(`解压失败: ${fullName} | ${errorMsg.substring(0, 200)}`);
                    return { success: false, error: `解压失败: ${errorMsg.substring(0, 2000)}` };
                }
            }
        }
        return { success: false, error: '解压重试逻辑异常' };
    }

    /**
     * 校验路径是否在目标目录内
     */
    private isPathWithinTargetDir(targetPath: string, targetDir?: string): boolean {
        const effectiveTarget = targetDir ?? this.targetDir;
        if (!effectiveTarget) return true;
        const resolved = path.resolve(targetPath);
        const target = path.resolve(effectiveTarget);
        return resolved.startsWith(target + path.sep) || resolved === target;
    }

    /**
     * 记录子项结果
     */
    private async recordItemResult(
        item: { id: bigint; fullName: string | null; localFilePath?: string | null },
        success: boolean,
        error?: string,
    ) {
        const status = success ? 'COMPLETED' : 'FAILED';
        const data: Record<string, unknown> = {
            status,
            errorMessage: success ? null : error,
            updatedAt: new Date(),
        };
        // 下载成功后 stat 本地文件，更新为实际文件大小（比 HEAD 的 Content-Length 更准确）
        if (success && item.localFilePath) {
            try {
                const stats = await stat(item.localFilePath);
                data.fileSize = BigInt(stats.size);
            } catch {
                // stat 失败不影响主流程
            }
        }
        await this.prisma.downloadTaskItem.update({
            where: { id: item.id },
            data,
        });
    }

    /**
     * 完成任务并设置终态
     */
    private async finishTask(taskId: bigint) {
        const items = await this.prisma.downloadTaskItem.findMany({
            where: { taskId },
            select: { status: true },
        });

        const completedCount = items.filter((i) => i.status === 'COMPLETED').length;
        const failedCount = items.filter((i) => i.status === 'FAILED').length;
        const totalCount = items.length;

        // 获取任务信息（检查是否需要清理压缩包）
        const task = await this.prisma.downloadTask.findUnique({
            where: { id: taskId },
            select: { extractArchive: true, deleteArchiveAfterExtract: true },
        });

        const status = DownloadService.computeFinalTaskStatus(completedCount, failedCount, totalCount);

        await this.prisma.downloadTask.update({
            where: { id: taskId },
            data: { status, finishedAt: new Date(), completedItems: completedCount, failedItems: failedCount },
        });

        this.logger.log(`下载任务完成: taskId=${Number(taskId)} status=${status} completed=${completedCount} failed=${failedCount}`);

        // 清理历史任务
        try {
            await this.cleanOldTasks();
        } catch (e) {
            this.logger.error('清理历史任务失败', e);
        }
    }

    /**
     * 根据子项状态统计计算任务最终状态
     */
    private static computeFinalTaskStatus(completedCount: number, failedCount: number, totalCount: number): string {
        const processedCount = completedCount + failedCount;
        if (processedCount === 0) return 'FAILED';
        if (failedCount === 0 && processedCount === totalCount) return 'COMPLETED';
        return 'PARTIAL';
    }

    /**
     * 查询任务进度
     */
    async getTaskProgress(taskId: number) {
        const task = await this.prisma.downloadTask.findUnique({
            where: { id: BigInt(taskId) },
            include: {
                items: {
                    select: {
                        fullName: true,
                        status: true,
                        localFilePath: true,
                        extractDir: true,
                        fileSize: true,
                        errorMessage: true,
                    },
                },
            },
        });

        if (!task) return { success: false, message: '任务不存在' };

        const completedItems = task.items.filter((i) => i.status === 'COMPLETED').length;
        const failedItems = task.items.filter((i) => i.status === 'FAILED').length;
        const processingItems = task.items.filter((i) => i.status === 'PROCESSING').length;
        const total = task.items.length;
        const processed = completedItems + failedItems;

        let status = task.status;
        if (task.status !== 'PROCESSING' && task.status !== 'PENDING') {
            status = DownloadService.computeFinalTaskStatus(completedItems, failedItems, total);
        }

        const progress = total > 0 ? Math.round((processed * 100) / total) : 0;

        const failedDetails = task.items.filter((i) => i.status === 'FAILED').map((i) => ({ fullName: i.fullName, error: i.errorMessage }));

        const processingDetails = task.items
            .filter((i) => i.status === 'PROCESSING')
            .map((i) => ({ fullName: i.fullName, localFilePath: i.localFilePath }));

        return {
            success: true,
            taskId: Number(task.id),
            status,
            targetDir: task.targetDir,
            concurrency: task.concurrency,
            mirrorSources: this.parseMirrorSources(task.mirrorSource),
            extractArchive: task.extractArchive,
            deleteAfterExtract: task.deleteArchiveAfterExtract,
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
            // 为每个项添加已下载字节数（PROCESSING 项 stat 本地文件，COMPLETED = fileSize）
            allItems: await Promise.all(
                task.items.map(async (item) => {
                    let downloadedBytes = item.fileSize ? Number(item.fileSize) : 0;
                    if (item.status === 'PROCESSING' && item.localFilePath) {
                        try {
                            const stats = await stat(item.localFilePath);
                            downloadedBytes = stats.size;
                        } catch {
                            downloadedBytes = 0;
                        }
                    }
                    return { ...item, downloadedBytes };
                }),
            ),
        };
    }

    /**
     * 重试失败项
     */
    async retryFailed(taskId: number) {
        if (this.running) {
            return { success: false, message: '当前有任务正在执行，请稍后再试' };
        }

        const task = await this.prisma.downloadTask.findUnique({
            where: { id: BigInt(taskId) },
            select: { id: true, targetDir: true, deleteArchiveAfterExtract: true },
        });

        if (!task) return { success: false, message: '任务不存在' };

        const taskTargetDir = task.targetDir;

        const items = await this.prisma.downloadTaskItem.findMany({
            where: { taskId: BigInt(taskId), status: 'FAILED' },
        });

        if (!items.length) return { success: false, message: '没有需要重试的项' };

        // 先删除旧文件
        for (const item of items) {
            await this.removeItemFiles(item.localFilePath, item.extractDir, taskTargetDir);
        }

        // 重新检测所有失败项的分支，优先从数据库读取，DB 没有再通过网络探测
        const token = await this.getGitHubToken();
        const updatedItems = await Promise.all(
            items.map(async (item) => {
                const fullName = item.fullName || '';
                const { owner, repoName } = parseFullName(fullName);

                // 优先从数据库取 defaultBranch
                let defaultBranch: string | null = null;
                if (item.repoId) {
                    try {
                        const repoInfo = await this.prisma.githubRepo.findUnique({
                            where: { id: item.repoId },
                            select: { defaultBranch: true },
                        });
                        defaultBranch = repoInfo?.defaultBranch ?? null;
                    } catch {
                        /* 静默 */
                    }
                }

                // DB 没有 → 网络探测
                if (!defaultBranch) {
                    defaultBranch = await this.detectDefaultBranch(owner, repoName, token);
                    // 探测到的分支写回数据库
                    if (defaultBranch && item.repoId) {
                        try {
                            await this.prisma.githubRepo
                                .update({
                                    where: { id: item.repoId },
                                    data: { defaultBranch },
                                })
                                .catch(() => {});
                        } catch {
                            /* 静默 */
                        }
                    }
                }

                const safeFileName = defaultBranch
                    ? `${owner}_${repoName}-${defaultBranch}.zip`.replace(/[<>:"/\\|?*]/g, '_')
                    : `${owner}_${repoName}.zip`.replace(/[<>:"/\\|?*]/g, '_');
                const downloadDir = path.join(taskTargetDir, owner);
                const localFilePath = path.join(downloadDir, safeFileName);
                const archiveUrl = defaultBranch
                    ? `https://github.com/${owner}/${repoName}/archive/refs/heads/${defaultBranch}.zip`
                    : `https://github.com/${owner}/${repoName}/archive/HEAD.zip`;
                const extractDir = path.join(taskTargetDir, owner, repoName);

                return {
                    id: item.id,
                    fullName,
                    archiveUrl,
                    localFilePath,
                    extractDir,
                    defaultBranch,
                };
            }),
        );

        await this.prisma.$transaction([
            // 每个失败项单独更新（archiveUrl/localFilePath 可能不同）
            ...updatedItems.map((item) =>
                this.prisma.downloadTaskItem.update({
                    where: { id: item.id },
                    data: {
                        status: 'PENDING',
                        errorMessage: null,
                        retryCount: { increment: 1 },
                        archiveUrl: item.archiveUrl,
                        localFilePath: item.localFilePath,
                        defaultBranch: item.defaultBranch,
                        extractDir: item.extractDir,
                    },
                }),
            ),
            this.prisma.downloadTask.update({
                where: { id: BigInt(taskId) },
                data: { status: 'PENDING', startedAt: null, finishedAt: null },
            }),
        ]);

        this.logger.log(`下载任务重试: taskId=${taskId} failed=${items.length}`);
        return { success: true, taskId, message: `已重置 ${items.length} 项失败项` };
    }

    /**
     * 重置整个下载任务
     */
    async resetTask(taskId: number) {
        const task = await this.prisma.downloadTask.findUnique({
            where: { id: BigInt(taskId) },
            select: { id: true, status: true, targetDir: true },
        });

        if (!task) return { success: false, message: '任务不存在' };

        if (this.running && this.currentTaskId === BigInt(taskId)) {
            this.logger.warn(`重置正在执行的任务，强制释放锁: taskId=${taskId}`);
            this.forceReleaseLock();
        } else if (this.running) {
            this.logger.warn(`重置操作跳过锁释放：当前运行的是 taskId=${this.currentTaskId}，与目标 taskId=${taskId} 不同`);
        }

        const failedItems = await this.prisma.downloadTaskItem.findMany({
            where: { taskId: BigInt(taskId), status: 'FAILED' },
            select: { id: true, localFilePath: true, extractDir: true, fullName: true },
        });

        const taskTargetDir = task.targetDir;

        for (const item of failedItems) {
            await this.removeItemFiles(item.localFilePath, item.extractDir, taskTargetDir);
        }

        await this.prisma.$transaction([
            this.prisma.downloadTaskItem.updateMany({
                where: { taskId: BigInt(taskId) },
                data: { status: 'PENDING', errorMessage: null, retryCount: 0 },
            }),
            this.prisma.downloadTask.update({
                where: { id: BigInt(taskId) },
                data: { status: 'PENDING', startedAt: null, finishedAt: null },
            }),
        ]);

        this.logger.log(`下载任务已重置: taskId=${taskId} previousStatus=${task.status}`);
        return { success: true, taskId, message: '任务已重置' };
    }

    /**
     * 重试单个下载项
     */
    async retryItem(taskId: number, fullName: string) {
        if (this.running) {
            return { success: false, message: '当前有任务正在执行，请稍后再试' };
        }

        const [task, item] = await Promise.all([
            this.prisma.downloadTask.findUnique({
                where: { id: BigInt(taskId) },
                select: { id: true, targetDir: true },
            }),
            this.prisma.downloadTaskItem.findFirst({
                where: { taskId: BigInt(taskId), fullName },
            }),
        ]);

        if (!task) return { success: false, message: '任务不存在' };
        if (!item) return { success: false, message: '未找到该任务项' };

        const taskTargetDir = task.targetDir;

        if (item.status === 'PROCESSING') {
            return { success: false, message: '任务正在执行中，无法重试' };
        }

        await this.removeItemFiles(item.localFilePath, item.extractDir, taskTargetDir);

        // 重新检测分支：优先从数据库读取，DB 没有再通过网络探测
        const { owner, repoName } = parseFullName(fullName);
        let defaultBranch: string | null = null;
        if (item.repoId) {
            try {
                const repoInfo = await this.prisma.githubRepo.findUnique({
                    where: { id: item.repoId },
                    select: { defaultBranch: true },
                });
                defaultBranch = repoInfo?.defaultBranch ?? null;
            } catch {
                /* 静默 */
            }
        }
        if (!defaultBranch) {
            const token = await this.getGitHubToken();
            defaultBranch = await this.detectDefaultBranch(owner, repoName, token);
            if (defaultBranch && item.repoId) {
                try {
                    await this.prisma.githubRepo
                        .update({
                            where: { id: item.repoId },
                            data: { defaultBranch },
                        })
                        .catch(() => {});
                } catch {
                    /* 静默 */
                }
            }
        }

        const safeFileName = defaultBranch
            ? `${owner}_${repoName}-${defaultBranch}.zip`.replace(/[<>:"/\\|?*]/g, '_')
            : `${owner}_${repoName}.zip`.replace(/[<>:"/\\|?*]/g, '_');
        const downloadDir = path.join(taskTargetDir, owner);
        const localFilePath = path.join(downloadDir, safeFileName);
        const archiveUrl = defaultBranch
            ? `https://github.com/${owner}/${repoName}/archive/refs/heads/${defaultBranch}.zip`
            : `https://github.com/${owner}/${repoName}/archive/HEAD.zip`;
        const extractDir = path.join(taskTargetDir, owner, repoName);

        try {
            await this.prisma.$transaction(async (tx) => {
                const updated = await tx.downloadTaskItem.updateMany({
                    where: { id: item.id, status: { notIn: ['PROCESSING', 'PENDING'] } },
                    data: {
                        status: 'PENDING',
                        errorMessage: null,
                        retryCount: { increment: 1 },
                        archiveUrl,
                        localFilePath,
                        defaultBranch,
                        extractDir,
                    },
                });
                if (updated.count === 0) {
                    throw new Error('任务项正在执行中或已是待执行状态，无法重试');
                }
                await tx.downloadTask.update({
                    where: { id: BigInt(taskId) },
                    data: { status: 'PENDING', startedAt: null, finishedAt: null },
                });
            });
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            return { success: false, message: msg };
        }

        this.logger.log(`下载项重试: taskId=${taskId} fullName=${fullName} -> ${defaultBranch}`);
        return { success: true, message: `已重置 ${fullName}（分支: ${defaultBranch}），等待重新执行` };
    }

    /**
     * 手动解压已下载的压缩包
     *
     * 任务只负责下载 zip 文件，解压由用户在任务列表中手动触发。
     * 解压目录根据 fullName 动态计算：{targetDir}/{owner}/{repoName}
     */
    async extractItemFile(taskId: number, fullName: string): Promise<{ success: boolean; message?: string }> {
        const task = await this.prisma.downloadTask.findUnique({
            where: { id: BigInt(taskId) },
            select: { targetDir: true },
        });
        if (!task) return { success: false, message: '任务不存在' };

        const item = await this.prisma.downloadTaskItem.findFirst({
            where: { taskId: BigInt(taskId), fullName },
        });
        if (!item) return { success: false, message: '未找到该任务项' };
        if (item.status !== 'COMPLETED') return { success: false, message: '仅可解压已下载完成的压缩包' };
        if (!item.localFilePath) return { success: false, message: '压缩包路径为空' };

        if (!existsSync(item.localFilePath)) {
            return { success: false, message: '压缩包文件不存在' };
        }

        const { owner, repoName } = parseFullName(fullName);
        const extractDir = path.join(task.targetDir, owner, repoName);
        const markerFile = path.join(extractDir, EXTRACT_MARKER_FILE);

        // 路径安全校验
        if (!this.isPathWithinTargetDir(extractDir, task.targetDir)) {
            return { success: false, message: '提取路径安全校验失败' };
        }

        this.logger.log(`开始手动解压: ${fullName} -> ${extractDir}`);
        const result = await this.extractWithRetry(item.localFilePath, extractDir, fullName);

        if (result.success) {
            // 写入解压完成标记，与批量解压保持一致
            try {
                await writeFile(markerFile, new Date().toISOString(), 'utf8');
            } catch (e: unknown) {
                this.logger.warn(`写入解压标记失败: ${fullName} | ${e instanceof Error ? e.message : String(e)}`);
            }
            this.logger.log(`手动解压成功: ${fullName}`);
            return { success: true, message: `解压成功: ${fullName}` };
        }
        return { success: false, message: result.error || '解压失败' };
    }

    /**
     * 一键解压任务中所有已完成项的压缩包
     *
     * 逻辑：
     * 1. 仅允许对 COMPLETED / PARTIAL 状态的任务操作
     * 2. 只处理 COMPLETED 状态的任务项（跳过失败/等待项）
     * 3. 跳过已解压过的项（extractDir 目录已存在）
     * 4. 逐项解压，汇总结果
     *
     * @param taskId - 任务 ID
     * @returns { success, message, extracted, skipped, failed, details }
     */
    /**
     * 一键解压所有已完成项（异步后台执行，立即返回）
     *
     * 解压在后台逐步进行，可通过 getExtractAllProgress 查询进度。
     */
    /**
     * 一键解压所有已完成项（异步后台执行，立即返回）
     *
     * 解压在后台逐步进行，可通过 getExtractAllProgress 查询进度。
     */
    async extractAllItems(taskId: number): Promise<{
        success: boolean;
        message: string;
    }> {
        if (this.extractProgress.has(taskId)) {
            const p = this.extractProgress.get(taskId)!;
            if (p.status === 'extracting') {
                return { success: false, message: '该任务正在后台解压中，请稍候' };
            }
            // 已完成但保留在 Map 中 → 清理旧记录后重新开始
            this.extractProgress.delete(taskId);
        }

        const task = await this.prisma.downloadTask.findUnique({
            where: { id: BigInt(taskId) },
            select: { id: true, status: true, targetDir: true },
        });
        if (!task) return { success: false, message: '任务不存在' };
        if (task.status === 'PROCESSING' || task.status === 'PENDING') {
            return { success: false, message: '任务正在执行中，请等待完成后再解压' };
        }

        const completedItems = await this.prisma.downloadTaskItem.findMany({
            where: { taskId: BigInt(taskId), status: 'COMPLETED' },
            select: { fullName: true, localFilePath: true },
        });
        if (completedItems.length === 0) {
            return { success: false, message: '没有可解压的已完成项' };
        }

        // 初始化进度
        this.extractProgress.set(taskId, {
            status: 'extracting',
            total: completedItems.length,
            current: 0,
            extracted: 0,
            skipped: 0,
            failed: 0,
            details: [],
            message: `解压中: 0/${completedItems.length}`,
        });

        // 后台异步执行，不阻塞返回（使用 IIFE 替代 .catch() 链）
        void (async () => {
            try {
                await this.runExtractAllInBackground(taskId, completedItems, task.targetDir);
            } catch (e: unknown) {
                const errMsg = e instanceof Error ? e.message : String(e);
                this.logger.error(`后台批量解压异常: taskId=${taskId}`, e instanceof Error ? e : new Error(String(e)));
                const p = this.extractProgress.get(taskId);
                if (p) {
                    p.status = 'completed';
                    p.message = `解压异常: ${errMsg}`;
                }
            }
        })();

        this.logger.log(`后台批量解压已启动: taskId=${taskId} items=${completedItems.length}`);
        return { success: true, message: '后台解压已开始，可在任务列表中查看进度' };
    }

    /**
     * 查询批量解压进度
     */
    getExtractAllProgress(taskId: number): {
        success: boolean;
        status?: 'extracting' | 'completed';
        total?: number;
        current?: number;
        extracted?: number;
        skipped?: number;
        failed?: number;
        details?: Array<{ fullName: string; status: string; message?: string }>;
        message?: string;
    } {
        const p = this.extractProgress.get(taskId);
        if (!p) return { success: false, message: '没有进行中的解压任务或记录已过期' };
        return {
            success: true,
            status: p.status,
            total: p.total,
            current: p.current,
            extracted: p.extracted,
            skipped: p.skipped,
            failed: p.failed,
            details: p.details,
            message: p.message,
        };
    }

    /**
     * 在后台逐项解压，更新进度
     */
    private async runExtractAllInBackground(
        taskId: number,
        items: Array<{ fullName: string | null; localFilePath: string | null }>,
        targetDir: string,
    ) {
        for (const item of items) {
            const p = this.extractProgress.get(taskId);
            if (!p) break; // Map 被清理，终止执行

            p.current++;

            const result = await this.processExtractOneItem(taskId, item, targetDir);
            if (!result) break; // Map 在执行过程中被清理

            if (result.status === 'skip') {
                p.skipped++;
            } else if (result.status === 'fail') {
                p.failed++;
            } else {
                p.extracted++;
            }
            p.details.push({ fullName: result.fullName, status: result.status, message: result.message });
            this.updateExtractProgressMessage(taskId);
        }

        // 完成
        const p = this.extractProgress.get(taskId);
        if (p) {
            p.status = 'completed';
            p.message = `解压完成: 成功 ${p.extracted} 个, 跳过 ${p.skipped} 个, 失败 ${p.failed} 个`;
            this.logger.log(`后台批量解压完成: taskId=${taskId} | ${p.message}`);
        }
    }

    /**
     * 更新解压进度消息
     */
    private updateExtractProgressMessage(taskId: number) {
        const p = this.extractProgress.get(taskId);
        if (!p) return;
        p.message = `解压中: ${p.current}/${p.total}（成功 ${p.extracted} 跳过 ${p.skipped} 失败 ${p.failed}）`;
    }

    /**
     * 清理不完整解压目录
     *
     * @param extractDir - 目标解压目录
     * @returns true 清理成功，false 清理失败
     */
    /**
     * ZIP 炸弹预检：检查压缩包大小、条目数、未压缩总量是否在安全范围内
     *
     * @param zipPath - ZIP 文件路径
     * @returns 校验结果，success=false 时携带错误信息
     */
    private async precheckZipBomb(zipPath: string): Promise<{
        success: boolean;
        error?: string;
    }> {
        try {
            const stats = await stat(zipPath);
            const MAX_ZIP_SIZE = 500 * 1024 * 1024; // 压缩文件上限 500 MB
            if (stats.size > MAX_ZIP_SIZE) {
                const sizeMB = (stats.size / 1024 / 1024).toFixed(1);
                return { success: false, error: `压缩包过大 (${sizeMB} MB)，超过 500 MB 上限` };
            }
        } catch {
            return { success: false, error: '无法读取压缩包信息' };
        }

        try {
            const zip = new AdmZip(zipPath);
            const entries = zip.getEntries();

            if (entries.length === 0) {
                return { success: false, error: 'ZIP 文件为空' };
            }

            // 条目数上限检查
            const MAX_ENTRIES = 100_000;
            if (entries.length > MAX_ENTRIES) {
                return { success: false, error: `ZIP 条目过多 (${entries.length})，超过 ${MAX_ENTRIES} 上限` };
            }

            // 未压缩总大小上限检查
            const MAX_UNCOMPRESSED_MB = 1000;
            const totalUncompressed = entries.reduce((sum, e) => {
                const header = e.header as { size?: number };
                return sum + (header.size ?? 0);
            }, 0);
            if (totalUncompressed > MAX_UNCOMPRESSED_MB * 1024 * 1024) {
                const sizeMB = (totalUncompressed / 1024 / 1024).toFixed(1);
                return { success: false, error: `ZIP 未压缩总大小过大 (${sizeMB} MB)，超过 ${MAX_UNCOMPRESSED_MB} MB 上限` };
            }
        } catch {
            return { success: false, error: '无法读取 ZIP 文件信息' };
        }

        return { success: true };
    }

    private async cleanIncompleteExtractDir(extractDir: string): Promise<boolean> {
        try {
            await rm(extractDir, { recursive: true, force: true });
            return true;
        } catch {
            return false;
        }
    }

    /**
     * 处理单项解压（包含前置检查、目录准备、执行解压）
     *
     * 处理逻辑：
     * 1. 检查压缩包文件是否存在
     * 2. 验证 ZIP 文件完整性
     * 3. 检查目标目录是否已完整解压（通过标记文件判断）
     * 4. 路径安全校验
     * 5. 执行解压
     * 6. 写入解压完成标记
     *
     * @returns 解压结果（fullName/status/message），Map 被清理时返回 null
     */
    private async processExtractOneItem(
        taskId: number,
        item: { fullName: string | null; localFilePath: string | null },
        targetDir: string,
    ): Promise<{ fullName: string; status: 'success' | 'skip' | 'fail'; message?: string } | null> {
        const p = this.extractProgress.get(taskId);
        if (!p) return null;

        const fullName = item.fullName || '';

        // 压缩包文件不存在
        if (!item.localFilePath || !existsSync(item.localFilePath)) {
            return { fullName, status: 'skip', message: '压缩包文件不存在' };
        }

        // 验证 ZIP 文件完整性
        if (!isValidZipFile(item.localFilePath)) {
            return { fullName, status: 'fail', message: '压缩包文件损坏，不是有效的 ZIP 格式' };
        }

        const { owner, repoName } = parseFullName(fullName);
        const extractDir = path.join(targetDir, owner, repoName);
        const markerFile = path.join(extractDir, EXTRACT_MARKER_FILE);

        // 检查是否已完整解压
        if (existsSync(extractDir)) {
            if (existsSync(markerFile)) {
                return { fullName, status: 'skip', message: '已解压，跳过' };
            }
            // 半成品目录 → 清理后重试
            this.logger.warn(`检测到不完整解压目录，清理后重试: ${fullName}`);
            const cleaned = await this.cleanIncompleteExtractDir(extractDir);
            if (!cleaned) {
                return { fullName, status: 'fail', message: '清理不完整解压目录失败' };
            }
        }

        // 路径安全校验
        if (!this.isPathWithinTargetDir(extractDir, targetDir)) {
            return { fullName, status: 'fail', message: '提取路径安全校验失败' };
        }

        // 执行解压
        this.logger.log(`后台解压: ${fullName} -> ${extractDir}`);
        const result = await this.extractWithRetry(item.localFilePath, extractDir, fullName);

        if (result.success) {
            // 写入解压完成标记
            try {
                await writeFile(markerFile, new Date().toISOString(), 'utf8');
            } catch (e: unknown) {
                this.logger.warn(`写入解压标记失败: ${fullName} | ${e instanceof Error ? e.message : String(e)}`);
            }
            return { fullName, status: 'success' };
        }

        // 解压失败 → 清理半成品目录
        try {
            if (existsSync(extractDir)) {
                await rm(extractDir, { recursive: true, force: true });
            }
        } catch {
            // 清理失败不影响主流程
        }
        return { fullName, status: 'fail', message: result.error || '解压失败' };
    }

    /**
     * 手动删除已下载的压缩包
     *
     * 用户下载完成后，若不需要保留压缩包，可手动删除。
     * 只删除 zip 文件，不影响已解压的目录。
     */
    async deleteItemZipFile(taskId: number, fullName: string): Promise<{ success: boolean; message?: string }> {
        const item = await this.prisma.downloadTaskItem.findFirst({
            where: { taskId: BigInt(taskId), fullName },
        });
        if (!item) return { success: false, message: '未找到该任务项' };
        if (item.status !== 'COMPLETED') return { success: false, message: '仅可删除已下载完成的压缩包' };
        if (!item.localFilePath) return { success: false, message: '压缩包路径为空' };

        if (!existsSync(item.localFilePath)) {
            return { success: false, message: `压缩包文件不存在: ${item.localFilePath}` };
        }

        try {
            await rm(item.localFilePath, { force: true });
            this.logger.log(`已删除压缩包: ${fullName} -> ${item.localFilePath}`);
            return { success: true, message: `已删除压缩包: ${fullName}` };
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            return { success: false, message: `删除失败: ${msg}` };
        }
    }

    /**
     * 删除文件/目录（三层兜底）
     */
    private async removeItemFiles(localFilePath: string | null, extractDir: string | null, taskTargetDir?: string): Promise<void> {
        // 删除压缩文件
        if (localFilePath && this.isPathWithinTargetDir(localFilePath, taskTargetDir)) {
            try {
                if (existsSync(localFilePath)) {
                    await rm(localFilePath, { force: true });
                }
            } catch {
                // 忽略
            }
        }

        // 删除解压目录
        if (extractDir && this.isPathWithinTargetDir(extractDir, taskTargetDir)) {
            try {
                if (existsSync(extractDir)) {
                    await rm(extractDir, { recursive: true, force: true });
                }
            } catch {
                // 忽略
            }
        }
    }

    /**
     * 删除下载任务
     */
    async deleteTask(taskId: number) {
        const task = await this.prisma.downloadTask.findUnique({
            where: { id: BigInt(taskId) },
            select: { id: true, status: true },
        });

        if (!task) return { success: false, message: '任务不存在' };

        if (task.status === 'PROCESSING' && this.running && this.currentTaskId === BigInt(taskId)) {
            this.logger.warn(`删除正在执行的任务，强制释放锁: taskId=${taskId}`);
            this.forceReleaseLock();
        }

        await this.prisma.downloadTaskItem.deleteMany({ where: { taskId: BigInt(taskId) } });
        await this.prisma.downloadTask.delete({ where: { id: BigInt(taskId) } });

        this.logger.log(`下载任务已删除: taskId=${taskId} previousStatus=${task.status}`);
        return { success: true, taskId, message: '任务已删除' };
    }

    /**
     * 获取最近任务列表
     */
    async getRecentTasks() {
        const tasks = await this.prisma.downloadTask.findMany({
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

                let status = t.status;
                if (t.status !== 'PROCESSING' && t.status !== 'PENDING') {
                    status = DownloadService.computeFinalTaskStatus(completedItems, failedItems, total);
                }

                return {
                    taskId: Number(t.id),
                    status,
                    targetDir: t.targetDir,
                    concurrency: t.concurrency,
                    mirrorSources: this.parseMirrorSources(t.mirrorSource),
                    extractArchive: t.extractArchive,
                    deleteAfterExtract: t.deleteArchiveAfterExtract,
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
     * 清理历史任务
     */
    private async cleanOldTasks() {
        const old = await this.prisma.downloadTask.findMany({
            where: { status: { in: ['COMPLETED', 'FAILED', 'PARTIAL'] } },
            orderBy: { createdAt: 'desc' },
            skip: MAX_HISTORY_TASKS,
            take: 1000,
            select: { id: true },
        });

        if (old.length > 0) {
            this.logger.log(`清理 ${old.length} 条历史下载任务`);
        }

        for (const t of old) {
            await this.prisma.downloadTaskItem.deleteMany({ where: { taskId: t.id } });
            await this.prisma.downloadTask.delete({ where: { id: t.id } });
        }
    }

    /**
     * 验证 ZIP 完整性
     */
    async validateDownloadedFile(taskId: number, fullName: string): Promise<{ success: boolean; message?: string }> {
        const item = await this.prisma.downloadTaskItem.findFirst({
            where: { taskId: BigInt(taskId), fullName },
        });

        if (!item) return { success: false, message: '未找到该任务项' };
        if (item.status !== 'COMPLETED') return { success: false, message: '任务项尚未完成' };

        const filePath = item.localFilePath;
        if (!filePath || !existsSync(filePath)) {
            return { success: false, message: '文件不存在' };
        }

        if (!isValidZipFile(filePath)) {
            return { success: false, message: '文件不是有效的 ZIP 文件' };
        }

        try {
            const zip = new AdmZip(filePath);
            const entryCount = zip.getEntries().length;
            return { success: true, message: `ZIP 验证通过，包含 ${entryCount} 个文件条目` };
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            return { success: false, message: `ZIP 损坏: ${msg}` };
        }
    }
}
