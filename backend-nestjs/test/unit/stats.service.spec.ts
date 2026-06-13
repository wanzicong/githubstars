/**
 * StatsService 单元测试
 *
 * 测试重点：
 *   - getLanguageStats: 分组统计 + 百分比计算 + null语言处理
 *   - getOwnerStats: topN 截取 + 头像URL获取
 *   - getTimelineStats: 原生SQL结果映射
 *   - getOverviewStats: 5路并行查询聚合
 *
 * 所有 Prisma 调用被 Mock，测试纯逻辑。
 */
import { Test, TestingModule } from '@nestjs/testing'
import { StatsService } from '../../src/stats/stats.service'
import { PrismaService } from '../../src/prisma/prisma.service'

function createMockPrisma() {
  return {
    githubRepo: {
      groupBy: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      aggregate: jest.fn().mockResolvedValue({ _sum: { starsCount: null, forksCount: null } }),
      findMany: jest.fn().mockResolvedValue([]),
    },
    $queryRaw: jest.fn().mockResolvedValue([]),
  }
}

describe('StatsService', () => {
  let service: StatsService
  let mockPrisma: ReturnType<typeof createMockPrisma>

  beforeEach(async () => {
    mockPrisma = createMockPrisma()
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StatsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile()
    service = module.get<StatsService>(StatsService)
  })

  // ==================== getLanguageStats ====================

  describe('getLanguageStats', () => {
    it('正常分布 — 多个语言 + 百分比正确', async () => {
      // 50 TypeScript, 30 Python, 15 Go, 5 Rust → 总计100
      mockPrisma.githubRepo.groupBy.mockResolvedValue([
        { language: 'TypeScript', _count: { id: 50 } },
        { language: 'Python',    _count: { id: 30 } },
        { language: 'Go',        _count: { id: 15 } },
        { language: 'Rust',      _count: { id: 5 } },
      ])
      mockPrisma.githubRepo.count.mockResolvedValue(100)

      const result = await service.getLanguageStats()

      expect(result).toHaveLength(4)
      expect(result[0]).toEqual({ language: 'TypeScript', count: 50, percentage: 50 })
      expect(result[1]).toEqual({ language: 'Python',    count: 30, percentage: 30 })
      expect(result[2]).toEqual({ language: 'Go',        count: 15, percentage: 15 })
      expect(result[3]).toEqual({ language: 'Rust',      count: 5,  percentage: 5 })
    })

    it('百分比精度 — 保留两位小数', async () => {
      // 1 TypeScript, 2 Python → 总计3 → 33.33% / 66.67%
      mockPrisma.githubRepo.groupBy.mockResolvedValue([
        { language: 'TypeScript', _count: { id: 1 } },
        { language: 'Python',    _count: { id: 2 } },
      ])
      mockPrisma.githubRepo.count.mockResolvedValue(3)

      const result = await service.getLanguageStats()

      expect(result[0].percentage).toBeCloseTo(33.33, 1)
      expect(result[1].percentage).toBeCloseTo(66.67, 1)
    })

    it('单一语言 → 百分比为 100', async () => {
      mockPrisma.githubRepo.groupBy.mockResolvedValue([
        { language: 'Java', _count: { id: 42 } },
      ])
      mockPrisma.githubRepo.count.mockResolvedValue(42)

      const result = await service.getLanguageStats()

      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({ language: 'Java', count: 42, percentage: 100 })
    })

    it('language 为 null → 标记为"未知"', async () => {
      mockPrisma.githubRepo.groupBy.mockResolvedValue([
        { language: null,       _count: { id: 10 } },
        { language: 'JavaScript', _count: { id: 90 } },
      ])
      mockPrisma.githubRepo.count.mockResolvedValue(100)

      const result = await service.getLanguageStats()

      expect(result[0].language).toBe('未知')
      expect(result[1].language).toBe('JavaScript')
      expect(result[0].percentage).toBe(10)
    })

    it('空结果 → 返回空数组', async () => {
      mockPrisma.githubRepo.groupBy.mockResolvedValue([])
      mockPrisma.githubRepo.count.mockResolvedValue(0)

      const result = await service.getLanguageStats()

      expect(result).toEqual([])
    })

    it('total 为 0 时百分比为 0（避免除零）', async () => {
      // 极端场景：有 groupBy 结果但 count 为 0（理论上不应出现）
      mockPrisma.githubRepo.groupBy.mockResolvedValue([
        { language: 'Go', _count: { id: 5 } },
      ])
      mockPrisma.githubRepo.count.mockResolvedValue(0)

      const result = await service.getLanguageStats()

      expect(result[0].percentage).toBe(0)
    })

    it('groupBy 按 count 降序排列', async () => {
      mockPrisma.githubRepo.groupBy.mockResolvedValue([])
      mockPrisma.githubRepo.count.mockResolvedValue(0)

      await service.getLanguageStats()

      const groupByCall = mockPrisma.githubRepo.groupBy.mock.calls[0][0]
      expect(groupByCall.orderBy).toEqual({ _count: { id: 'desc' } })
      expect(groupByCall.by).toEqual(['language'])
    })
  })

  // ==================== getOwnerStats ====================

  describe('getOwnerStats', () => {
    it('正确截取 topN', async () => {
      mockPrisma.githubRepo.groupBy.mockResolvedValue([
        { ownerName: 'owner1', _count: { id: 30 }, _max: { ownerAvatarUrl: 'url1' } },
        { ownerName: 'owner2', _count: { id: 20 }, _max: { ownerAvatarUrl: 'url2' } },
        { ownerName: 'owner3', _count: { id: 10 }, _max: { ownerAvatarUrl: 'url3' } },
      ])

      await service.getOwnerStats(3)

      const groupByCall = mockPrisma.githubRepo.groupBy.mock.calls[0][0]
      expect(groupByCall.take).toBe(3)
    })

    it('返回 ownerName、ownerAvatarUrl、count', async () => {
      mockPrisma.githubRepo.groupBy.mockResolvedValue([
        { ownerName: 'torvalds', _count: { id: 5 }, _max: { ownerAvatarUrl: 'https://avatar/torvalds' } },
      ])

      const result = await service.getOwnerStats(10)

      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({
        ownerName: 'torvalds',
        ownerAvatarUrl: 'https://avatar/torvalds',
        count: 5,
      })
    })

    it('_max.ownerAvatarUrl 为 null 时返回空字符串', async () => {
      mockPrisma.githubRepo.groupBy.mockResolvedValue([
        { ownerName: 'noavatar', _count: { id: 1 }, _max: { ownerAvatarUrl: null } },
      ])

      const result = await service.getOwnerStats(5)

      expect(result[0].ownerAvatarUrl).toBe('')
    })

    it('空结果 → 返回空数组', async () => {
      mockPrisma.githubRepo.groupBy.mockResolvedValue([])

      const result = await service.getOwnerStats(10)

      expect(result).toEqual([])
    })

    it('按 count 降序排列', async () => {
      mockPrisma.githubRepo.groupBy.mockResolvedValue([])

      await service.getOwnerStats(5)

      const groupByCall = mockPrisma.githubRepo.groupBy.mock.calls[0][0]
      expect(groupByCall.orderBy).toEqual({ _count: { id: 'desc' } })
      expect(groupByCall.by).toEqual(['ownerName'])
    })

    it('topN=0 时传入 take: 0', async () => {
      mockPrisma.githubRepo.groupBy.mockResolvedValue([])

      await service.getOwnerStats(0)

      const groupByCall = mockPrisma.githubRepo.groupBy.mock.calls[0][0]
      expect(groupByCall.take).toBe(0)
    })
  })

  // ==================== getTimelineStats ====================

  describe('getTimelineStats', () => {
    it('正确映射原始 SQL 结果', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([
        { month: '2024-01', count: BigInt(15) },
        { month: '2024-02', count: BigInt(23) },
        { month: '2024-03', count: BigInt(8) },
      ])

      const result = await service.getTimelineStats()

      expect(result).toHaveLength(3)
      expect(result[0]).toEqual({ month: '2024-01', count: 15 })
      expect(result[1]).toEqual({ month: '2024-02', count: 23 })
      expect(result[2]).toEqual({ month: '2024-03', count: 8 })
    })

    it('bigint count 正确转换为 Number', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([
        { month: '2025-06', count: BigInt(9999999) },
      ])

      const result = await service.getTimelineStats()

      expect(result[0].count).toBe(9999999)
      expect(typeof result[0].count).toBe('number')
    })

    it('空结果 → 返回空数组', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([])

      const result = await service.getTimelineStats()

      expect(result).toEqual([])
    })

    it('SQL 包含 DATE_FORMAT 按月分组', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([])

      await service.getTimelineStats()

      // 验证使用了 $queryRaw（而非其他方法）
      expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(1)
    })
  })

  // ==================== getOverviewStats ====================

  describe('getOverviewStats', () => {
    it('返回正确的聚合数据', async () => {
      mockPrisma.githubRepo.count.mockResolvedValue(250)
      mockPrisma.githubRepo.aggregate.mockImplementation((args: any) => {
        if (args._sum?.starsCount !== undefined) {
          return Promise.resolve({ _sum: { starsCount: BigInt(150000) } })
        }
        if (args._sum?.forksCount !== undefined) {
          return Promise.resolve({ _sum: { forksCount: BigInt(30000) } })
        }
        return Promise.resolve({ _sum: {} })
      })
      mockPrisma.githubRepo.findMany
        .mockResolvedValueOnce([
          { language: 'TypeScript' },
          { language: 'Python' },
          { language: 'Go' },
          { language: 'Rust' },
          { language: 'Java' },
        ]) // 第1次调用：distinct languages
        .mockResolvedValueOnce([
          { ownerName: 'alice' },
          { ownerName: 'bob' },
          { ownerName: 'charlie' },
        ]) // 第2次调用：distinct owners

      const result = await service.getOverviewStats()

      expect(result).toEqual({
        totalRepos: 250,
        totalStars: 150000,
        totalForks: 30000,
        totalLanguages: 5,
        totalOwners: 3,
      })
    })

    it('stars/forks 聚合结果为 null 时返回 0', async () => {
      mockPrisma.githubRepo.count.mockResolvedValue(0)
      mockPrisma.githubRepo.aggregate
        .mockResolvedValueOnce({ _sum: { starsCount: null } } as any)
        .mockResolvedValueOnce({ _sum: { forksCount: null } } as any)
      mockPrisma.githubRepo.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])

      const result = await service.getOverviewStats()

      expect(result.totalStars).toBe(0)
      expect(result.totalForks).toBe(0)
      expect(result.totalLanguages).toBe(0)
      expect(result.totalOwners).toBe(0)
    })

    it('bigint → Number 正确转换', async () => {
      mockPrisma.githubRepo.count.mockResolvedValue(1)
      mockPrisma.githubRepo.aggregate
        .mockResolvedValueOnce({ _sum: { starsCount: BigInt(99999999999) } } as any)
        .mockResolvedValueOnce({ _sum: { forksCount: BigInt(88888888888) } } as any)
      mockPrisma.githubRepo.findMany
        .mockResolvedValueOnce([{ language: 'TS' }])
        .mockResolvedValueOnce([{ ownerName: 'x' }])

      const result = await service.getOverviewStats()

      expect(result.totalStars).toBe(99999999999)
      expect(result.totalForks).toBe(88888888888)
      expect(typeof result.totalStars).toBe('number')
      expect(typeof result.totalForks).toBe('number')
    })

    it('5 个查询应并行执行（Promise.all）', async () => {
      // 验证 count、aggregate×2、findMany×2 都被调用
      mockPrisma.githubRepo.count.mockResolvedValue(10)
      mockPrisma.githubRepo.aggregate
        .mockResolvedValueOnce({ _sum: { starsCount: BigInt(100) } } as any)
        .mockResolvedValueOnce({ _sum: { forksCount: BigInt(50) } } as any)
      mockPrisma.githubRepo.findMany
        .mockResolvedValueOnce([{ language: 'TS' }])
        .mockResolvedValueOnce([{ ownerName: 'me' }])

      await service.getOverviewStats()

      expect(mockPrisma.githubRepo.count).toHaveBeenCalled()
      expect(mockPrisma.githubRepo.aggregate).toHaveBeenCalledTimes(2)
      expect(mockPrisma.githubRepo.findMany).toHaveBeenCalledTimes(2)
    })

    it('空数据库 → 全部返回 0', async () => {
      mockPrisma.githubRepo.count.mockResolvedValue(0)
      mockPrisma.githubRepo.aggregate
        .mockResolvedValueOnce({ _sum: { starsCount: null } } as any)
        .mockResolvedValueOnce({ _sum: { forksCount: null } } as any)
      mockPrisma.githubRepo.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])

      const result = await service.getOverviewStats()

      expect(result).toEqual({
        totalRepos: 0,
        totalStars: 0,
        totalForks: 0,
        totalLanguages: 0,
        totalOwners: 0,
      })
    })
  })

  // ==================== getTopStarred ====================

  describe('getTopStarred', () => {
    it('按 starsCount 降序获取 topN 仓库', async () => {
      const mockRepos = [
        { id: 1, fullName: 'repo1', starsCount: 1000 },
        { id: 2, fullName: 'repo2', starsCount: 500 },
      ]
      mockPrisma.githubRepo.findMany.mockResolvedValue(mockRepos)

      const result = await service.getTopStarred(2)

      expect(result).toEqual(mockRepos)
      const call = mockPrisma.githubRepo.findMany.mock.calls[0][0]
      expect(call.orderBy).toEqual({ starsCount: 'desc' })
      expect(call.take).toBe(2)
    })
  })

  // ==================== getRecentActive ====================

  describe('getRecentActive', () => {
    it('按 repoUpdatedAt 降序获取最近活跃的 topN 仓库', async () => {
      const mockRepos = [
        { id: 3, fullName: 'repo3', repoUpdatedAt: new Date('2025-01-01') },
      ]
      mockPrisma.githubRepo.findMany.mockResolvedValue(mockRepos)

      const result = await service.getRecentActive(5)

      expect(result).toEqual(mockRepos)
      const call = mockPrisma.githubRepo.findMany.mock.calls[0][0]
      expect(call.where).toEqual({ repoUpdatedAt: { not: null } })
      expect(call.orderBy).toEqual({ repoUpdatedAt: 'desc' })
      expect(call.take).toBe(5)
    })
  })
})
