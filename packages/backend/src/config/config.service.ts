import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * 系统配置服务
 *
 * 负责管理 system_config 表的读写操作，在模块初始化时自动写入默认配置项。
 * 配置项以键值对形式存储，包含 GitHub、DeepSeek、Clone 等模块的配置。
 * 敏感字段（token/api_key）在列表查询时自动脱敏显示。
 */
@Injectable()
export class ConfigService implements OnModuleInit {
    private readonly logger = new Logger(ConfigService.name);
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

    /**
     * 模块初始化钩子
     *
     * 在 ConfigModule 加载完成后自动调用，确保数据库中存在所有默认配置项。
     */
    async onModuleInit() {
        this.logger.log('ConfigService 初始化: 开始检查默认配置项...');
        await this.ensureDefaults();
        this.logger.log('ConfigService 初始化完成');
    }

    /**
     * 写入默认配置项
     *
     * 遍历预设的默认配置列表，仅当配置项不存在时才插入数据库。
     * 如果配置项已存在但缺少描述字段，则补全描述。
     */
    private async ensureDefaults() {
        for (const cfg of this.defaults) {
            const existing = await this.prisma.systemConfig.findUnique({ where: { configKey: cfg.key } });
            if (!existing) {
                await this.prisma.systemConfig.create({
                    data: { configKey: cfg.key, configValue: cfg.value, description: cfg.description, createdAt: new Date() },
                });
                this.logger.log('默认配置已写入: key=' + cfg.key + ', value=' + cfg.value);
            } else if (!existing.description) {
                await this.prisma.systemConfig.update({ where: { configKey: cfg.key }, data: { description: cfg.description } });
                this.logger.log('默认配置描述已补全: key=' + cfg.key);
            }
        }
    }

    /**
     * 获取配置值
     *
     * 直接从数据库读取指定 key 的最新值，不依赖缓存。
     *
     * @param key 配置键名
     * @returns 配置值，不存在时返回 undefined
     */
    async getValue(key: string): Promise<string | undefined> {
        const row = await this.prisma.systemConfig.findUnique({ where: { configKey: key }, select: { configValue: true } });
        return row?.configValue ?? undefined;
    }

    /**
     * 获取配置值（带默认值）
     *
     * 直接从数据库读取指定 key 的最新值，不存在时返回指定的默认值。
     *
     * @param key 配置键名
     * @param defaultValue 默认值
     * @returns 配置值或默认值
     */
    async getValueDefault(key: string, defaultValue: string): Promise<string> {
        const row = await this.prisma.systemConfig.findUnique({ where: { configKey: key }, select: { configValue: true } });
        return row?.configValue || defaultValue;
    }

    /**
     * 列出所有配置项
     *
     * 按 id 升序返回所有配置，敏感字段（token/api_key）自动脱敏处理。
     *
     * @returns 配置项数组，每个元素包含原始值(configValue)和脱敏后的显示值(displayValue)
     */
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

    /**
     * 更新或新增单个配置项
     *
     * 如果 key 已存在则更新值和 updatedAt，否则插入新记录。
     *
     * @param key 配置键名
     * @param value 配置值
     */
    async update(key: string, value: string) {
        const existing = await this.prisma.systemConfig.findUnique({ where: { configKey: key } });
        if (existing) {
            await this.prisma.systemConfig.update({ where: { configKey: key }, data: { configValue: value, updatedAt: new Date() } });
            this.logger.log('配置已更新: key=' + key + ', value=' + value);
        } else {
            await this.prisma.systemConfig.create({ data: { configKey: key, configValue: value, createdAt: new Date() } });
            this.logger.log('新配置已创建: key=' + key + ', value=' + value);
        }
    }

    /**
     * 批量更新配置项
     *
     * 遍历 updates 对象中的每一对键值，逐条调用 update 方法写入数据库。
     *
     * @param updates 键值对集合，key 为配置键名，value 为配置值
     */
    async batchUpdate(updates: Record<string, string>) {
        this.logger.log('开始批量更新配置，共 ' + Object.keys(updates).length + ' 项');
        for (const [k, v] of Object.entries(updates)) {
            await this.update(k, v);
        }
        this.logger.log('批量更新配置完成');
    }
}
