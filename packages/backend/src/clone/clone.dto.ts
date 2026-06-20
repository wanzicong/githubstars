import { z } from 'zod';
import { CLONE_CONCURRENCY_OPTIONS } from './clone.constants';

/** 创建克隆任务请求验证 */
export const CreateCloneTaskSchema = z.object({
    repoIds: z.array(z.coerce.number().int().positive()).min(1, '至少选择一个仓库'),
    targetDir: z.string().min(1, '目标目录不能为空').max(1000),
    concurrency: z.union([
        z.literal(CLONE_CONCURRENCY_OPTIONS[0]),
        z.literal(CLONE_CONCURRENCY_OPTIONS[1]),
        z.literal(CLONE_CONCURRENCY_OPTIONS[2]),
    ]).default(CLONE_CONCURRENCY_OPTIONS[0]),
    shallow: z.boolean().optional().default(true),
});

export type CreateCloneTaskDto = z.infer<typeof CreateCloneTaskSchema>;

/** 查询任务详情请求验证 */
export const CloneTaskIdSchema = z.object({
    id: z.coerce.number().int().positive(),
});

export type CloneTaskIdDto = z.infer<typeof CloneTaskIdSchema>;
