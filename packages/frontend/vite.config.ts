import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

export default defineConfig({
  // 桌面端 Electron 通过 file:// 加载，必须用相对路径（默认 './'）
  // Web 端 Docker 部署用绝对路径，避免深路由下资产路径错乱（构建时设 VITE_BASE=/ 即可覆盖）
  base: process.env.VITE_BASE ?? './',
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
