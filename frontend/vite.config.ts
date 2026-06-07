import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      // API 请求代理 — 所有 /api/* 都转发到后端
      '/api': {
        target: 'http://localhost:6001',
        changeOrigin: true,
      },
      // 同步管理 API（后端路径：/sync/status, /sync/logs, /sync/manual）
      // 注意：页面请求（Accept: text/html）不要代理，交给 SPA
      '/sync': {
        target: 'http://localhost:6001',
        changeOrigin: true,
        bypass(req) {
          if (req.headers.accept?.includes('text/html')) {
            return '/index.html'
          }
        },
      },
      // 分类管理 API（后端路径：/categories/all 等）
      // 页面请求不代理
      '/categories': {
        target: 'http://localhost:6001',
        changeOrigin: true,
        bypass(req) {
          if (req.headers.accept?.includes('text/html')) {
            return '/index.html'
          }
        },
      },
      // AI 分类 API（后端路径：/ai/classify/*）
      // 页面请求不代理
      '/ai': {
        target: 'http://localhost:6001',
        changeOrigin: true,
        bypass(req) {
          if (req.headers.accept?.includes('text/html')) {
            return '/index.html'
          }
        },
      },
      // 作者中心 API（后端路径：/api/authors/*）
      // 页面请求不代理
      '/authors': {
        target: 'http://localhost:6001',
        changeOrigin: true,
        bypass(req) {
          if (req.headers.accept?.includes('text/html')) {
            return '/index.html'
          }
        },
      },
      // 导出接口
      '/stars/export': {
        target: 'http://localhost:6001',
        changeOrigin: true,
      },
      '/export': {
        target: 'http://localhost:6001',
        changeOrigin: true,
      },
      '/api/clone': {
        target: 'http://localhost:6001',
        changeOrigin: true,
      },
    },
  },
})
