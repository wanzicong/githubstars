import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

/**
 * 全局快捷键 Hook
 *
 * - `Ctrl+K` / `Cmd+K`：跳转到 Star 列表并聚焦搜索框
 * - `/`（非输入状态）：同上，聚焦搜索
 *
 * 仅在 DefaultLayout 挂载时生效一次。
 */
export function useGlobalShortcuts() {
  const navigate = useNavigate()

  useEffect(() => {
    const isEditable = (el: EventTarget | null): boolean => {
      if (!(el instanceof HTMLElement)) return false
      const tag = el.tagName
      return tag === 'INPUT' || tag === 'TEXTAREA' || el.isContentEditable
    }

    const focusSearch = () => {
      navigate('/')
      // 等待路由渲染后聚焦第一个搜索框
      window.setTimeout(() => {
        const input = document.querySelector<HTMLInputElement>('.ant-input-search input, input[placeholder*="搜索"]')
        input?.focus()
      }, 100)
    }

    const handler = (e: KeyboardEvent) => {
      // Ctrl+K / Cmd+K — 始终生效
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        focusSearch()
        return
      }
      // `/` 仅在非输入状态时生效
      if (e.key === '/' && !isEditable(e.target)) {
        e.preventDefault()
        focusSearch()
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [navigate])
}
