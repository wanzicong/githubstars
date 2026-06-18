import { z } from 'zod';

/**
 * 通用分页参数 Zod schema
 *
 * 自动将字符串类型的 page/size 转为数字，并限制合理范围。
 */
export const PaginationSchema = z
    .object({
        page: z.coerce.number().int().min(1).default(1),
        size: z.coerce.number().int().min(1).max(100).default(12),
    })
    .passthrough();

export type PaginationDto = z.infer<typeof PaginationSchema>;
