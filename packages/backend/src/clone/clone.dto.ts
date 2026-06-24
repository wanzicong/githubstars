import { z } from 'zod';
import { CLONE_CONCURRENCY_OPTIONS, GITHUB_MIRROR_SOURCES } from './clone.constants';

/** 镜像代理源名称列表（用于验证） */
const MIRROR_SOURCE_NAMES = GITHUB_MIRROR_SOURCES.map((s) => s.name) as [string, ...string[]];

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
    /** 镜像代理源名称，为空或 'direct' 表示不使用代理 */
    mirrorSource: z.enum(MIRROR_SOURCE_NAMES).optional().default('direct'),
});

export type CreateCloneTaskDto = z.infer<typeof CreateCloneTaskSchema>;

/** 查询任务详情请求验证 */
export const CloneTaskIdSchema = z.object({
    id: z.coerce.number().int().positive(),
});

export type CloneTaskIdDto = z.infer<typeof CloneTaskIdSchema>;

/** 重试单个任务项请求验证 */
export const RetryItemSchema = z.object({
    id: z.coerce.number().int().positive(),
    fullName: z.string().min(1, '仓库全名不能为空'),
});

export type RetryItemDto = z.infer<typeof RetryItemSchema>;
