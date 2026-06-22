import { Injectable, Logger } from '@nestjs/common';
import { ITool, ToolRiskLevel, ToolExecutionContext } from '../tool.interface';
import { CloneService } from '../../../clone/clone.service';

/**
 * 克隆仓库工具。
 *
 * 高风险工具：Phase 3 需审批。
 */
@Injectable()
export class CloneRepoTool implements ITool {
    readonly name = 'clone_repo';
    readonly displayName = '批量克隆仓库';
    readonly description = '将 GitHub Star 仓库批量克隆到本地目录。';
    readonly source = 'builtin' as const;
    readonly riskLevel = ToolRiskLevel.HIGH;
    readonly inputSchema = {
        type: 'object',
        properties: {
            repoIds: {
                type: 'array', items: { type: 'number' },
                description: '仓库 ID 列表',
            },
            targetDir: { type: 'string', description: '目标目录路径' },
            shallow: { type: 'boolean', description: '浅克隆', default: true },
            concurrency: { type: 'number', description: '并发数', default: 5 },
        },
        required: ['repoIds', 'targetDir'],
    };

    private readonly logger = new Logger(CloneRepoTool.name);

    constructor(private readonly cloneService: CloneService) {}

    async execute(input: Record<string, unknown>, _context: ToolExecutionContext): Promise<unknown> {
        const repoIds = input.repoIds as number[];
        const targetDir = input.targetDir as string;
        const shallow = (input.shallow as boolean) ?? true;
        const concurrency = (input.concurrency as number) || 5;

        if (!repoIds?.length) return { error: 'repoIds is required' };
        if (!targetDir) return { error: 'targetDir is required' };

        this.logger.log(`[clone_repo] repoIds=${repoIds.length} targetDir=${targetDir}`);

        try {
            const result = await this.cloneService.createTask({
                repoIds: repoIds,
                targetDir,
                shallow,
                concurrency: (concurrency as 5 | 10 | 20) || 5,
            });

            return {
                success: result.success,
                taskId: result.taskId,
                message: result.message || 'Clone task created',
            };
        } catch (error) {
            return { success: false, error: (error as Error).message };
        }
    }
}
