import { Injectable, Logger } from '@nestjs/common';
import { ITool, ToolRiskLevel, ToolExecutionContext } from '../tool.interface';
import { PrismaService } from '../../../prisma/prisma.service';
import { ConfigService } from '../../../config/config.service';

/**
 * GitHub README 获取工具。
 *
 * 从 GitHub API 获取 README 内容（需要 GitHub Token）。
 */
@Injectable()
export class GithubReadmeTool implements ITool {
    readonly name = 'github_get_readme';
    readonly displayName = '获取仓库 README';
    readonly description = '从 GitHub API 获取指定仓库的 README 文档原文内容。';
    readonly source = 'builtin' as const;
    readonly riskLevel = ToolRiskLevel.LOW;
    readonly inputSchema = {
        type: 'object',
        properties: {
            fullName: { type: 'string', description: '仓库全名 owner/repo' },
        },
        required: ['fullName'],
    };

    private readonly logger = new Logger(GithubReadmeTool.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly config: ConfigService,
    ) {}

    async execute(input: Record<string, unknown>, _context: ToolExecutionContext): Promise<unknown> {
        const fullName = input.fullName as string;
        if (!fullName) return { error: 'fullName is required' };

        this.logger.log(`[github_get_readme] fullName=${fullName}`);

        // 先查本地数据库的 README
        const repo = await this.prisma.githubRepo.findFirst({
            where: { fullName },
            select: { readmeOriginal: true, readmeCn: true },
        });

        if (repo?.readmeOriginal) {
            return {
                fullName,
                readme: repo.readmeOriginal.substring(0, 10000),
                hasReadme: true,
                source: 'local',
            };
        }

        // 尝试从 GitHub API 获取
        const token = await this.config.getValueDefault('github.token', '');
        if (!token) {
            return { fullName, readme: null, hasReadme: false, error: 'GitHub Token not configured' };
        }

        try {
            const res = await fetch(`https://api.github.com/repos/${fullName}/readme`, {
                headers: {
                    Accept: 'application/vnd.github.v3.raw',
                    Authorization: `Bearer ${token}`,
                    'User-Agent': 'GithubStars-Agent',
                },
            });
            if (res.ok) {
                const text = await res.text();
                return { fullName, readme: text.substring(0, 10000), hasReadme: true, source: 'github' };
            }
            return { fullName, readme: null, hasReadme: false, error: `GitHub API: ${res.status}` };
        } catch (err) {
            return { fullName, readme: null, hasReadme: false, error: (err as Error).message };
        }
    }
}
