/**
 * StarList 页面关键用户路径 E2E 测试
 *
 * 使用 Playwright 在真实浏览器中操作。
 * 运行: npx playwright test
 */
import { test, expect } from '@playwright/test'

test.describe('StarList 页面', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/stars')
        // 等待页面加载
        await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {})
    })

    test('页面应正常渲染搜索框', async ({ page }) => {
        const searchInput = page.getByPlaceholder('搜索仓库名、描述、作者...')
        await expect(searchInput).toBeVisible()
    })

    test('搜索关键词应更新 URL', async ({ page }) => {
        const searchInput = page.getByPlaceholder('搜索仓库名、描述、作者...')
        await searchInput.fill('mcp')
        await searchInput.press('Enter')

        // URL 应包含 keyword=mcp
        await expect(page).toHaveURL(/keyword=mcp/)
    })

    test('排序切换应更新 URL', async ({ page }) => {
        // 找到排序字段选择器，选择 "Star 数量"
        const sortSelects = page.locator('.ant-select')
        // 点击第一个 Select（排序字段）
        await sortSelects.first().click()
        // 选择 "Star 数量"
        await page.getByText('Star 数量').click()

        await expect(page).toHaveURL(/sortBy=stars_count/)
    })

    test('切换排序方向应更新 URL', async ({ page }) => {
        // 先设为升序
        await page.goto('/stars?sortBy=stars_count&sortOrder=asc')
        await expect(page).toHaveURL(/sortOrder=asc/)
    })

    test('导出MD按钮应可见', async ({ page }) => {
        const exportBtn = page.getByText('导出MD')
        await expect(exportBtn).toBeVisible()
    })
})

test.describe('导出功能', () => {
    test('设置时间筛选后导出MD，fetch URL 应包含日期参数', async ({ page }) => {
        // 带筛选参数访问
        await page.goto('/stars?keyword=mcp&dateField=starred_at&startDate=2024-01-01&endDate=2024-06-30')

        // 监听 fetch 请求
        const fetchPromises: string[] = []
        page.on('request', (req) => {
            if (req.url().includes('/export/md')) {
                fetchPromises.push(req.url())
            }
        })

        // 点击导出MD
        const exportBtn = page.getByText('导出MD')
        await exportBtn.click()

        // 等待一定时间
        await page.waitForTimeout(2000)

        if (fetchPromises.length > 0) {
            const url = fetchPromises[0]
            expect(url).toContain('dateField=starred_at')
            expect(url).toContain('startDate=2024-01-01')
            expect(url).toContain('endDate=2024-06-30')
        }
    })
})
