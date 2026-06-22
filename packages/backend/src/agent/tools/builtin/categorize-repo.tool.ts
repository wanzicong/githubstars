import { Injectable, Logger } from '@nestjs/common';
import { ITool, ToolRiskLevel, ToolExecutionContext } from '../tool.interface';
import { PrismaService } from '../../../prisma/prisma.service';

/**
 * 仓库分类工具。
 *
 * 为指定仓库设置分类标签。
 */
@Injectable()
export class CategorizeRepoTool implements ITool {
    readonly name = 'categorize_repo';
    readonly displayName = '仓库分类';
    readonly description = '为指定仓库设置分类标签。支持一级和二级分类。';
    readonly source = 'builtin' as const;
    readonly riskLevel = ToolRiskLevel.MEDIUM;
    readonly inputSchema = {
        type: 'object',
        properties: {
            repoFullName: { type: 'string', description: '仓库全名，格式 owner/repo' },
            categoryName: { type: 'string', description: '分类名称' },
        },
        required: ['repoFullName', 'categoryName'],
    };

    private readonly logger = new Logger(CategorizeRepoTool.name);

    constructor(private readonly prisma: PrismaService) {}

    async execute(input: Record<string, unknown>, _context: ToolExecutionContext): Promise<unknown> {
        const repoFullName = input.repoFullName as string;
        const categoryName = input.categoryName as string;

        if (!repoFullName || !categoryName) {
            return { error: 'repoFullName and categoryName are required' };
        }

        this.logger.log(`[categorize_repo] repo=${repoFullName} category=${categoryName}`);

        try {
            // 查找仓库
            const repo = await this.prisma.githubRepo.findFirst({
                where: { fullName: repoFullName },
            });
            if (!repo) {
                return { success: false, error: `Repository "${repoFullName}" not found` };
            }

            // 查找或创建分类
            let category = await this.prisma.category.findFirst({
                where: { name: categoryName },
            });
            if (!category) {
                category = await this.prisma.category.create({
                    data: {
                        name: categoryName,
                        sortOrder: 0,
                        createdAt: new Date(),
                    },
                });
            }

            // 创建关联
            await this.prisma.categoryRepoLink.create({
                data: {
                    categoryId: category.id,
                    repoId: repo.id,
                    createdAt: new Date(),
                },
            });

            return {
                success: true,
                repo: repoFullName,
                category: categoryName,
                message: `已为仓库 ${repoFullName} 添加分类「${categoryName}」`,
            };
        } catch (error) {
            if ((error as { code?: string }).code === 'P2002') {
                return { success: true, message: '分类关联已存在' };
            }
            return { success: false, error: (error as Error).message };
        }
    }
}
