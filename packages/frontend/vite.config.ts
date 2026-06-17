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
      // 以下路径的前端 SPA 页面会被 Vite 处理（Accept: text/html 不代理）
      // API 请求（Accept 非 html）会被代理到后端 /api + path
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
