import { z } from 'zod';
import { PaginationSchema } from './pagination.dto';

/**
 * 通用筛选参数 Zod schema
 *
 * 涵盖列表查询中常见的筛选、排序、分页参数，
 * 支持关键词、语言、日期范围、翻译状态等多维度筛选。
 */
export const FilterSchema = PaginationSchema.extend({
    keyword: z.string().optional().default(''),
    language: z.string().optional().default(''),
    sortBy: z.string().optional().default('stars_count'),
    sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
    dateField: z.string().optional().default(''),
    startDate: z.string().optional().default(''),
    endDate: z.string().optional().default(''),
    untranslatedOnly: z
        .union([z.boolean(), z.string()])
        .optional()
        .transform((v) => v === true || v === 'true'),
});

export type FilterDto = z.infer<typeof FilterSchema>;

/**
 * 带 maxCount 的导出筛选参数
 */
export const ExportFilterSchema = FilterSchema.extend({
    maxCount: z.coerce.number().int().min(1).max(200).optional().default(50),
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
 * 作者仓库列表查询参数
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
 * GitHub 操作参数（Star/Unstar/CheckStarred）
 */
export const GithubOwnerRepoSchema = z.object({
    owner: z.string().min(1, 'owner 不能为空'),
    repo: z.string().min(1, 'repo 不能为空'),
});

export type GithubOwnerRepoDto = z.infer<typeof GithubOwnerRepoSchema>;

/**
 * Trending 查询参数
 */
export const TrendingSchema = z.object({
    since: z.string().optional().default('daily'),
    language: z.string().optional().default(''),
    perPage: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export type TrendingDto = z.infer<typeof TrendingSchema>;

/**
 * TopN 参数
 */
export const TopNSchema = z.object({
    topN: z.coerce.number().int().min(1).max(100).optional().default(10),
});

export type TopNDto = z.infer<typeof TopNSchema>;

/**
 * 分页日志查询参数
 */
export const LogPaginationSchema = z.object({
    pageNum: z.coerce.number().int().min(1).optional().default(1),
    pageSize: z.coerce.number().int().min(1).max(100).optional().default(10),
});

export type LogPaginationDto = z.infer<typeof LogPaginationSchema>;

/**
 * 相似仓库查询参数
 */
export const SimilarSchema = z.object({
    repoId: z.coerce.number().int().positive('repoId 必须为正整数'),
});

export type SimilarDto = z.infer<typeof SimilarSchema>;
