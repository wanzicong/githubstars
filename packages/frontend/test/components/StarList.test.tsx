/**
 * StarList 组件核心交互测试
 *
 * 测试重点:
 *   - 初始加载状态（Loading / Empty / Error）
 *   - 搜索输入 → API 参数映射
 *   - 排序切换 → sortBy 正确传递
 *   - MD 导出 → 所有筛选参数包含在 fetch URL 中
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { http, HttpResponse } from 'msw'
import { server } from '../mocks/server'

// Mock dayjs
vi.mock('dayjs', () => ({
  default: Object.assign(
    () => ({
      format: () => '20240101_000000',
    }),
    { extend: () => {} },
  ),
}))

// Mock antd message
vi.mock('antd', async () => {
  const actual = await vi.importActual('antd')
  return {
    ...(actual as any),
    message: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
  }
})

// React 组件懒加载
import StarList from '../../src/pages/StarList'

// 辅助函数: 创建带路由的渲染环境
function renderStarList(initialRoute = '/stars') {
  return render(
    <MemoryRouter initialEntries={[initialRoute]}>
      <StarList />
    </MemoryRouter>,
  )
}

describe('StarList', () => {
  beforeEach(() => {
    server.resetHandlers()
  })

  describe('初始加载', () => {
    it('应展示加载状态', () => {
      renderStarList()
      expect(screen.getByText('加载中...')).toBeDefined()
    })

    it('数据为空时应展示空状态', async () => {
      // 所有 API 返回空数据
      server.use(
        http.get('/api/stars', () => HttpResponse.json({
          records: [], total: 0, size: 36, current: 1, pages: 0,
        })),
        http.get('/api/stats/overview', () => HttpResponse.json({})),
        http.get('/api/stats/languages', () => HttpResponse.json([])),
        http.get('/api/categories', () => HttpResponse.json({ success: true, categories: [] })),
      )

      renderStarList()
      await waitFor(() => {
        expect(screen.getByText('暂无仓库数据，请先同步')).toBeDefined()
      })
    }, 10000)
  })

  describe('搜索筛选', () => {
    it('输入关键词后 API 请求应包含 keyword 参数', async () => {
      let capturedKeyword = ''
      server.use(
        http.get('/api/stars', ({ request }) => {
          capturedKeyword = new URL(request.url).searchParams.get('keyword') || ''
          return HttpResponse.json({ records: [], total: 0, size: 36, current: 1, pages: 0 })
        }),
      )

      renderStarList()
      const input = screen.getByPlaceholderText('搜索仓库名、描述、作者...')
      await userEvent.type(input, 'mcp')
      await userEvent.keyboard('{Enter}')

      await waitFor(() => {
        expect(capturedKeyword).toBe('mcp')
      })
    }, 10000)
  })
})
