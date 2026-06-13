/**
 * CloneService 单元测试
 *
 * 测试重点:
 *   - sanitizeSubdirectory: 路径清理与安全检查（盘符/.. /保留名/非法字符）
 *   - buildCloneUrl: 克隆 URL 构建（代理/直连）
 *   - getCloneConfig / cancelTask / getTask: 基本公共方法
 *   - generateCloneScript / retryFailedClones: 参数传递验证
 *
 * 所有 Prisma/ConfigService/CloneTaskService/GithubRepoService 均被 Mock。
 * child_process 通过 avoid 真实 exec 调用 — 本测试文件不触发后台 clone 逻辑。
 */
import { Test, TestingModule } from '@nestjs/testing'
import { CloneService } from '../../src/clone/services/clone.service'
import { PrismaService } from '../../src/prisma/prisma.service'
import { ConfigService } from '../../src/config/config.service'
import { CloneTaskService } from '../../src/clone/services/clone-task.service'
import { GithubRepoService } from '../../src/github/services/github-repo.service'

// ── Mock 工厂 ──────────────────────────────────────────────

function createMockPrisma() {
  return {
    cloneTask: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    cloneTaskItem: {
      create: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
  }
}

function createMockConfigService() {
  return {
    getValue: jest.fn(),
    getValueDefault: jest.fn(),
    update: jest.fn().mockResolvedValue(undefined),
  }
}

function createMockCloneTaskService() {
  return {
    getMaxTaskCounterNumber: jest.fn().mockResolvedValue(0),
  }
}

function createMockGithubRepoService() {
  return {
    findPage: jest.fn().mockResolvedValue({ records: [], total: 0 }),
  }
}

// ── 测试套件 ────────────────────────────────────────────────

describe('CloneService', () => {
  let service: CloneService
  let mockPrisma: ReturnType<typeof createMockPrisma>
  let mockConfigService: ReturnType<typeof createMockConfigService>
  let mockCloneTaskService: ReturnType<typeof createMockCloneTaskService>
  let mockGithubRepoService: ReturnType<typeof createMockGithubRepoService>

  beforeEach(async () => {
    mockPrisma = createMockPrisma()
    mockConfigService = createMockConfigService()
    mockCloneTaskService = createMockCloneTaskService()
    mockGithubRepoService = createMockGithubRepoService()

    // 为 getValueDefault 提供安全的默认值，避免 baseDir getter 返回 undefined
    mockConfigService.getValueDefault.mockImplementation((key: string, defaultValue: any) => {
      if (key === 'clone.directory') return 'D:/github-stars'
      if (key === 'clone.proxy.url') return ''
      if (key === 'clone.subdirectory.history') return '[]'
      if (key === 'clone.subdirectory.last') return ''
      return defaultValue
    })

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CloneService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: CloneTaskService, useValue: mockCloneTaskService },
        { provide: GithubRepoService, useValue: mockGithubRepoService },
      ],
    }).compile()
    service = module.get<CloneService>(CloneService)
  })

  // ================================================================
  // sanitizeSubdirectory — 路径清理与安全检查
  // ================================================================

  describe('sanitizeSubdirectory', () => {

    // ── 正常路径 ──

    it('普通路径 → 原样返回', () => {
      expect(service.sanitizeSubdirectory('my-repos')).toBe('my-repos')
    })

    it('多级正常路径 → 原样返回', () => {
      expect(service.sanitizeSubdirectory('github/stars/2024')).toBe('github/stars/2024')
    })

    it('路径含中文 → 正常工作', () => {
      expect(service.sanitizeSubdirectory('我的项目/AI工具')).toBe('我的项目/AI工具')
    })

    it('路径含数字、连字符、下划线 → 正常工作', () => {
      expect(service.sanitizeSubdirectory('my-123-repos/test_2024')).toBe('my-123-repos/test_2024')
    })

    it('长路径（多级目录）→ 正常工作', () => {
      const long = 'a/b/c/d/e/f/g/h/i/j/k/l/m/n/o/p'
      expect(service.sanitizeSubdirectory(long)).toBe(long)
    })

    // ── 清理：反斜杠 → 正斜杠 ──

    it('含反斜杠 → 转为正斜杠', () => {
      expect(service.sanitizeSubdirectory('sub\\dir\\repo')).toBe('sub/dir/repo')
    })

    it('混合反斜杠与正斜杠 → 统一为正斜杠', () => {
      expect(service.sanitizeSubdirectory('a\\b/c\\d')).toBe('a/b/c/d')
    })

    // ── 清理：移除首尾斜杠 ──

    it('首部斜杠 → 移除', () => {
      expect(service.sanitizeSubdirectory('/leading')).toBe('leading')
    })

    it('尾部斜杠 → 移除', () => {
      expect(service.sanitizeSubdirectory('trailing/')).toBe('trailing')
    })

    it('首尾均有斜杠 → 同时移除', () => {
      expect(service.sanitizeSubdirectory('/both/')).toBe('both')
    })

    it('多个首尾斜杠 → 全部移除', () => {
      expect(service.sanitizeSubdirectory('///multiple///')).toBe('multiple')
    })

    // ── 清理：空白字符 ──

    it('空白字符首尾 → 裁剪 + 去斜杠', () => {
      expect(service.sanitizeSubdirectory('  trimmed  ')).toBe('trimmed')
    })

    it('带空格的多级路径 → 内部空格保留仅首尾裁剪', () => {
      // Note: trim 仅移除首尾空白，中间空格保留。服务端可在 UI 层额外校验。
      expect(service.sanitizeSubdirectory('  my repos / test  ')).toBe('my repos / test')
    })

    // ── 空 / 仅空白（split 产生空段 → 拒绝） ──

    it('空字符串 → 抛出"无效路径段"（空段被拒绝）', () => {
      expect(() => service.sanitizeSubdirectory('')).toThrow('无效路径段')
    })

    it('仅空白 → 抛出"无效路径段"', () => {
      expect(() => service.sanitizeSubdirectory('   ')).toThrow('无效路径段')
    })

    // ── 拒绝：盘符 / 冒号 ──

    it('Windows 盘符 "C:\\path" → 抛出"路径不能包含盘符"', () => {
      expect(() => service.sanitizeSubdirectory('C:\\path')).toThrow('路径不能包含盘符')
    })

    it('含冒号 "foo:bar" → 抛出"路径不能包含盘符"', () => {
      expect(() => service.sanitizeSubdirectory('foo:bar')).toThrow('路径不能包含盘符')
    })

    it('仅冒号 → 抛出异常', () => {
      expect(() => service.sanitizeSubdirectory(':')).toThrow()
    })

    it('D: 盘符 → 抛出"路径不能包含盘符"', () => {
      expect(() => service.sanitizeSubdirectory('D:\\repos')).toThrow('路径不能包含盘符')
    })

    // ── 拒绝：.. 和 . ──

    it('".." 直接作为路径 → 抛出"无效路径段"', () => {
      expect(() => service.sanitizeSubdirectory('..')).toThrow('无效路径段')
    })

    it('含 ".." 段 "foo/../bar" → 抛出"无效路径段"', () => {
      expect(() => service.sanitizeSubdirectory('foo/../bar')).toThrow('无效路径段')
    })

    it('以 ".." 开头 "foo/.." → 抛出"无效路径段"', () => {
      expect(() => service.sanitizeSubdirectory('foo/..')).toThrow('无效路径段')
    })

    it('含 "." 段 "foo/./bar" → 抛出"无效路径段"', () => {
      expect(() => service.sanitizeSubdirectory('foo/./bar')).toThrow('无效路径段')
    })

    // ── 拒绝：双斜杠（产生空段） ──

    it('双斜杠 "foo//bar" → 抛出"无效路径段"（空段）', () => {
      expect(() => service.sanitizeSubdirectory('foo//bar')).toThrow('无效路径段')
    })

    // ── 拒绝：Windows 保留名（包含大小写变体 + 路径中段） ──

    const reservedNames = [
      'CON', 'PRN', 'AUX', 'NUL',
      'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
      'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9',
    ]

    reservedNames.forEach((name) => {
      it(`保留名 "${name}" 直接作为子目录 → 抛出"保留名"`, () => {
        expect(() => service.sanitizeSubdirectory(name)).toThrow('保留名')
      })

      it(`保留名 "${name.toLowerCase()}" 不区分大小写 → 抛出"保留名"`, () => {
        expect(() => service.sanitizeSubdirectory(name.toLowerCase())).toThrow('保留名')
      })

      it(`路径中段含保留名 "prefix/${name}/suffix" → 抛出"保留名"`, () => {
        expect(() => service.sanitizeSubdirectory(`prefix/${name}/suffix`)).toThrow('保留名')
      })
    })

    // ── 拒绝：非法字符 ──

    const illegalChars = ['<', '>', '"', '|', '?', '*']

    illegalChars.forEach((ch) => {
      it(`非法字符 "${ch}" → 抛出"非法字符"`, () => {
        expect(() => service.sanitizeSubdirectory(`foo${ch}bar`)).toThrow('非法字符')
      })
    })

    it('控制字符 \\x00 → 抛出"非法字符"', () => {
      expect(() => service.sanitizeSubdirectory('foo bar')).toThrow('非法字符')
    })

    it('控制字符 \\x1f → 抛出"非法字符"', () => {
      expect(() => service.sanitizeSubdirectory('foobar')).toThrow('非法字符')
    })
  })

  // ================================================================
  // buildCloneUrl — 克隆 URL 构建
  // ================================================================

  describe('buildCloneUrl', () => {
    it('无代理配置 → 附加 .git 后缀', () => {
      mockConfigService.getValueDefault.mockReturnValue('')
      expect(service.buildCloneUrl('https://github.com/owner/repo'))
        .toBe('https://github.com/owner/repo.git')
    })

    it('代理 URL 无尾部斜杠 → 中间补 "/"', () => {
      mockConfigService.getValueDefault.mockReturnValue('https://mirror.example.com')
      expect(service.buildCloneUrl('https://github.com/owner/repo'))
        .toBe('https://mirror.example.com/https://github.com/owner/repo')
    })

    it('代理 URL 有尾部斜杠 → 直接拼接', () => {
      mockConfigService.getValueDefault.mockReturnValue('https://mirror.example.com/')
      expect(service.buildCloneUrl('https://github.com/owner/repo'))
        .toBe('https://mirror.example.com/https://github.com/owner/repo')
    })

    it('使用 clone.proxy.url 配置键读取', () => {
      mockConfigService.getValueDefault.mockReturnValue('')
      service.buildCloneUrl('https://github.com/a/b')
      expect(mockConfigService.getValueDefault).toHaveBeenCalledWith('clone.proxy.url', '')
    })
  })

  // ================================================================
  // getCloneConfig — 克隆配置获取
  // ================================================================

  describe('getCloneConfig', () => {
    it('无历史、无活动任务 → 返回默认配置', async () => {
      mockConfigService.getValueDefault.mockImplementation((key: string, def: any) => {
        if (key === 'clone.directory') return 'D:/github-stars'
        if (key === 'clone.subdirectory.history') return '[]'
        if (key === 'clone.subdirectory.last') return ''
        return def
      })
      mockPrisma.cloneTask.findFirst.mockResolvedValue(null)

      const cfg = await service.getCloneConfig()

      expect(cfg.success).toBe(true)
      expect(cfg.baseDirectory).toBe('D:/github-stars')
      expect(cfg.subdirectoryHistory).toEqual([])
      expect(cfg.lastSubdirectory).toBe('')
      expect(cfg.hasActiveTask).toBe(false)
      expect(cfg.defaultCloneDepth).toBe(1)
      expect(cfg.defaultMaxRepoSizeMb).toBe(500)
    })

    it('有历史记录 → 正确解析并返回', async () => {
      mockConfigService.getValueDefault.mockImplementation((key: string, def: any) => {
        if (key === 'clone.directory') return '/data/stars'
        if (key === 'clone.subdirectory.history') return '["prev1","prev2"]'
        if (key === 'clone.subdirectory.last') return 'prev1'
        return def
      })
      mockPrisma.cloneTask.findFirst.mockResolvedValue(null)

      const cfg = await service.getCloneConfig()
      expect(cfg.subdirectoryHistory).toEqual(['prev1', 'prev2'])
      expect(cfg.lastSubdirectory).toBe('prev1')
    })

    it('历史 JSON 非法 → 回退为空数组（不崩）', async () => {
      mockConfigService.getValueDefault.mockImplementation((key: string, def: any) => {
        if (key === 'clone.directory') return '/data'
        if (key === 'clone.subdirectory.history') return '{broken'
        if (key === 'clone.subdirectory.last') return ''
        return def
      })
      mockPrisma.cloneTask.findFirst.mockResolvedValue(null)

      const cfg = await service.getCloneConfig()
      expect(cfg.subdirectoryHistory).toEqual([])
    })

    it('存在活动任务（RUNNING）→ hasActiveTask=true', async () => {
      mockConfigService.getValueDefault.mockImplementation((key: string, def: any) => {
        if (key === 'clone.directory') return '/data'
        if (key === 'clone.subdirectory.history') return '[]'
        if (key === 'clone.subdirectory.last') return ''
        return def
      })
      mockPrisma.cloneTask.findFirst.mockResolvedValue({ taskId: 'clone_5' })

      const cfg = await service.getCloneConfig()
      expect(cfg.hasActiveTask).toBe(true)
    })
  })

  // ================================================================
  // cancelTask — 任务取消
  // ================================================================

  describe('cancelTask', () => {
    it('任务不存在 → 返回 false', async () => {
      mockPrisma.cloneTask.findUnique.mockResolvedValue(null)
      expect(await service.cancelTask('no-such')).toBe(false)
    })

    it('任务 COMPLETED → 不可取消，返回 false', async () => {
      mockPrisma.cloneTask.findUnique.mockResolvedValue({ taskId: 'done', status: 'COMPLETED' })
      expect(await service.cancelTask('done')).toBe(false)
    })

    it('任务 FAILED → 不可取消，返回 false', async () => {
      mockPrisma.cloneTask.findUnique.mockResolvedValue({ taskId: 'failed', status: 'FAILED' })
      expect(await service.cancelTask('failed')).toBe(false)
    })

    it('任务 RUNNING → 取消成功，更新状态为 FAILED + cancelled=1', async () => {
      mockPrisma.cloneTask.findUnique.mockResolvedValue({ taskId: 'r1', status: 'RUNNING' })
      mockPrisma.cloneTask.update.mockResolvedValue({})
      expect(await service.cancelTask('r1')).toBe(true)
      expect(mockPrisma.cloneTask.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { taskId: 'r1' },
          data: expect.objectContaining({
            status: 'FAILED',
            errorMessage: '用户取消',
            cancelled: 1,
          }),
        }),
      )
    })

    it('任务 PENDING → 取消成功', async () => {
      mockPrisma.cloneTask.findUnique.mockResolvedValue({ taskId: 'p1', status: 'PENDING' })
      mockPrisma.cloneTask.update.mockResolvedValue({})
      expect(await service.cancelTask('p1')).toBe(true)
    })
  })

  // ================================================================
  // getTask — 任务查询
  // ================================================================

  describe('getTask', () => {
    it('任务不存在 → 返回 null', async () => {
      mockPrisma.cloneTask.findUnique.mockResolvedValue(null)
      expect(await service.getTask('none')).toBeNull()
    })

    it('任务存在 → 通过 findUnique 查询并返回', async () => {
      const mockTask = { taskId: 'c1', status: 'COMPLETED', items: [] }
      mockPrisma.cloneTask.findUnique.mockResolvedValue(mockTask)
      const result = await service.getTask('c1')
      expect(result).toBeDefined()
      expect(mockPrisma.cloneTask.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { taskId: 'c1' } }),
      )
    })
  })

  // ================================================================
  // generateCloneScript — 脚本生成（过滤参数传递验证）
  // ================================================================

  describe('generateCloneScript', () => {
    it('Windows 格式 — 空仓库列表', async () => {
      mockGithubRepoService.findPage.mockResolvedValue({ records: [], total: 0 })
      const script = await service.generateCloneScript({ osType: 'windows', subDirectory: 'test' })
      expect(script).toContain('$targetDir')
      expect(script).toContain('cd $targetDir')
      expect(script).not.toContain('#!/bin/bash')
    })

    it('bash 格式 — 空仓库列表', async () => {
      mockGithubRepoService.findPage.mockResolvedValue({ records: [], total: 0 })
      const script = await service.generateCloneScript({ osType: 'linux', subDirectory: 'test' })
      expect(script).toContain('#!/bin/bash')
      expect(script).toContain('mkdir -p')
    })

    it('subDirectory 被 sanitize + 拼入 targetDir', async () => {
      mockGithubRepoService.findPage.mockResolvedValue({ records: [], total: 0 })
      mockConfigService.getValueDefault.mockReturnValueOnce('/base')
      const script = await service.generateCloneScript({
        osType: 'linux',
        subDirectory: '  cool\\repos/// ',
      })
      expect(script).toContain('cool/repos')
    })

    it('所有过滤参数正确传递给 findPage', async () => {
      mockGithubRepoService.findPage.mockResolvedValue({ records: [], total: 0 })
      await service.generateCloneScript({
        osType: 'linux',
        subDirectory: 'test',
        keyword: 'react',
        language: 'TypeScript',
        categoryIds: '1,2',
        maxCount: 20,
        cloneDepth: 3,
        dateField: 'starred_at',
        startDate: '2024-01-01',
        endDate: '2024-06-30',
        sortBy: 'stars_count',
        sortOrder: 'asc',
      })
      expect(mockGithubRepoService.findPage).toHaveBeenCalledWith(
        expect.objectContaining({
          page: 1,
          size: 20,
          keyword: 'react',
          language: 'TypeScript',
          categoryIds: '1,2',
          sortBy: 'stars_count',
          sortOrder: 'asc',
          dateField: 'starred_at',
          startDate: '2024-01-01',
          endDate: '2024-06-30',
        }),
      )
    })
  })

  // ================================================================
  // retryFailedClones — 重试失败项（状态校验）
  // ================================================================

  describe('retryFailedClones', () => {
    it('任务不存在 → 返回失败', async () => {
      mockPrisma.cloneTask.findUnique.mockResolvedValue(null)
      const r = await service.retryFailedClones('no-such')
      expect(r.success).toBe(false)
    })

    it('任务 PENDING → 不可重试', async () => {
      mockPrisma.cloneTask.findUnique.mockResolvedValue({ taskId: 'p1', status: 'PENDING' })
      const r = await service.retryFailedClones('p1')
      expect(r.success).toBe(false)
      expect(r.message).toContain('无法重试')
    })

    it('有任务但无 FAILED 子项 → 返回失败并提示', async () => {
      mockPrisma.cloneTask.findUnique.mockResolvedValue({
        taskId: 'c1',
        status: 'FAILED',
        targetDir: '/target',
        concurrency: 3,
        cloneDepth: 1,
      })
      mockPrisma.cloneTask.update.mockResolvedValue({})
      mockPrisma.cloneTaskItem.findMany.mockResolvedValue([])
      const r = await service.retryFailedClones('c1')
      expect(r.success).toBe(false)
      expect(r.message).toContain('没有需要重试的失败项')
    })
  })
})
