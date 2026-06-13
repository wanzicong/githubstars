import { Controller, Get, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AppService } from './app.service';

/**
 * 应用根控制器
 *
 * 提供根路径（/）的健康检查接口，返回欢迎信息。
 */
@ApiTags('健康检查')
@Controller()
export class AppController {
    private readonly logger = new Logger(AppController.name);

    constructor(private readonly appService: AppService) {}

    /**
     * 根路径健康检查
     *
     * @returns 返回 "Hello World!" 字符串，用于验证服务是否正常运行
     */
    @Get()
    @ApiOperation({ summary: '健康检查' })
    getHello(): string {
        this.logger.log('[API] GET / 健康检查请求');
        return this.appService.getHello();
    }
}
