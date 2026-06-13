/**
 * Vitest 全局 Setup
 * - 配置 @testing-library/jest-dom 匹配器
 * - 启动 MSW Server
 * - Mock window.matchMedia (Ant Design 需要)
 * - Mock IntersectionObserver
 */
import '@testing-library/jest-dom/vitest'
import { server } from './mocks/server'
import { cleanup } from '@testing-library/react'

// 启动 MSW Server
beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }))
afterEach(() => {
  server.resetHandlers()
  cleanup()
})
afterAll(() => server.close())

// Mock window.matchMedia (Ant Design)
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
})

// Mock IntersectionObserver
class MockIntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
Object.defineProperty(window, 'IntersectionObserver', {
  writable: true,
  value: MockIntersectionObserver,
})

// Mock scrollTo
window.scrollTo = () => {}

// Suppress Ant Design warning in tests
const originalWarn = console.warn
console.warn = (...args: any[]) => {
  if (typeof args[0] === 'string' && args[0].includes('findDOMNode')) return
  originalWarn.call(console, ...args)
}
