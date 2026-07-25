import { z } from 'zod';
import { PaginationSchema } from '../common/dto/pagination.dto';

/**
 * 学习收藏模块 DTO
 *
 * 状态/优先级在应用层用 z.enum 约束，数据库层用 String 存储
 * （与项目现有 TranslationTask/CloneTask 模式一致）。
 */

// ── 常量定义 ──

export const LEARN_STATUSES = ['WANT', 'LEARNING', 'DONE', 'SHELVED'] as const;
export type LearnStatus = (typeof LEARN_STATUSES)[number];

export const LEARN_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH'] as const;
export type LearnPriority = (typeof LEARN_PRIORITIES)[number];

const StatusSchema = z.enum(LEARN_STATUSES);
const PrioritySchema = z.enum(LEARN_PRIORITIES);

// ── 学习记录 CRUD ──

/** 列表查询 */
export const LearnListSchema = PaginationSchema.extend({
    status: StatusSchema.optional(),
    priority: PrioritySchema.optional(),
    categoryId: z.coerce.number().int().positive().optional(),
    tagIds: z.array(z.coerce.number().int().positive()).optional(),
    keyword: z.string().max(200).optional().default(''),
    sortBy: z.enum(['createdAt', 'updatedAt', 'priority', 'starsCount', 'starredAt']).optional().default('createdAt'),
    sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});
export type LearnListDto = z.infer<typeof LearnListSchema>;

/** 详情 */
export const LearnDetailSchema = z.object({
    id: z.coerce.number().int().positive('学习记录 ID 必须为正整数'),
});
export type LearnDetailDto = z.infer<typeof LearnDetailSchema>;

/** 创建（把 repo 加入学习清单） */
export const LearnCreateSchema = z.object({
    repoId: z.coerce.number().int().positive('仓库 ID 必须为正整数'),
    status: StatusSchema.optional().default('WANT'),
    priority: PrioritySchema.optional().default('MEDIUM'),
    notes: z.string().max(5000, '笔记最长 5000 字符').optional().nullable(),
    tagIds: z.array(z.coerce.number().int().positive()).optional().default([]),
});
export type LearnCreateDto = z.infer<typeof LearnCreateSchema>;

/** 更新 */
export const LearnUpdateSchema = z.object({
    id: z.coerce.number().int().positive('学习记录 ID 必须为正整数'),
    status: StatusSchema.optional(),
    priority: PrioritySchema.optional(),
    notes: z.string().max(5000, '笔记最长 5000 字符').optional().nullable(),
    tagIds: z.array(z.coerce.number().int().positive()).optional(),
});
export type LearnUpdateDto = z.infer<typeof LearnUpdateSchema>;

/** 删除 */
export const LearnDeleteSchema = z.object({
    id: z.coerce.number().int().positive('学习记录 ID 必须为正整数'),
});
export type LearnDeleteDto = z.infer<typeof LearnDeleteSchema>;

/** 在 StarList 页一键加入学习（默认 WANT/MEDIUM） */
export const LearnQuickAddSchema = z.object({
    repoId: z.coerce.number().int().positive('仓库 ID 必须为正整数'),
});
export type LearnQuickAddDto = z.infer<typeof LearnQuickAddSchema>;

/** 根据 repoId 列表批量查询哪些已加入学习（用于 StarList 卡片书签高亮） */
export const LearnCheckReposSchema = z.object({
    repoIds: z.array(z.coerce.number().int().positive()).max(500, '单次最多查询 500 个'),
});
export type LearnCheckReposDto = z.infer<typeof LearnCheckReposSchema>;

// ── 标签 CRUD ──

/** 标签创建 */
export const LearnTagCreateSchema = z.object({
    name: z.string().min(1, '标签名不能为空').max(50, '标签名最长 50 字符'),
    color: z
        .string()
        .regex(/^#[0-9a-fA-F]{6}$/, '颜色必须是 #RRGGBB 格式')
        .optional()
        .nullable(),
});
export type LearnTagCreateDto = z.infer<typeof LearnTagCreateSchema>;

/** 标签更新 */
export const LearnTagUpdateSchema = z.object({
    id: z.coerce.number().int().positive('标签 ID 必须为正整数'),
    name: z.string().min(1).max(50).optional(),
    color: z
        .string()
        .regex(/^#[0-9a-fA-F]{6}$/)
        .optional()
        .nullable(),
});
export type LearnTagUpdateDto = z.infer<typeof LearnTagUpdateSchema>;

/** 标签删除 */
export const LearnTagDeleteSchema = z.object({
    id: z.coerce.number().int().positive('标签 ID 必须为正整数'),
});
export type LearnTagDeleteDto = z.infer<typeof LearnTagDeleteSchema>;
