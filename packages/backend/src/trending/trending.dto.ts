import { z } from 'zod';
import { TrendingSchema } from '../common/dto/filter.dto';

/**
 * 下载趋势仓库请求验证
 *
 * 继承 TrendingSchema 的查询参数，追加下载配置参数。
 */
export const DownloadTrendingSchema = TrendingSchema.extend({
    /** 目标下载目录（绝对路径） */
    targetDir: z.string().min(1, '目标目录不能为空').max(1000),
    /** 并发数 */
    concurrency: z.coerce.number().int().min(1).max(50).optional().default(3),
    /** 镜像代理源列表（按优先级排序） */
    mirrorSources: z.array(z.string()).min(1, '至少选择一个镜像源').optional().default(['direct']),
    /** 下载后是否解压 */
    extractArchive: z.boolean().optional().default(true),
    /** 解压后是否删除原压缩文件 */
    deleteAfterExtract: z.boolean().optional().default(true),
});

export type DownloadTrendingDto = z.infer<typeof DownloadTrendingSchema>;

/**
 * 确保趋势仓库入库请求验证（加入 Agent 对话上下文前补齐本地 id）
 *
 * 只接受「基础元信息」字段，做轻量 upsert；上限 50 防止批量过大。
 */
export const EnsureTrendingReposSchema = z.object({
    repos: z
        .array(
            z.object({
                fullName: z.string().min(1, '仓库全名不能为空'),
                description: z.string().nullish(),
                descriptionCn: z.string().nullish(),
                language: z.string().nullish(),
                ownerName: z.string().nullish(),
                ownerAvatarUrl: z.string().nullish(),
                htmlUrl: z.string().nullish(),
                homepage: z.string().nullish(),
                starsCount: z.number().int().nonnegative().optional(),
                forksCount: z.number().int().nonnegative().optional(),
                watchersCount: z.number().int().nonnegative().optional(),
                openIssuesCount: z.number().int().nonnegative().optional(),
                topics: z.union([z.array(z.string()), z.string()]).optional(),
                licenseName: z.string().nullish(),
                isFork: z.boolean().optional(),
                isArchived: z.boolean().optional(),
                repoCreatedAt: z.string().nullish(),
                repoUpdatedAt: z.string().nullish(),
                pushedAt: z.string().nullish(),
            }),
        )
        .min(1, '仓库列表不能为空')
        .max(50, '一次最多确保 50 个仓库'),
});

export type EnsureTrendingReposDto = z.infer<typeof EnsureTrendingReposSchema>;
