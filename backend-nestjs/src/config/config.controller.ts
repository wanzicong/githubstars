import { Controller, Get, Post, Body, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody } from '@nestjs/swagger';
import { ConfigService } from './config.service';

/**
 * 系统配置控制器
 *
 * 提供配置项的查询和保存接口，所有路由均挂载在 /api/config 下。
 */
@ApiTags('config')
@Controller('api/config')
export class ConfigController {
    private readonly logger = new Logger(ConfigController.name);

    constructor(private readonly configService: ConfigService) {}

    /**
     * 获取所有配置项
     *
     * 返回包含原始值和脱敏显示值的配置列表，敏感字段自动打码。
     *
     * @returns 配置项数组
     */
    @Get()
    @ApiOperation({ summary: '获取所有配置项', description: '返回包含原始值和脱敏显示值的配置列表，敏感字段（Token/API Key）自动打码' })
    async getAll() {
        return this.configService.listAll();
    }

    /**
     * 保存配置
     *
     * 接收键值对集合，批量写入数据库。更新操作会记录成功/失败状态。
     *
     * @param body 键值对配置数据
     * @returns 包含 success 标志和 message 的结果对象
     */
    @Post()
    @ApiOperation({ summary: '批量保存配置项', description: '接收键值对集合，批量写入 system_config 表' })
    @ApiBody({ description: '键值对配置数据', schema: { type: 'object', additionalProperties: { type: 'string' } } })
    async save(@Body() body: Record<string, string>) {
        try {
            await this.configService.batchUpdate(body);
            this.logger.log('配置保存成功');
            return { success: true, message: '保存成功' };
        } catch (e) {
            const errMsg = e instanceof Error ? e.message : String(e);
            this.logger.error('配置保存失败: ' + errMsg);
            return { success: false, message: '保存失败: ' + errMsg };
        }
    }
}
