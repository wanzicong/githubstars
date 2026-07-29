import { z } from 'zod';
import { PaginationSchema } from './pagination.dto';

/**
 * 通用过滤参数 Zod schema
 *
 * 覆盖列表查询中常见的过滤、排序、分页参数，
 * 支持关键词、语言、日期范围、翻译状态等多维度过滤。
 */
export const FilterSchema = PaginationSchema.extend({
    keyword: z.string().optional().default(''),
    language: z.string().optional().default(''),
    sortBy: z.string().optional().default('stars_count'),
    sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
    dateField: z.string().optional().default(''),
    startDate: z
        .string()
        .optional()
        .or(z.null())
        .transform((val) => val ?? ''),
    endDate: z
        .string()
        .optional()
        .or(z.null())
        .transform((val) => val ?? ''),
    untranslatedOnly: z
        .union([z.boolean(), z.string()])
        .optional()
        .transform((v) => v === true || v === 'true'),
    /** 分类筛选：传入分类 ID，含其所有后代分类（递归） */
    categoryId: z.coerce.number().int().positive().optional(),
});

export type FilterDto = z.infer<typeof FilterSchema>;

/**
 * 带 maxCount 的导出过滤参数
 */
export const ExportFilterSchema = FilterSchema.extend({
    maxCount: z.coerce.number().int().min(1).max(2000).optional().default(50),
});

export type ExportFilterDto = z.infer<typeof ExportFilterSchema>;

/**
 * 作者列表查询参数
 */
export const AuthorListSchema = PaginationSchema.extend({
    keyword: z.string().optional().default(''),
});

export type AuthorListDto = z.infer<typeof AuthorListSchema>;

/**
 * 作者结果列表查询参数
 */
export const AuthorReposSchema = PaginationSchema.extend({
    ownerName: z.string().min(1, 'ownerName 不能为空'),
    sortBy: z.string().optional().default('stars_count'),
    sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

export type AuthorReposDto = z.infer<typeof AuthorReposSchema>;

/**
 * 作者导出参数
 */
export const AuthorExportSchema = z.object({
    ownerName: z.string().min(1, 'ownerName 不能为空'),
    sortBy: z.string().optional().default('stars_count'),
    sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

export type AuthorExportDto = z.infer<typeof AuthorExportSchema>;

/**
 * GitHub 搜索参数
 */
export const GithubSearchSchema = z.object({
    keyword: z.string().optional().default(''),
    language: z.string().optional().default(''),
    sort: z.string().optional().default('stars'),
    page: z.coerce.number().int().min(1).default(1),
    perPage: z.coerce.number().int().min(1).max(100).default(20),
});

export type GithubSearchDto = z.infer<typeof GithubSearchSchema>;

/**
 * GitHub Star 操作参数（owner/repo 格式）
 */
export const GithubStarSchema = z.object({
    owner: z.string().min(1, 'owner 不能为空').max(200),
    repo: z.string().min(1, 'repo 不能为空').max(200),
});

export type GithubStarDto = z.infer<typeof GithubStarSchema>;

/**
 * 按仓库 ID Star 操作参数
 */
export const StarByIdSchema = z.object({
    id: z.coerce.number().int().positive('仓库 ID 必须为正整数'),
});

export type StarByIdDto = z.infer<typeof StarByIdSchema>;

/**
 * 仓库 Issues 列表查询参数
 *
 * GitHub Search API 最多返回前 1000 条结果，因此限制 page * perPage。
 */
export const GithubIssueListSchema = z
    .object({
        id: z.coerce.number().int().positive('仓库 ID 必须为正整数'),
        state: z.enum(['open', 'closed', 'all']).optional().default('open'),
        query: z.string().trim().max(200, '搜索内容不能超过 200 个字符').optional().default(''),
        sort: z.enum(['created', 'updated', 'comments']).optional().default('updated'),
        order: z.enum(['asc', 'desc']).optional().default('desc'),
        page: z.coerce.number().int().min(1).optional().default(1),
        perPage: z.coerce.number().int().min(1).max(50).optional().default(20),
    })
    .superRefine((value, context) => {
        if (value.page * value.perPage > 1000) {
            context.addIssue({
                code: 'custom',
                path: ['page'],
                message: 'GitHub Issues 搜索最多支持前 1000 条结果',
            });
        }
    });

export type GithubIssueListDto = z.infer<typeof GithubIssueListSchema>;

/** 仓库 Issue 详情查询参数 */
export const GithubIssueDetailSchema = z.object({
    id: z.coerce.number().int().positive('仓库 ID 必须为正整数'),
    issueNumber: z.coerce.number().int().positive('Issue 编号必须为正整数'),
});

export type GithubIssueDetailDto = z.infer<typeof GithubIssueDetailSchema>;

/**
 * Trending 查询参数
 */
export const TrendingSchema = z.object({
    since: z.string().optional().default('daily'),
    language: z.string().optional().default(''),
    perPage: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export type TrendingDto = z.infer<typeof TrendingSchema>;
