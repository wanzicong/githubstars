import { Controller, Post, Body, HttpException, HttpStatus } from '@nestjs/common';
import { CloneService } from './clone.service';
import { CreateCloneTaskSchema, CloneTaskIdSchema, RetryItemSchema } from './clone.dto';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

@Controller('api/clone')
export class CloneController {
    constructor(private readonly cloneService: CloneService) {}

    /**
     * 创建克隆任务
     */
    @Post()
    async createTask(@Body() body: unknown) {
        const parsed = CreateCloneTaskSchema.safeParse(body);
        if (!parsed.success) {
            throw new HttpException(
                { success: false, message: parsed.error.issues[0]?.message || '参数错误' },
                HttpStatus.BAD_REQUEST,
            );
        }
        return this.cloneService.createTask(parsed.data);
    }

    /**
     * 获取最近任务列表
     */
    @Post('tasks/list')
    async getRecentTasks() {
        return this.cloneService.getRecentTasks();
    }

    /**
     * 查询任务进度详情
     */
    @Post('tasks/detail')
    async getTaskProgress(@Body() body: unknown) {
        const parsed = CloneTaskIdSchema.safeParse(body);
        if (!parsed.success) {
            throw new HttpException(
                { success: false, message: '任务 ID 无效' },
                HttpStatus.BAD_REQUEST,
            );
        }
        return this.cloneService.getTaskProgress(parsed.data.id);
    }

    /**
     * 重试失败项
     */
    @Post('tasks/retry')
    async retryFailed(@Body() body: unknown) {
        const parsed = CloneTaskIdSchema.safeParse(body);
        if (!parsed.success) {
            throw new HttpException(
                { success: false, message: '任务 ID 无效' },
                HttpStatus.BAD_REQUEST,
            );
        }
        return this.cloneService.retryFailed(parsed.data.id);
    }

    /**
     * 重试单个任务项
     */
    @Post('tasks/retry-item')
    async retryItem(@Body() body: unknown) {
        const parsed = RetryItemSchema.safeParse(body);
        if (!parsed.success) {
            throw new HttpException(
                { success: false, message: parsed.error.issues[0]?.message || '参数错误' },
                HttpStatus.BAD_REQUEST,
            );
        }
        return this.cloneService.retryItem(parsed.data.id, parsed.data.fullName);
    }

    /**
     * 打开系统目录选择对话框
     *
     * 使用 PowerShell 调用 Windows 原生文件夹选择器，返回用户选择的完整路径。
     */
    @Post('select-directory')
    async selectDirectory() {
        try {
            const script = `
                Add-Type -AssemblyName System.Windows.Forms
                $dialog = New-Object System.Windows.Forms.FolderBrowserDialog
                $dialog.Description = "选择克隆目标目录"
                $dialog.ShowNewFolderButton = $true
                $result = $dialog.ShowDialog()
                if ($result -eq [System.Windows.Forms.DialogResult]::OK) {
                    $dialog.SelectedPath
                }
            `;
            const { stdout } = await execFileAsync('powershell', [
                '-NoProfile',
                '-NonInteractive',
                '-ExecutionPolicy', 'Bypass',
                '-Command', script,
            ], { timeout: 60000, windowsHide: false });

            const selectedPath = stdout.trim();
            if (!selectedPath) {
                return { success: false, message: '未选择目录' };
            }

            return { success: true, path: selectedPath };
        } catch (error: any) {
            return { success: false, message: error.message || '选择目录失败' };
        }
    }
}
