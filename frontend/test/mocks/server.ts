/**
 * MSW (Mock Service Worker) Server
 * 在测试中拦截所有 API 请求，返回预定义的 Mock 数据。
 */
import { setupServer } from 'msw/node'
import { handlers } from './handlers'

export const server = setupServer(...handlers)
