import { ConfigService } from '../../src/config/config.service';

describe('ConfigService', () => {
    function makePrisma(findManyResult?: any[]) {
        return {
            systemConfig: {
                findMany: jest.fn().mockResolvedValue(
                    findManyResult ?? [
                        { configKey: 'github.username', configValue: 'testuser' },
                        { configKey: 'github.token', configValue: 'ghp_test12345678' },
                        { configKey: 'deepseek.api_key', configValue: 'sk-testkey1234' },
                        { configKey: 'deepseek.api_url', configValue: 'https://api.deepseek.com/v1/chat/completions' },
                        { configKey: 'deepseek.model', configValue: 'deepseek-chat' },
                    ],
                ),
                findUnique: jest.fn().mockImplementation((args: any) => {
                    const key = args?.where?.configKey || 'exists';
                    // 返回带 description 的记录，让 ensureDefaults 跳过补全
                    return Promise.resolve({ configKey: key, configValue: '', description: `desc:${key}` });
                }),
                create: jest.fn().mockResolvedValue(undefined),
                update: jest.fn().mockResolvedValue(undefined),
            },
        } as any;
    }

    async function boot() {
        const prisma = makePrisma();
        const service = new ConfigService(prisma);
        await service.onModuleInit();
        return { service, prisma };
    }

    describe('listAll', () => {
        it('应返回所有配置项列表', async () => {
            const { service, prisma } = await boot();
            prisma.systemConfig.findMany.mockResolvedValue([
                { id: 1n, configKey: 'github.username', configValue: 'testuser', description: 'GitHub用户名' },
                { id: 2n, configKey: 'github.token', configValue: 'ghp_test12345678', description: 'GitHub Token' },
                { id: 3n, configKey: 'deepseek.api_key', configValue: 'sk-testkey1234', description: '已停用 API Key' },
            ]);

            const configs = await service.listAll();
            expect(configs).toHaveLength(2);
            expect(configs.some((item) => item.configKey.startsWith('deepseek.'))).toBe(false);
        });

        it('敏感字段（token/api_key）应脱敏显示', async () => {
            const { service, prisma } = await boot();
            prisma.systemConfig.findMany.mockResolvedValue([
                { id: 1n, configKey: 'github.token', configValue: 'ghp_test12345678', description: 'GitHub Token' },
                { id: 2n, configKey: 'anthropic.api_key', configValue: 'sk-testkey1234', description: 'API Key' },
            ]);

            const configs = await service.listAll();
            expect(configs[0].displayValue).toContain('****');
            expect(configs[1].displayValue).toContain('****');
            expect(configs[0].sensitive).toBe(true);
            expect(configs[0].configValue).toBe('ghp_test12345678');
        });

        it('普通字段不脱敏', async () => {
            const { service, prisma } = await boot();
            prisma.systemConfig.findMany.mockResolvedValue([
                { id: 1n, configKey: 'github.username', configValue: 'testuser', description: '用户名' },
            ]);

            const configs = await service.listAll();
            expect(configs[0].displayValue).toBe('testuser');
            expect(configs[0].sensitive).toBe(false);
        });

        it('短敏感值（≤8字符）脱敏显示 ****', async () => {
            const { service, prisma } = await boot();
            prisma.systemConfig.findMany.mockResolvedValue([
                { id: 1n, configKey: 'api_token', configValue: 'short', description: 'Token' },
            ]);

            const configs = await service.listAll();
            expect(configs[0].displayValue).toBe('****');
        });
    });

    describe('getValue', () => {
        it('应从缓存获取配置值', async () => {
            const { service } = await boot();
            const value = await service.getValue('github.username');
            expect(value).toBe('testuser');
        });

        it('缓存未命中时回源数据库', async () => {
            const { service, prisma } = await boot();
            prisma.systemConfig.findUnique.mockResolvedValue({ configValue: 'from-db' });
            const value = await service.getValue('new.key');
            expect(value).toBe('from-db');
        });

        it('不存在的键返回 undefined', async () => {
            const { service, prisma } = await boot();
            prisma.systemConfig.findUnique.mockResolvedValue(null);
            const value = await service.getValue('nonexistent');
            expect(value).toBeUndefined();
        });

        it('已停用的 DeepSeek 配置不可读取', async () => {
            const { service, prisma } = await boot();
            const value = await service.getValue('deepseek.api_key');
            expect(value).toBeUndefined();
            expect(prisma.systemConfig.findUnique).not.toHaveBeenCalledWith({
                where: { configKey: 'deepseek.api_key' },
                select: { configValue: true },
            });
        });
    });

    describe('getValueDefault', () => {
        it('值存在时返回实际值', async () => {
            const { service } = await boot();
            const value = await service.getValueDefault('github.username', 'fallback');
            expect(value).toBe('testuser');
        });

        it('值不存在时返回默认值', async () => {
            const { service } = await boot();
            const value = await service.getValueDefault('nonexistent', 'default');
            expect(value).toBe('default');
        });
    });

    describe('update', () => {
        it('应更新已有配置', async () => {
            const { service, prisma } = await boot();
            prisma.systemConfig.findUnique.mockResolvedValue({ configKey: 'github.username' });
            await service.update('github.username', 'new-user');
            expect(prisma.systemConfig.update).toHaveBeenCalled();
            // 更新后缓存应同步更新
            const val = await service.getValue('github.username');
            expect(val).toBe('new-user');
        });

        it('应创建新配置项', async () => {
            const { service, prisma } = await boot();
            prisma.systemConfig.findUnique.mockResolvedValue(null);
            await service.update('new.config', 'value');
            expect(prisma.systemConfig.create).toHaveBeenCalled();
            const val = await service.getValue('new.config');
            expect(val).toBe('value');
        });

        it('应拒绝重新写入已停用的 DeepSeek 配置', async () => {
            const { service, prisma } = await boot();
            await expect(service.update('deepseek.api_key', 'k1')).rejects.toThrow('该配置项已停用');
            expect(prisma.systemConfig.update).not.toHaveBeenCalled();
            expect(prisma.systemConfig.create).not.toHaveBeenCalled();
        });
    });

    describe('batchUpdate', () => {
        it('应批量更新多个配置项', async () => {
            const { service, prisma } = await boot();
            prisma.systemConfig.findUnique.mockResolvedValue({ configKey: 'github.username' });
            await service.batchUpdate({ 'github.username': 'u1', 'clone.http_proxy': 'http://127.0.0.1:7897' });
            expect(prisma.systemConfig.update).toHaveBeenCalledTimes(2);
        });
    });
});
