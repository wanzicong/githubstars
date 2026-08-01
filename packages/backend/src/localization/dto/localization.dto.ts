import { z } from 'zod';

/** 待翻译内容查询：返回尚未中文化的原文（描述 / README）供智能体翻译 */
export const LocalizationPendingQuerySchema = z.object({
    limit: z.number().int().min(1).max(200).default(50),
    includeDescription: z.boolean().default(true),
    includeReadme: z.boolean().default(true),
});

export type LocalizationPendingQueryDto = z.infer<typeof LocalizationPendingQuerySchema>;

/** 单条译文更新项：repoId + 至少一个中文字段 */
export const LocalizationUpdateItemSchema = z.object({
    repoId: z.number().int().positive(),
    descriptionCn: z.string().max(20000).optional(),
    readmeCn: z.string().max(2_000_000).optional(),
});

export const LocalizationUpdateSchema = z.object({
    items: z.array(LocalizationUpdateItemSchema).min(1).max(500),
});

export type LocalizationUpdateDto = z.infer<typeof LocalizationUpdateSchema>;
