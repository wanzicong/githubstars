import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

export default defineConfig({
  // 桌面端 Electron 通过 file:// 加载，必须用相对路径
  // Web 端（Vite dev server）路径拼接不受影响
  base: './',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 10001,
    proxy: {
      // Agent API — 转发到 Agent 服务 (:10003，必须在 /api 通用规则之前)
      '/api/agent': {
        target: 'http://localhost:10003',
        changeOrigin: true,
      },
      // API 请求代理 — 所有 /api/* 都转发到后端
      '/api': {
        target: 'http://localhost:10002',
        changeOrigin: true,
      },
      // 以下路径的前端 SPA 页面会被 Vite 处理（Accept: text/html 不代理）
      // API 请求（Accept 非 html）会被代理到后端 /api + path
      '/sync': {
        target: 'http://localhost:10002',
        changeOrigin: true,
        rewrite: (path) => '/api' + path,
        bypass(req) {
          if (req.headers.accept?.includes('text/html')) {
            return '/index.html'
          }
        },
      },
      '/authors': {
        target: 'http://localhost:10002',
        changeOrigin: true,
        rewrite: (path) => '/api' + path,
        bypass(req) {
          if (req.headers.accept?.includes('text/html')) {
            return '/index.html'
          }
        },
      },
      '/stars/export': {
        target: 'http://localhost:10002',
        changeOrigin: true,
        rewrite: (path) => '/api' + path,
      },
      '/export': {
        target: 'http://localhost:10002',
        changeOrigin: true,
        rewrite: (path) => '/api' + path,
      },
    },
  },
})
