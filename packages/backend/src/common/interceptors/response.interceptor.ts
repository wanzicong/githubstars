import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import type { Response } from 'express';

/**
 * 全局响应拦截器
 *
 * 统一包装 HTTP 响应为标准信封格式：{ success: true, data: ... }
 *
 * 跳过规则（透传原始响应）：
 * - 响应已包含 success 字段（业务层已自行包装）
 * - SSE（text/event-stream）响应
 * - 文件下载（Content-Disposition 头存在）
 * - 字符串/Buffer 原始响应
 */
@Injectable()
export class ResponseInterceptor implements NestInterceptor {
    intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
        const response = context.switchToHttp().getResponse<Response>();

        return next.handle().pipe(
            map((data) => {
                // 跳过 SSE 流式响应
                const contentType = response.getHeader('Content-Type');
                if (typeof contentType === 'string' && contentType.includes('text/event-stream')) {
                    return data;
                }

                // 跳过文件下载响应
                if (response.getHeader('Content-Disposition')) {
                    return data;
                }

                // 跳过字符串/Buffer 原始响应
                if (typeof data === 'string' || Buffer.isBuffer(data)) {
                    return data;
                }

                // 跳过 null/undefined
                if (data === null || data === undefined) {
                    return { success: true, data: null };
                }

                // 已包含 success 字段 → 透传（业务层已自行包装）
                if (typeof data === 'object' && 'success' in data) {
                    return data;
                }

                // 分页响应：包含 records + total 字段
                if (typeof data === 'object' && 'records' in data && 'total' in data) {
                    const { records, total, size, current, pages, ...rest } = data as Record<string, unknown>;
                    return {
                        success: true,
                        data: records,
                        meta: { total, size, current, pages, ...rest },
                    };
                }

                // 数组响应
                if (Array.isArray(data)) {
                    return { success: true, data, meta: { total: data.length } };
                }

                // 普通对象响应
                return { success: true, data };
            }),
        );
    }
}
