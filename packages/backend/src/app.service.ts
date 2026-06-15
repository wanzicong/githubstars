import { Injectable, Logger } from '@nestjs/common';

/**
 * 应用根服务
 *
 * 提供应用级别的通用业务逻辑，如健康检查。
 */
@Injectable()
export class AppService {
    private readonly logger = new Logger(AppService.name);

    /**
     * 获取欢迎信息（健康检查）
     *
     * @returns 返回固定的 "Hello World!" 字符串
     */
    getHello(): string {
        this.logger.log('[Service] getHello 被调用');
        return 'Hello World!';
    }
}
