import { Injectable, Logger } from '@nestjs/common';
import { ITool, ToolRiskLevel, ToolExecutionContext } from '../tool.interface';
import { PrismaService } from '../../../prisma/prisma.service';

/**
 * 仓库详情工具。
 */
@Injectable()
export class DataRepoDetailTool implements ITool {
    readonly name = 'data_get_repo_detail';
    readonly displayName = '获取仓库详情';
    readonly description = '获取指定仓库的完整详情信息。';
    readonly source = 'builtin' as const;
    readonly riskLevel = ToolRiskLevel.LOW;
    readonly inputSchema = {
        type: 'object',
        properties: {
            fullName: { type: 'string', description: '仓库全名 owner/repo' },
        },
        required: ['fullName'],
    };

    private readonly logger = new Logger(DataRepoDetailTool.name);

    constructor(private readonly prisma: PrismaService) {}

    async execute(input: Record<string, unknown>, _context: ToolExecutionContext): Promise<unknown> {
        const fullName = input.fullName as string;
        if (!fullName) return { found: false, message: 'fullName is required' };

        this.logger.log(`[data_get_repo_detail] fullName=${fullName}`);

        const repo = await this.prisma.githubRepo.findFirst({
            where: { fullName },
            select: {
                id: true, fullName: true, description: true, descriptionCn: true,
                readmeCn: true, language: true, starsCount: true, forksCount: true,
                ownerName: true, ownerAvatarUrl: true, htmlUrl: true, homepage: true,
                topics: true, licenseName: true, isFork: true, isArchived: true,
                repoCreatedAt: true, repoUpdatedAt: true, starredAt: true,
            },
        });

        if (!repo) return { found: false, message: 'Repository not found' };

        return {
            found: true,
            ...repo,
            id: Number(repo.id),
            hasReadmeCn: !!repo.readmeCn,
            hasDescriptionCn: !!repo.descriptionCn,
        };
    }
}
