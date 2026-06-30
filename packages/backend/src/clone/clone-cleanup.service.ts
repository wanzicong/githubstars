import { Injectable, Logger } from '@nestjs/common';
import { rm, rename } from 'fs/promises';
import { existsSync } from 'fs';
import { execFile } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as os from 'os';

const execFileAsync = promisify(execFile);

/**
 * 克隆模块清理子服务
 *
 * 负责删除克隆目录、杀死卡住的 Git 进程等清理操作。
 * 独立抽取以减小 clone.service.ts 的体积。
 *
 * @callers
 *   - CloneService — 任务重置、重试、执行
 *   - CloneExecutorService — 克隆失败后清理
 */
@Injectable()
export class CloneCleanupService {
    private readonly logger = new Logger(CloneCleanupService.name);

    /**
     * 三层兜底删除克隆目录（Layer 1）：直接删除
     * 适用于常规情况，约 95% 的删除操作在此层成功。
     */
    async removeCloneDirLayer1(localPath: string): Promise<boolean> {
        for (let attempt = 0; attempt < 3; attempt++) {
            try {
                if (existsSync(localPath)) {
                    await rm(localPath, { recursive: true, force: true });
                    return true;
                }
                return true;
            } catch (e: unknown) {
                const msg = e instanceof Error ? e.message : String(e);
                this.logger.warn(`removeCloneDir Layer1 失败 (attempt=${attempt + 1}): ${msg}`);
                if (attempt < 2) await new Promise((r) => setTimeout(r, 1000));
            }
        }
        return false;
    }

    /**
     * 三层兜底删除克隆目录（Layer 2）：杀死 Git 进程后重试
     * 适用于 Layer 1 失败（目录被 Git 进程锁定），
     * 杀死所有在该目录下的 Git 进程后再尝试删除。
     */
    async removeCloneDirLayer2(localPath: string): Promise<boolean> {
        try {
            await this.killGitProcessesInDir(localPath);
            await new Promise((r) => setTimeout(r, 500));
            if (existsSync(localPath)) {
                await rm(localPath, { recursive: true, force: true });
                return true;
            }
            return true;
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            this.logger.warn(`removeCloneDir Layer2 失败: ${msg}`);
            return false;
        }
    }

    /**
     * 三层兜底删除克隆目录（Layer 3）：重命名后删除
     * 适用于 Layer 2 也失败（文件句柄未被释放），
     * 先将目录重命名为随机名，再异步删除（不等待结果）。
     */
    async removeCloneDirLayer3(localPath: string): Promise<boolean> {
        try {
            const timestamp = Date.now();
            const renamedPath = localPath + '.remove.' + timestamp;
            if (existsSync(localPath)) {
                await rename(localPath, renamedPath);
                // 异步删除，不等待结果
                rm(renamedPath, { recursive: true, force: true }).catch(() => {});
                return true;
            }
            return true;
        } catch {
            return false;
        }
    }

    /**
     * 三层兜底删除克隆目录
     *
     * 按 Layer1 → Layer2 → Layer3 依次尝试，任意一层成功即返回。
     */
    async removeCloneDir(localPath: string): Promise<boolean> {
        if (!localPath) return false;
        if (await this.removeCloneDirLayer1(localPath)) return true;
        if (await this.removeCloneDirLayer2(localPath)) return true;
        return this.removeCloneDirLayer3(localPath);
    }

    /**
     * 杀死在指定目录下运行的 Git 进程
     *
     * 跨平台实现：Windows 使用 taskkill，Unix 使用 process.kill。
     */
    async killGitProcessesInDir(localPath: string) {
        try {
            const isWindows = os.platform() === 'win32';
            if (isWindows) {
                // Windows 上直接 taskkill /F /IM 所有 git.exe 进程
                // 然后等待 500ms 让文件锁释放
                const escapedPath = localPath.replace(/'/g, "'\\''");
                const psScript = `Get-CimInstance -Query "SELECT * FROM Win32_Process WHERE Name='git.exe' AND CommandLine LIKE '%${escapedPath.replace(/\\/g, '\\\\')}%'" | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`;
                try {
                    await execFileAsync('powershell', ['-Command', psScript], { timeout: 5000 });
                } catch {
                    // 忽略
                }
            } else {
                // Unix 上通过 fuser 或 lsof 查找，然后 kill
                try {
                    const { stdout } = await execFileAsync('fuser', [localPath], { timeout: 3000 });
                    const pids = stdout.trim().split(/\s+/).filter(Boolean);
                    for (const pid of pids) {
                        try {
                            process.kill(Number.parseInt(pid, 10), 'SIGTERM');
                        } catch {
                            // 进程可能已结束
                        }
                    }
                } catch {
                    // 没有 fuser 或没有进程在目录上
                }
            }
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            this.logger.warn(`killGitProcessesInDir 失败: ${msg}`);
        }
    }

    /**
     * 查找备用克隆路径
     *
     * 当目标路径已存在非 Git 目录时，生成备用路径避免冲突。
     */
    findAlternateClonePath(localPath: string): string {
        for (let i = 1; i < 100; i++) {
            const altPath = `${localPath}_${i}`;
            if (!existsSync(altPath)) return altPath;
        }
        return `${localPath}_${Date.now()}`;
    }

    /**
     * 清理失败的克隆目录
     */
    async cleanFailedCloneDir(localPath: string): Promise<void> {
        try {
            if (existsSync(localPath)) {
                await rm(localPath, { recursive: true, force: true });
            }
        } catch {
            // 忽略清理失败
        }
    }
}
