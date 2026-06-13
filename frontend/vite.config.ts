import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      // API 请求代理 — 所有 /api/* 都转发到后端
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      // 同步管理 API（后端路径：/api/sync/status, /api/sync/logs, /api/sync/manual）
      // 注意：页面请求（Accept: text/html）不要代理，交给 SPA
      '/sync': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (path) => '/api' + path,
        bypass(req) {
          if (req.headers.accept?.includes('text/html')) {
            return '/index.html'
          }
        },
      },
      // 分类管理 API（后端路径：/api/categories/all 等）
      // 页面请求不代理
      '/categories': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (path) => '/api' + path,
        bypass(req) {
          if (req.headers.accept?.includes('text/html')) {
            return '/index.html'
          }
        },
      },
      // AI 分类 API（后端路径：/api/ai/classify/*）
      // 页面请求不代理
      '/ai': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (path) => '/api' + path,
        bypass(req) {
          if (req.headers.accept?.includes('text/html')) {
            return '/index.html'
          }
        },
      },
      // 作者中心 API（后端路径：/api/authors/*）
      // 页面请求不代理
      '/authors': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (path) => '/api' + path,
        bypass(req) {
          if (req.headers.accept?.includes('text/html')) {
            return '/index.html'
          }
        },
      },
      // 导出接口（后端路径：/api/stars/export, /api/export/md）
      '/stars/export': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (path) => '/api' + path,
      },
      '/export': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (path) => '/api' + path,
      },
    },
  },
})
