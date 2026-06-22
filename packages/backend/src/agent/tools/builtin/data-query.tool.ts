import { Injectable, Logger } from '@nestjs/common';
import { ITool, ToolRiskLevel, ToolExecutionContext } from '../tool.interface';
import { PrismaService } from '../../../prisma/prisma.service';

/**
 * 数据仓库查询工具。
 *
 * 查询本地已 Star 的仓库列表，支持关键词、语言等筛选。
 */
@Injectable()
export class DataQueryStarsTool implements ITool {
    readonly name = 'data_query_stars';
    readonly displayName = '查询 Star 仓库';
    readonly description = '查询本地已 Star 的 GitHub 仓库列表，支持关键词、语言、日期范围筛选和分页。';
    readonly source = 'builtin' as const;
    readonly riskLevel = ToolRiskLevel.LOW;
    readonly inputSchema = {
        type: 'object',
        properties: {
            keyword: { type: 'string', description: '搜索关键词' },
            language: { type: 'string', description: '编程语言筛选，如 TypeScript' },
            page: { type: 'number', description: '页码', default: 1 },
            size: { type: 'number', description: '每页数量', default: 10 },
        },
    };

    private readonly logger = new Logger(DataQueryStarsTool.name);

    constructor(private readonly prisma: PrismaService) {}

    async execute(input: Record<string, unknown>, _context: ToolExecutionContext): Promise<unknown> {
        const keyword = (input.keyword as string) || '';
        const language = (input.language as string) || '';
        const page = Math.max(1, (input.page as number) || 1);
        const size = Math.min((input.size as number) || 10, 50);
        const skip = (page - 1) * size;

        this.logger.log(`[data_query_stars] keyword="${keyword}" language="${language}" page=${page}`);

        const where: Record<string, unknown> = {};
        if (keyword) {
            where.OR = [
                { repoName: { contains: keyword } },
                { fullName: { contains: keyword } },
                { description: { contains: keyword } },
            ];
        }
        if (language) {
            where.language = language;
        }

        const [repos, total] = await Promise.all([
            this.prisma.githubRepo.findMany({
                where: where as any,
                orderBy: { starsCount: 'desc' },
                take: size,
                skip,
                select: {
                    id: true, fullName: true, description: true, descriptionCn: true,
                    language: true, starsCount: true, forksCount: true,
                    ownerName: true, htmlUrl: true, topics: true,
                },
            }),
            this.prisma.githubRepo.count({ where: where as any }),
        ]);

        return {
            total,
            page,
            size,
            repos: repos.map(r => ({
                id: Number(r.id),
                fullName: r.fullName,
                description: r.description,
                language: r.language,
                starsCount: r.starsCount,
                forksCount: r.forksCount,
                ownerName: r.ownerName,
                htmlUrl: r.htmlUrl,
            })),
        };
    }
}
