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
      // API 请求代理 — 所有 /api/* 都转发到后端
      '/api': {
        target: 'http://localhost:10002',
        changeOrigin: true,
      },
    },
  },
})
