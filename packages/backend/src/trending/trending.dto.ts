import { z } from 'zod';
import { TrendingSchema } from '../common/dto/filter.dto';

/**
 * 下载趋势仓库请求验证
 *
 * 继承 TrendingSchema 的查询参数，追加下载配置参数。
 */
export const DownloadTrendingSchema = TrendingSchema.extend({
    /** 目标下载目录（绝对路径） */
    targetDir: z.string().min(1, '目标目录不能为空').max(1000),
    /** 并发数 */
    concurrency: z.coerce.number().int().min(1).max(50).optional().default(3),
    /** 镜像代理源列表（按优先级排序） */
    mirrorSources: z.array(z.string()).min(1, '至少选择一个镜像源').optional().default(['direct']),
    /** 下载后是否解压 */
    extractArchive: z.boolean().optional().default(true),
    /** 解压后是否删除原压缩文件 */
    deleteAfterExtract: z.boolean().optional().default(true),
});

export type DownloadTrendingDto = z.infer<typeof DownloadTrendingSchema>;
