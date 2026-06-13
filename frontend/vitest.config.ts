import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
    include: ['test/**/*.{test,spec}.{ts,tsx}'],
    css: true,
    // 匹配 Vite 的路径别名（如果有的话）
    resolve: {
      alias: {
        '@': '/src',
      },
    },
  },
})
