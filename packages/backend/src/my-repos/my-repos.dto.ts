import { z } from 'zod';
import { PaginationSchema } from '../common/dto/pagination.dto';

/**
 * 我的仓库列表查询参数
 *
 * 与 Star 仓库的 FilterSchema 对齐，额外支持 isPrivate 私有筛选。
 */
export const MyRepoListSchema = PaginationSchema.extend({
    keyword: z.string().optional().default(''),
    language: z.string().optional().default(''),
    sortBy: z.string().optional().default('repo_updated_at'),
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
    /** 私有筛选：true=仅私有，false=仅公开，缺省=全部 */
    isPrivate: z
        .union([z.boolean(), z.string()])
        .optional()
        .transform((v) => (v === undefined ? undefined : v === true || v === 'true')),
});

export type MyRepoListDto = z.infer<typeof MyRepoListSchema>;

/** 我的仓库详情/单条操作参数 */
export const MyRepoIdSchema = z.object({
    id: z.coerce.number().int().positive('仓库 ID 必须为正整数'),
});

export type MyRepoIdDto = z.infer<typeof MyRepoIdSchema>;

/** 按 ID 列表批量获取参数 */
export const MyRepoIdsSchema = z.object({
    ids: z.array(z.coerce.number().int().positive()).min(1, 'ids 不能为空').max(1000, 'ids 最多 1000 条'),
});

export type MyRepoIdsDto = z.infer<typeof MyRepoIdsSchema>;

/** 分类绑定/解绑参数 */
export const MyRepoCategoryBindSchema = z.object({
    categoryId: z.coerce.number().int().positive('分类 ID 必须为正整数'),
    repoIds: z.array(z.coerce.number().int().positive()).min(1, 'repoIds 不能为空').max(1000, 'repoIds 最多 1000 条'),
});

export type MyRepoCategoryBindDto = z.infer<typeof MyRepoCategoryBindSchema>;

/** 待翻译记录查询参数 */
export const MyRepoPendingLocalizationSchema = z.object({
    limit: z.coerce.number().int().min(1).max(200).optional().default(50),
    includeDescription: z
        .union([z.boolean(), z.string()])
        .optional()
        .transform((v) => v === undefined || v === true || v === 'true'),
    includeReadme: z
        .union([z.boolean(), z.string()])
        .optional()
        .transform((v) => v === undefined || v === true || v === 'true'),
});

export type MyRepoPendingLocalizationDto = z.infer<typeof MyRepoPendingLocalizationSchema>;

/** 译文回写参数（与 agent 翻译流水线的 updateTranslations 同构） */
export const MyRepoLocalizationSchema = z.object({
    items: z
        .array(
            z.object({
                repoId: z.coerce.number().int().positive(),
                descriptionCn: z.string().optional(),
                readmeCn: z.string().optional(),
            }),
        )
        .min(1, 'items 不能为空')
        .max(200, 'items 最多 200 条'),
});

export type MyRepoLocalizationDto = z.infer<typeof MyRepoLocalizationSchema>;
