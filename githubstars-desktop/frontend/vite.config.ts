import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Electron 桌面端开发模式：Express 后端运行在 6002 端口（避开 Spring Boot 的 6001）
const BACKEND_PORT = process.env.SERVER_PORT || '6002'
const BACKEND_URL = `http://localhost:${BACKEND_PORT}`

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      // API 请求代理 — 所有 /api/* 都转发到 Express 后端
      '/api': {
        target: BACKEND_URL,
        changeOrigin: true,
      },
      // 同步管理 API
      '/sync': {
        target: BACKEND_URL,
        changeOrigin: true,
        bypass(req) {
          if (req.headers.accept?.includes('text/html')) {
            return '/index.html'
          }
        },
      },
      // 分类管理 API
      '/categories': {
        target: BACKEND_URL,
        changeOrigin: true,
        bypass(req) {
          if (req.headers.accept?.includes('text/html')) {
            return '/index.html'
          }
        },
      },
      // AI 分类 API
      '/ai': {
        target: BACKEND_URL,
        changeOrigin: true,
        bypass(req) {
          if (req.headers.accept?.includes('text/html')) {
            return '/index.html'
          }
        },
      },
      // 作者中心页面路由（不代理）
      '/authors': {
        target: BACKEND_URL,
        changeOrigin: true,
        bypass(req) {
          if (req.headers.accept?.includes('text/html')) {
            return '/index.html'
          }
        },
      },
      // 导出接口
      '/stars/export': {
        target: BACKEND_URL,
        changeOrigin: true,
      },
    },
  },
  // 生产构建：base 使用 ./ 适配 Electron file:// 或本地 HTTP 加载
  base: './',
})
