import { z } from 'zod';
import { PaginationSchema } from '../common/dto/pagination.dto';

/**
 * 分类管理 DTO 定义 — 所有分类 API 的 Zod Schema 与类型。
 *
 * 遵循项目规范：
 * - 全部使用 Zod Schema 验证
 * - 继承 PaginationSchema 复用分页参数
 * - 所有查询参数使用 POST + @Body() 传递
 */

// ── 分类树 ──

/** 分类树查询参数（无额外参数） */
export const CategoryTreeSchema = z.object({});

export type CategoryTreeDto = z.infer<typeof CategoryTreeSchema>;

// ── 分类列表 ──

/** 分类列表查询参数 */
export const CategoryListSchema = PaginationSchema.extend({
    keyword: z.string().optional().default(''),
});

export type CategoryListDto = z.infer<typeof CategoryListSchema>;

// ── 分类 CRUD ──

/** 创建分类参数 */
export const CategoryCreateSchema = z.object({
    name: z.string().min(1, '分类名称不能为空').max(100, '分类名称最长100字符'),
    parentId: z.coerce.number().int().positive('父分类ID必须为正整数').optional().nullable(),
    sortOrder: z.coerce.number().int().min(0).default(0),
    icon: z.string().max(100, '图标最长100字符').optional().nullable(),
    description: z.string().max(1000, '描述最长1000字符').optional().nullable(),
});

export type CategoryCreateDto = z.infer<typeof CategoryCreateSchema>;

/** 更新分类参数 */
export const CategoryUpdateSchema = z.object({
    id: z.coerce.number().int().positive('分类ID必须为正整数'),
    name: z.string().min(1, '分类名称不能为空').max(100, '分类名称最长100字符').optional(),
    parentId: z.coerce.number().int().positive('父分类ID必须为正整数').optional().nullable(),
    sortOrder: z.coerce.number().int().min(0).optional(),
    icon: z.string().max(100, '图标最长100字符').optional().nullable(),
    description: z.string().max(1000, '描述最长1000字符').optional().nullable(),
});

export type CategoryUpdateDto = z.infer<typeof CategoryUpdateSchema>;

/** 删除分类参数 */
export const CategoryDeleteSchema = z.object({
    id: z.coerce.number().int().positive('分类ID必须为正整数'),
});

export type CategoryDeleteDto = z.infer<typeof CategoryDeleteSchema>;

// ── 分类排序 ──

/** 分类排序参数 */
export const CategorySortSchema = z.object({
    items: z
        .array(
            z.object({
                id: z.coerce.number().int().positive('分类ID必须为正整数'),
                sortOrder: z.coerce.number().int().min(0),
            }),
        )
        .min(1, '至少需要一个分类项'),
});

export type CategorySortDto = z.infer<typeof CategorySortSchema>;

// ── 分类仓库 ──

/** 分类仓库列表查询参数 */
export const CategoryReposSchema = PaginationSchema.extend({
    categoryId: z.coerce.number().int().positive('分类ID必须为正整数'),
    keyword: z.string().optional().default(''),
    language: z.string().optional().default(''),
    sortBy: z.string().optional().default('stars_count'),
    sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

export type CategoryReposDto = z.infer<typeof CategoryReposSchema>;

/** 绑定仓库到分类参数 */
export const CategoryBindSchema = z.object({
    categoryId: z.coerce.number().int().positive('分类ID必须为正整数'),
    repoIds: z.array(z.coerce.number().int().positive('仓库ID必须为正整数')).min(1, '至少需要一个仓库ID'),
});

export type CategoryBindDto = z.infer<typeof CategoryBindSchema>;

/** 解绑仓库从分类参数 */
export const CategoryUnbindSchema = z.object({
    categoryId: z.coerce.number().int().positive('分类ID必须为正整数'),
    repoIds: z.array(z.coerce.number().int().positive('仓库ID必须为正整数')).min(1, '至少需要一个仓库ID'),
});

export type CategoryUnbindDto = z.infer<typeof CategoryUnbindSchema>;
