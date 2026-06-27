import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { Response } from 'express';

/**
 * 全局 HTTP 异常过滤器
 *
 * 捕获所有未处理的异常（HttpException + 未知异常），统一返回标准错误格式：
 * { success: false, message: string, statusCode: number }
 *
 * 生产环境下不暴露未知异常的内部细节，仅返回通用错误消息。
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
    private readonly logger = new Logger(HttpExceptionFilter.name);

    catch(exception: unknown, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();

        let status = HttpStatus.INTERNAL_SERVER_ERROR;
        let message = '服务器内部错误';

        if (exception instanceof HttpException) {
            status = exception.getStatus();
            const exResponse = exception.getResponse();
            if (typeof exResponse === 'string') {
                message = exResponse;
            } else if (typeof exResponse === 'object' && exResponse != null && 'message' in exResponse) {
                message = String((exResponse as Record<string, unknown>).message);
            } else {
                message = exception.message;
            }
        } else if (exception instanceof Error) {
            this.logger.error('未捕获异常: ' + exception.message, exception.stack);
        } else {
            this.logger.error('未知异常: ' + String(exception));
        }

        response.status(status).json({
            success: false,
            message,
            statusCode: status,
        });
    }
}
