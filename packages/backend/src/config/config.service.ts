import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * 系统配置服务
 *
 * 负责管理 system_config 表的读写操作，在模块初始化时自动写入默认配置项并加载到内存缓存。
 * 配置项以键值对形式存储，包含 GitHub、DeepSeek 等模块的配置。
 * 敏感字段（token/api_key）在列表查询时自动脱敏显示。
 *
 * 缓存策略：
 * - onModuleInit 时全量加载到 Map 缓存
 * - getValue/getValueDefault 优先读缓存，避免频繁查库
 * - update/batchUpdate 同步更新缓存和数据库
 */
@Injectable()
export class ConfigService implements OnModuleInit {
    private readonly logger = new Logger(ConfigService.name);
    /** 内存缓存：配置键 → 配置值 */
    private readonly cache = new Map<string, string>();
    private readonly defaults: Array<{ key: string; value: string; description: string }> = [
        { key: 'github.username', value: 'wanzicong', description: 'GitHub 用户名，用于同步 Star 仓库' },
        { key: 'github.token', value: '', description: 'GitHub Personal Access Token，用于提高 API 限额' },
        { key: 'deepseek.api_key', value: '', description: 'DeepSeek API Key，用于 AI 分析、翻译和分类' },
        {
            key: 'deepseek.api_url',
            value: 'https://api.deepseek.com/v1/chat/completions',
            description: 'DeepSeek Chat Completions API 地址',
        },
        { key: 'deepseek.model', value: 'deepseek-chat', description: 'DeepSeek 模型名称' },
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
        await this.loadCache();
        this.logger.log('ConfigService 初始化完成，缓存项数: ' + this.cache.size);
    }

    /**
     * 全量加载配置到内存缓存
     */
    private async loadCache() {
        const configs = await this.prisma.systemConfig.findMany({ select: { configKey: true, configValue: true } });
        this.cache.clear();
        for (const c of configs) {
            this.cache.set(c.configKey, c.configValue || '');
        }
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
                try {
                    await this.prisma.systemConfig.create({
                        data: { configKey: cfg.key, configValue: cfg.value, description: cfg.description, createdAt: new Date() },
                    });
                    this.logger.log('默认配置已写入: key=' + cfg.key + ', value=' + cfg.value);
                } catch (e: any) {
                    // 并发初始化时可能已被其他进程写入
                    if (e?.code !== 'P2002') throw e;
                    this.logger.log('默认配置已存在(并发写入): key=' + cfg.key);
                }
            } else if (!existing.description) {
                await this.prisma.systemConfig.update({ where: { configKey: cfg.key }, data: { description: cfg.description } });
                this.logger.log('默认配置描述已补全: key=' + cfg.key);
            }
        }
    }

    /**
     * 获取配置值
     *
     * 优先从内存缓存读取，缓存未命中时回源数据库并回填缓存。
     *
     * @param key 配置键名
     * @returns 配置值，不存在时返回 undefined
     */
    async getValue(key: string): Promise<string | undefined> {
        if (this.cache.has(key)) return this.cache.get(key) || undefined;
        const row = await this.prisma.systemConfig.findUnique({ where: { configKey: key }, select: { configValue: true } });
        if (row) this.cache.set(key, row.configValue || '');
        return row?.configValue ?? undefined;
    }

    /**
     * 获取配置值（带默认值）
     *
     * 优先从内存缓存读取，缓存未命中时回源数据库并回填缓存。
     *
     * @param key 配置键名
     * @param defaultValue 默认值
     * @returns 配置值或默认值
     */
    async getValueDefault(key: string, defaultValue: string): Promise<string> {
        const value = await this.getValue(key);
        return value || defaultValue;
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
        } else {
            await this.prisma.systemConfig.create({ data: { configKey: key, configValue: value, createdAt: new Date() } });
        }
        // 同步更新缓存
        this.cache.set(key, value);
        this.logger.log('配置已更新: key=' + key);
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
