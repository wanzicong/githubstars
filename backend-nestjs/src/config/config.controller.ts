import { Controller, Get, Post, Body } from '@nestjs/common';
import { ConfigService } from './config.service';

@Controller('api/config')
export class ConfigController {
    constructor(private readonly configService: ConfigService) {}

    @Get()
    async getAll() {
        return this.configService.listAll();
    }

    @Post()
    async save(@Body() body: Record<string, string>) {
        try {
            await this.configService.batchUpdate(body);
            return { success: true, message: '保存成功' };
        } catch (e) {
            return { success: false, message: '保存失败: ' + (e instanceof Error ? e.message : String(e)) };
        }
    }
}
