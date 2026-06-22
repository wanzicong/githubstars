/**
 * Playwright E2E 测试配置
 */
import { defineConfig } from '@playwright/test'

const baseURL = process.env.BASE_URL || 'http://localhost:10001'
const port = new URL(baseURL).port

export default defineConfig({
  testDir: './test/e2e',
  timeout: 30000,
  retries: 0,
  use: {
    baseURL,
    headless: true,
    viewport: { width: 1280, height: 800 },
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'npm run dev',
    port: Number(port),
    reuseExistingServer: true,
    timeout: 60000,
  },
})
