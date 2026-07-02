import { z } from 'zod';
import { DOWNLOAD_CONCURRENCY_OPTIONS, DEFAULT_CONCURRENCY, DOWNLOAD_MIRROR_SOURCES } from './download.constants';

/** 镜像代理源名称列表（用于验证） */
const MIRROR_SOURCE_NAMES = DOWNLOAD_MIRROR_SOURCES.map((s) => s.name) as [string, ...string[]];

/** 创建下载任务请求验证 */
export const CreateDownloadTaskSchema = z.object({
    repoIds: z.array(z.coerce.number().int().positive()).min(1, '至少选择一个仓库'),
    targetDir: z.string().min(1, '目标目录不能为空').max(1000),
    concurrency: z.coerce
        .number()
        .refine((val) => (DOWNLOAD_CONCURRENCY_OPTIONS as readonly number[]).includes(val), {
            message: `并发数必须是 ${DOWNLOAD_CONCURRENCY_OPTIONS.join(' / ')} 之一`,
        })
        .default(DEFAULT_CONCURRENCY),
    /** 镜像代理源列表（按优先级排序），下载时会按顺序尝试，失败自动回退到下一个源 */
    mirrorSources: z.array(z.enum(MIRROR_SOURCE_NAMES)).min(1, '至少选择一个镜像源').optional().default(['direct']),
    /** 下载后是否解压 */
    extractArchive: z.boolean().optional().default(true),
    /** 解压后是否删除原压缩文件 */
    deleteAfterExtract: z.boolean().optional().default(true),
});

export type CreateDownloadTaskDto = z.infer<typeof CreateDownloadTaskSchema>;

/** 下载任务 ID 请求验证 */
export const DownloadTaskIdSchema = z.object({
    id: z.coerce.number().int().positive(),
});

export type DownloadTaskIdDto = z.infer<typeof DownloadTaskIdSchema>;

/** 重试单个任务项请求验证 */
export const RetryItemSchema = z.object({
    id: z.coerce.number().int().positive(),
    fullName: z
        .string()
        .min(1, '仓库全名不能为空')
        .regex(/^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/, '仓库全名格式必须为 owner/repo'),
});

/** 提取任务项压缩包请求验证 */
/** 预估下载大小请求验证 */
export const EstimateSizesSchema = z.object({
    repoIds: z.array(z.coerce.number().int().positive()).min(1, '至少提供一个仓库 ID'),
});

export type EstimateSizesDto = z.infer<typeof EstimateSizesSchema>;
export const ExtractItemSchema = z.object({
    taskId: z.coerce.number().int().positive(),
    fullName: z
        .string()
        .min(1, '仓库全名不能为空')
        .regex(/^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/, '仓库全名格式必须为 owner/repo'),
});

/** 删除任务项压缩包请求验证 */
export const DeleteItemFileSchema = z.object({
    taskId: z.coerce.number().int().positive(),
    fullName: z
        .string()
        .min(1, '仓库全名不能为空')
        .regex(/^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/, '仓库全名格式必须为 owner/repo'),
});

/** 批量解压请求验证 */
export const ExtractAllSchema = z.object({
    taskId: z.coerce.number().int().positive(),
});

export type ExtractAllDto = z.infer<typeof ExtractAllSchema>;

export type RetryItemDto = z.infer<typeof RetryItemSchema>;
