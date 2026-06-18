import { z } from 'zod';

/**
 * 通用 ID 参数 Zod schema
 *
 * 自动将字符串类型的 id 转为数字，验证为正整数。
 */
export const IdParamSchema = z.object({
    id: z.coerce.number().int().positive('ID 必须为正整数'),
});

export type IdParamDto = z.infer<typeof IdParamSchema>;
