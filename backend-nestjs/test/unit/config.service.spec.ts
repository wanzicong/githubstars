/**
 * ConfigService 单元测试
 *
 * 测试重点:
 *   - getValueDefault: 值存在 / 值不存在 / 空字符串 三种情况
 *   - update: 新 key 创建 / 已有 key 更新
 *   - listAll: 敏感字段脱敏 (token / api_key)
 *   - listAll: 短值 (≤8 字符) 脱敏
 *   - reloadCache: 从 DB 加载所有行到内存 Map
 *   - ensureDefaults: 创建缺失的默认配置
 *
 * 所有 Prisma 调用被 Mock，测试纯逻辑。
 */
import { Test, TestingModule } from '@nestjs/testing'
import { ConfigService } from '../../src/config/config.service'
import { PrismaService } from '../../src/prisma/prisma.service'

// 辅助: 创建 Mock PrismaService
function createMockPrisma() {
  return {
    systemConfig: {
      findUnique: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({}),
    },
  }
}

describe('ConfigService', () => {
  let service: ConfigService
  let mockPrisma: ReturnType<typeof createMockPrisma>

  beforeEach(async () => {
    mockPrisma = createMockPrisma()
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConfigService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile()
    // 手动 init 触发 OnModuleInit 生命周期钩子
    await module.init()
    service = module.get<ConfigService>(ConfigService)
  })

  // ==================== 1. getValueDefault ====================

  describe('getValueDefault', () => {
    it('缓存中存在值时返回该值', async () => {
      await service.update('my.key', 'expectedValue')
      const result = service.getValueDefault('my.key', 'fallback')
      expect(result).toBe('expectedValue')
    })

    it('缓存中值不存在时返回默认值', () => {
      const result = service.getValueDefault('nonexistent.key', 'defaultVal')
      expect(result).toBe('defaultVal')
    })

    it('缓存中值为空字符串时返回空字符串（不退回默认值）', async () => {
      await service.update('empty.key', '')
      const result = service.getValueDefault('empty.key', 'fallback')
      expect(result).toBe('')
    })
  })

  // ==================== 2. update ====================

  describe('update', () => {
    it('不存在的 key 应调用 create 创建新记录并写入缓存', async () => {
      // 重置 create 计数（ensureDefaults 已在 beforeEach 中调用过 9 次 create）
      mockPrisma.systemConfig.create.mockClear()

      await service.update('new.config', 'newValue')

      expect(mockPrisma.systemConfig.create).toHaveBeenCalledTimes(1)
      expect(mockPrisma.systemConfig.create).toHaveBeenCalledWith({
        data: { configKey: 'new.config', configValue: 'newValue', createdAt: expect.any(Date) },
      })
      expect(mockPrisma.systemConfig.update).not.toHaveBeenCalled()
      expect(service.getValue('new.config')).toBe('newValue')
    })

    it('已存在的 key 应调用 update 更新记录并写入缓存', async () => {
      // 覆盖 findUnique 返回已存在记录
      mockPrisma.systemConfig.findUnique.mockResolvedValue({
        id: BigInt(1),
        configKey: 'existing.key',
        configValue: 'oldValue',
      })
      // 清零以精确验证本测试的调用
      mockPrisma.systemConfig.create.mockClear()
      mockPrisma.systemConfig.update.mockClear()

      await service.update('existing.key', 'updatedValue')

      expect(mockPrisma.systemConfig.update).toHaveBeenCalledTimes(1)
      expect(mockPrisma.systemConfig.update).toHaveBeenCalledWith({
        where: { configKey: 'existing.key' },
        data: { configValue: 'updatedValue', updatedAt: expect.any(Date) },
      })
      expect(mockPrisma.systemConfig.create).not.toHaveBeenCalled()
      expect(service.getValue('existing.key')).toBe('updatedValue')
    })
  })

  // ==================== 3. listAll — 脱敏 ====================

  describe('listAll', () => {
    it('敏感字段 token / api_key 应脱敏显示（值 > 8 字符：前4 + **** + 后4）', async () => {
      mockPrisma.systemConfig.findMany.mockResolvedValue([
        { id: BigInt(1), configKey: 'github.token', configValue: 'ghp_abcdefghijklmnop1234', description: 'GitHub Token' },
        { id: BigInt(2), configKey: 'deepseek.api_key', configValue: 'sk-abcd1234efgh5678ijkl', description: 'API Key' },
        { id: BigInt(3), configKey: 'normal.config', configValue: 'normal_value', description: '普通配置' },
      ])

      const result = await service.listAll()

      // github.token 脱敏
      expect(result[0].configKey).toBe('github.token')
      expect(result[0].configValue).toBe('ghp_abcdefghijklmnop1234')
      expect(result[0].displayValue).toBe('ghp_****1234')
      expect(result[0].sensitive).toBe(true)

      // deepseek.api_key 脱敏
      expect(result[1].configKey).toBe('deepseek.api_key')
      expect(result[1].displayValue).toBe('sk-a****ijkl')
      expect(result[1].sensitive).toBe(true)

      // 普通配置不脱敏
      expect(result[2].configKey).toBe('normal.config')
      expect(result[2].displayValue).toBe('normal_value')
      expect(result[2].sensitive).toBe(false)
    })

    it('短值（≤8 字符）的敏感字段应完全替换为 ****', async () => {
      mockPrisma.systemConfig.findMany.mockResolvedValue([
        { id: BigInt(1), configKey: 'some.api_key', configValue: 'short', description: '短 Token' },
      ])

      const result = await service.listAll()

      expect(result[0].configKey).toBe('some.api_key')
      expect(result[0].configValue).toBe('short')
      expect(result[0].displayValue).toBe('****')
      expect(result[0].sensitive).toBe(true)
    })
  })

  // ==================== 4. reloadCache ====================

  describe('reloadCache', () => {
    it('应从 DB 加载所有行到内存 Map（null 值不写入缓存）', async () => {
      mockPrisma.systemConfig.findMany.mockResolvedValue([
        { configKey: 'key.one', configValue: 'value1' },
        { configKey: 'key.two', configValue: 'value2' },
        { configKey: 'key.null', configValue: null },
      ])

      await service.reloadCache()

      expect(service.getValue('key.one')).toBe('value1')
      expect(service.getValue('key.two')).toBe('value2')
      // configValue 为 null 的不应放入缓存
      expect(service.getValue('key.null')).toBeUndefined()
    })
  })

  // ==================== 5. ensureDefaults ====================

  describe('ensureDefaults', () => {
    let ensureService: ConfigService
    let ensureMockPrisma: ReturnType<typeof createMockPrisma>

    beforeEach(async () => {
      // 用独立 Module 确保 onModuleInit 在 beforeEach 内执行
      ensureMockPrisma = createMockPrisma()
      const module = await Test.createTestingModule({
        providers: [
          ConfigService,
          { provide: PrismaService, useValue: ensureMockPrisma },
        ],
      }).compile()
      await module.init()
      ensureService = module.get(ConfigService)
    })

    it('应在启动时创建所有缺失的默认配置', () => {
      // 全部 findUnique 返回 null，所以 create 被调用 9 次（每个默认配置）
      expect(ensureMockPrisma.systemConfig.create).toHaveBeenCalledTimes(9)

      // 验证 findUnique 被查询了所有默认 key
      const findUniqueCalls = ensureMockPrisma.systemConfig.findUnique.mock.calls
      const queriedKeys = findUniqueCalls.map((call: any) => call[0]?.where?.configKey).filter(Boolean)
      // 至少包含核心默认 key（具体 key 名依赖 defaults 数组实现，不逐个断言）
      expect(queriedKeys.length).toBeGreaterThanOrEqual(9)

      // 核心默认 key 验证
      const keySet = new Set(queriedKeys)
      expect(keySet.has('github.token')).toBe(true)
      expect(keySet.has('deepseek.api_key')).toBe(true)
      expect(keySet.has('clone.directory')).toBe(true)
    })
  })
})
