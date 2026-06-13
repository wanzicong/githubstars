import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ConfigService implements OnModuleInit {
    private readonly defaults: Array<{ key: string; value: string; description: string }> = [
        { key: 'github.username', value: 'wanzicong', description: 'GitHub 用户名' },
        { key: 'github.token', value: '', description: 'GitHub Personal Access Token' },
        { key: 'deepseek.api_key', value: '', description: 'DeepSeek API Key' },
        { key: 'deepseek.api_url', value: 'https://api.deepseek.com/v1/chat/completions', description: 'DeepSeek API 地址' },
        { key: 'deepseek.model', value: 'deepseek-chat', description: 'DeepSeek 模型名称' },
        { key: 'clone.directory', value: 'D:/github-stars', description: 'Clone 目标目录' },
        { key: 'clone.proxy.url', value: '', description: 'Clone 代理 URL 前缀' },
        { key: 'clone.subdirectory.history', value: '[]', description: '子目录历史' },
        { key: 'clone.subdirectory.last', value: '', description: '上次使用的子目录' },
    ];

    constructor(private readonly prisma: PrismaService) {}

    async onModuleInit() {
        await this.ensureDefaults();
    }

    /** 首次启动时写入默认配置（仅当配置项不存在时） */
    private async ensureDefaults() {
        for (const cfg of this.defaults) {
            const existing = await this.prisma.systemConfig.findUnique({ where: { configKey: cfg.key } });
            if (!existing) {
                await this.prisma.systemConfig.create({
                    data: { configKey: cfg.key, configValue: cfg.value, description: cfg.description, createdAt: new Date() },
                });
            } else if (!existing.description) {
                await this.prisma.systemConfig.update({ where: { configKey: cfg.key }, data: { description: cfg.description } });
            }
        }
    }

    /** 每次调用直接从数据库读取最新值 */
    async getValue(key: string): Promise<string | undefined> {
        const row = await this.prisma.systemConfig.findUnique({ where: { configKey: key }, select: { configValue: true } });
        return row?.configValue ?? undefined;
    }

    /** 每次调用直接从数据库读取，不存在时返回 defaultValue */
    async getValueDefault(key: string, defaultValue: string): Promise<string> {
        const row = await this.prisma.systemConfig.findUnique({ where: { configKey: key }, select: { configValue: true } });
        return row?.configValue || defaultValue;
    }

    async listAll() {
        const configs = await this.prisma.systemConfig.findMany({ orderBy: { id: 'asc' } });
        return configs.map((c) => {
            const raw = c.configValue || '';
            let display = raw;
            let sensitive = false;
            const key = c.configKey.toLowerCase();
            if (key.includes('token') || key.includes('api_key')) {
                sensitive = true;
                display = raw.length > 8 ? raw.substring(0, 4) + '****' + raw.substring(raw.length - 4) : '****';
            }
            return {
                id: Number(c.id),
                configKey: c.configKey,
                configValue: raw,
                displayValue: display,
                sensitive,
                description: c.description,
            };
        });
    }

    async update(key: string, value: string) {
        const existing = await this.prisma.systemConfig.findUnique({ where: { configKey: key } });
        if (existing) {
            await this.prisma.systemConfig.update({ where: { configKey: key }, data: { configValue: value, updatedAt: new Date() } });
        } else {
            await this.prisma.systemConfig.create({ data: { configKey: key, configValue: value, createdAt: new Date() } });
        }
    }

    async batchUpdate(updates: Record<string, string>) {
        for (const [k, v] of Object.entries(updates)) {
            await this.update(k, v);
        }
    }
}
