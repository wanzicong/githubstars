/**
 * sanitizeSubdirectory + buildTargetPath 工具函数测试
 *
 * 安全关键输入校验：路径穿越、非法字符、Windows 保留名等。
 */
import { describe, it, expect } from 'vitest'
import { sanitizeSubdirectory, buildTargetPath } from '../../src/utils/clonePath'

describe('sanitizeSubdirectory', () => {
  describe('正常路径', () => {
    it('合法路径直接返回', () => {
      expect(sanitizeSubdirectory('my-repos')).toEqual({ value: 'my-repos' })
      expect(sanitizeSubdirectory('github/stars')).toEqual({ value: 'github/stars' })
    })

    it('首尾斜杠自动去除', () => {
      expect(sanitizeSubdirectory('/my-repos/')).toEqual({ value: 'my-repos' })
      expect(sanitizeSubdirectory('///my-repos///')).toEqual({ value: 'my-repos' })
    })

    it('反斜杠转为正斜杠', () => {
      expect(sanitizeSubdirectory('github\\stars\\2024')).toEqual({ value: 'github/stars/2024' })
    })
  })

  describe('空值处理', () => {
    it('空字符串 → 返回空值（无错误）', () => {
      expect(sanitizeSubdirectory('')).toEqual({ value: '' })
    })

    it('纯空白 → 返回空值', () => {
      expect(sanitizeSubdirectory('   ')).toEqual({ value: '' })
    })
  })

  describe('路径穿越', () => {
    it('.. 应被拒绝', () => {
      const result = sanitizeSubdirectory('..')
      expect(result.error).toBeDefined()
      expect(result.value).toBe('')
    })

    it('../etc/passwd 应被拒绝', () => {
      const result = sanitizeSubdirectory('../etc/passwd')
      expect(result.error).toBeDefined()
    })

    it('. 应被拒绝', () => {
      const result = sanitizeSubdirectory('.')
      expect(result.error).toBeDefined()
    })

    it('嵌套 .. 应被拒绝', () => {
      const result = sanitizeSubdirectory('repos/../../root')
      expect(result.error).toBeDefined()
    })
  })

  describe('盘符', () => {
    it('C: 盘符应被拒绝', () => {
      const result = sanitizeSubdirectory('C:\\windows')
      expect(result.error).toContain('盘符')
    })

    it('D:\\path 应被拒绝', () => {
      const result = sanitizeSubdirectory('D:\\test')
      expect(result.error).toContain('盘符')
    })
  })

  describe('非法字符', () => {
    const illegalChars = ['<', '>', '"', '|', '?', '*']

    for (const char of illegalChars) {
      it(`"${char}" 应被拒绝`, () => {
        const result = sanitizeSubdirectory(`test${char}file`)
        expect(result.error).toBeDefined()
      })
    }
  })

  describe('Windows 保留名', () => {
    const reservedNames = [
      'CON', 'PRN', 'AUX', 'NUL',
      'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
      'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9',
    ]

    for (const name of reservedNames) {
      it(`${name} 应被拒绝`, () => {
        const result = sanitizeSubdirectory(name)
        expect(result.error).toContain('保留名')
      })
    }

    it('CON 大小写不敏感', () => {
      expect(sanitizeSubdirectory('con').error).toBeDefined()
      expect(sanitizeSubdirectory('Con').error).toBeDefined()
    })
  })

  describe('多级路径校验', () => {
    it('合法子路径中包含非法段应被拒绝', () => {
      const result = sanitizeSubdirectory('github/CON/test')
      expect(result.error).toBeDefined()
    })

    it('只有最后一段非法也应被拒绝', () => {
      const result = sanitizeSubdirectory('a/b/NUL')
      expect(result.error).toBeDefined()
    })
  })
})

describe('buildTargetPath', () => {
  it('基础目录 + 子目录 → 完整路径', () => {
    expect(buildTargetPath('/home/user', 'repos')).toEqual({ path: '/home/user/repos' })
  })

  it('子目录非法时返回错误', () => {
    const result = buildTargetPath('/home/user', '../..')
    expect(result.error).toBeDefined()
    expect(result.path).toBe('')
  })

  it('仅基础目录 → 基础目录路径', () => {
    expect(buildTargetPath('/home/user', '')).toEqual({ path: '/home/user' })
  })

  it('基础目录为空 → 返回子目录', () => {
    expect(buildTargetPath('', 'repos')).toEqual({ path: 'repos' })
  })

  it('基础目录末尾斜杠自动去除', () => {
    expect(buildTargetPath('/home/user/', 'repos')).toEqual({ path: '/home/user/repos' })
  })
})
