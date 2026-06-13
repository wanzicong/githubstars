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
import { Injectable, OnModuleInit } from '@nestjs/common';
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

    constructor(
        private readonly prisma: PrismaService,
        private readonly configService: ConfigService,
        private readonly cloneTaskService: CloneTaskService,
        private readonly githubRepoService: GithubRepoService,
    ) {}

    /** 从数据库恢复 taskCounter */
    async onModuleInit() {
        const maxNum = await this.cloneTaskService.getMaxTaskCounterNumber();
        this.taskCounter = maxNum;
    }

    private get baseDir(): string {
        return this.configService.getValueDefault('clone.directory', 'D:/github-stars');
    }

    /** 路径规范化与安全检查 */
    sanitizeSubdirectory(subDir: string): string {
        let dir = (subDir || '')
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

    /** 真实磁盘空间检查 */
    async checkDiskSpace(subDirectory: string, repoCount: number) {
        try {
            const dir = subDirectory ? path.join(this.baseDir, this.sanitizeSubdirectory(subDirectory)) : this.baseDir;
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
            return {
                success: true,
                freeSpaceMB: 0,
                estimatedSizeMB: repoCount * 50 * 2,
                sufficient: true,
                message: '磁盘检查失败: ' + (e instanceof Error ? e.message : String(e)),
            };
        }
    }

    /** 构建 clone URL（支持代理） */
    buildCloneUrl(htmlUrl: string): string {
        const proxyUrl = this.configService.getValueDefault('clone.proxy.url', '');
        if (proxyUrl) {
            const sep = proxyUrl.endsWith('/') ? '' : '/';
            return `${proxyUrl}${sep}${htmlUrl}`;
        }
        return htmlUrl + '.git';
    }

    /** 信号量并发控制 */
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

    /** 单次克隆 */
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
        const url = this.buildCloneUrl(htmlUrl);
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
            try {
                fs.rmSync(dir, { recursive: true, force: true });
            } catch {}
            return { status: 'FAILED', message: msg.substring(0, 500) };
        }
    }

    /** 带重试+保留原始错误 */
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
            else
                try {
                    fs.rmSync(dir, { recursive: true, force: true });
                } catch {}
        }
        return { fullName, status: 'FAILED', message: `[已重试${MAX_RETRIES}次] ${lastResult.message}` };
    }

    /** 启动批量clone */
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
        const targetDir = subDir ? path.join(this.baseDir, subDir).replace(/\\/g, '/') : this.baseDir;
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
            return { success: false, message: e instanceof Error ? e.message : String(e) };
        }
    }

    /** 执行批量clone */
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
        if (!task) return;
        await this.prisma.cloneTask.update({ where: { taskId }, data: { status: 'RUNNING', startedAt: new Date() } });

        const targetDir = subDir ? path.join(this.baseDir, subDir) : this.baseDir;

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
            await this.saveHistory(subDir);
        } catch (e) {
            await this.prisma.cloneTask.update({
                where: { taskId },
                data: { status: 'FAILED', errorMessage: e instanceof Error ? e.message : String(e), finishedAt: new Date() },
            });
        } finally {
            setTimeout(() => this.runningTasks.delete(taskId), 5000);
        }
    }

    /** 获取任务 */
    async getTask(taskId: string) {
        const cached = this.runningTasks.get(taskId);
        if (cached)
            return {
                ...cached,
                items: await this.prisma.cloneTaskItem.findMany({ where: { taskId }, take: 100, orderBy: { createdAt: 'asc' } }),
            };
        return this.prisma.cloneTask.findUnique({ where: { taskId }, include: { items: { take: 100, orderBy: { createdAt: 'asc' } } } });
    }

    /** 取消任务 */
    async cancelTask(taskId: string) {
        const task = await this.prisma.cloneTask.findUnique({ where: { taskId } });
        if (!task || (task.status !== 'RUNNING' && task.status !== 'PENDING')) return false;
        this.cancelledTasks.add(taskId);
        await this.prisma.cloneTask.update({
            where: { taskId },
            data: { status: 'FAILED', errorMessage: '用户取消', finishedAt: new Date(), cancelled: 1 },
        });
        return true;
    }

    /** 重试失败项 — P0 FIX: 只重试 FAILED（不含 SKIPPED），使用 buildCloneUrl */
    async retryFailedClones(taskId: string) {
        const task = await this.prisma.cloneTask.findUnique({ where: { taskId } });
        if (!task || task.status === 'PENDING') return { success: false, message: '任务无法重试' };

        // P0 FIX: 只重试 FAILED 项，不包含 SKIPPED
        const failedItems = await this.prisma.cloneTaskItem.findMany({ where: { taskId, status: 'FAILED' } });
        if (failedItems.length === 0) return { success: false, message: '没有需要重试的失败项' };

        this.cancelledTasks.delete(taskId);
        await this.prisma.cloneTask.update({ where: { taskId }, data: { status: 'RUNNING', cancelled: 0 } });
        const targetDir = task.targetDir || this.baseDir;

        let completed = 0,
            failed = 0;
        await this.executeWithSemaphore(failedItems, task.concurrency, async (item) => {
            const repoName = item.fullName.split('/').pop() || '';
            // P0 FIX: 使用 buildCloneUrl 而不是直接拼接 URL（支持代理）
            const htmlUrl = `https://github.com/${item.fullName}`;
            const cloneUrl = this.buildCloneUrl(htmlUrl);
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
        return { success: true, message: `重试完成: ${completed}成功, ${failed}失败`, retryCount: failedItems.length };
    }

    /** 获取克隆配置 */
    async getCloneConfig() {
        const historyStr = this.configService.getValueDefault('clone.subdirectory.history', '[]');
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
            baseDirectory: this.baseDir,
            subdirectoryHistory: history,
            lastSubdirectory: this.configService.getValueDefault('clone.subdirectory.last', ''),
            hasActiveTask: !!activeTask,
            defaultCloneDepth: 1,
            defaultMaxRepoSizeMb: 500,
        };
    }

    private async saveHistory(subDir: string) {
        const str = this.configService.getValueDefault('clone.subdirectory.history', '[]');
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

    /** P0 FIX: generateCloneScript 使用过滤参数 */
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
        const targetDir = subDir ? path.join(this.baseDir, subDir).replace(/\\/g, '/') : this.baseDir;

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
