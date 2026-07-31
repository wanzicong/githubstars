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
import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { http, HttpResponse } from 'msw'
import { App } from 'antd'
import { server } from '../mocks/server'

// Mock dayjs
vi.mock('dayjs', () => {
  const dayjsFn = () => ({
    format: () => '20240101_000000',
  })
  // 保留 dayjs 静态方法，避免 setupDayjs 调用 dayjs.extend / dayjs.locale 失败
  return {
    default: Object.assign(dayjsFn, {
      extend: () => {},
      locale: () => {},
    }),
  }
})

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
    <App>
      <MemoryRouter initialEntries={[initialRoute]}>
        <StarList />
      </MemoryRouter>
    </App>,
  )
}

describe('StarList', () => {
  beforeEach(() => {
    server.resetHandlers()
    server.use(http.post('/api/category/tree', () => HttpResponse.json([])))
  })

  describe('初始加载', () => {
    it('应展示加载状态', () => {
      const { container } = renderStarList()
      expect(container.querySelectorAll('.ant-skeleton').length).toBeGreaterThan(0)
    })

    it('数据为空时应展示空状态', async () => {
      // 所有 API 返回空数据（接口已改为 POST）
      server.use(
        http.post('/api/stars/list', () => HttpResponse.json({
          records: [], total: 0, size: 36, current: 1, pages: 0,
        })),
        http.post('/api/stats/overview', () => HttpResponse.json({})),
        http.post('/api/stats/languages', () => HttpResponse.json([])),
      )

      renderStarList()
      await waitFor(() => {
        expect(screen.getByText('暂无仓库数据，请先同步')).toBeDefined()
      })
    }, 10000)

    it('不应再展示 DeepSeek 翻译入口', async () => {
      renderStarList()
      await waitFor(() => {
        expect(screen.getByText('Star 仓库列表')).toBeDefined()
      })
      expect(screen.queryByRole('button', { name: '翻译管理' })).toBeNull()
    })

    it('不应展示未翻译筛选开关，也不应再传递旧 URL 参数', async () => {
      let capturedBody: Record<string, unknown> = {}
      server.use(
        http.post('/api/stars/list', async ({ request }) => {
          capturedBody = await request.json() as Record<string, unknown>
          return HttpResponse.json({ records: [], total: 0, size: 36, current: 1, pages: 0 })
        }),
      )

      renderStarList('/stars?untranslatedOnly=true')

      await waitFor(() => {
        expect(Object.keys(capturedBody).length).toBeGreaterThan(0)
      })
      expect(screen.queryByRole('switch')).toBeNull()
      expect(screen.queryByText('仅未翻译')).toBeNull()
      expect(capturedBody).not.toHaveProperty('untranslatedOnly')
    })
  })

  describe('搜索筛选', () => {
    it('输入关键词后 API 请求应包含 keyword 参数', async () => {
      let capturedKeyword = ''
      server.use(
        http.post('/api/stars/list', async ({ request }) => {
          const body = await request.json() as any
          capturedKeyword = body.keyword || ''
          return HttpResponse.json({ records: [], total: 0, size: 36, current: 1, pages: 0 })
        }),
      )

      renderStarList()
      const input = screen.getByPlaceholderText('搜索仓库名、描述、作者…')
      await userEvent.type(input, 'mcp')
      await userEvent.keyboard('{Enter}')

      await waitFor(() => {
        expect(capturedKeyword).toBe('mcp')
      })
    }, 10000)
  })
})
