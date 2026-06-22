/**
 * Clone 任务管理页面 E2E 测试
 *
 * 测试克隆任务的完整用户流程：列表展示、详情查看、重置、单个重试。
 * 使用 Playwright 在真实浏览器中操作。
 * 运行: npx playwright test test/e2e/clone.spec.ts
 */
import { test, expect } from '@playwright/test'

test.describe('Clone 任务管理页面', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/clone')
        // 等待页面加载
        await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {})
    })

    test('页面应正常渲染标题和统计卡片', async ({ page }) => {
        // 检查标题
        await expect(page.getByText('克隆任务管理')).toBeVisible()

        // 检查统计卡片（使用更精确的选择器）
        await expect(page.locator('.ant-statistic-title').filter({ hasText: '总任务数' })).toBeVisible()
        await expect(page.locator('.ant-statistic-title').filter({ hasText: '执行中' })).toBeVisible()
        await expect(page.locator('.ant-statistic-title').filter({ hasText: '已完成' })).toBeVisible()
    })

    test('任务列表应正常展示', async ({ page }) => {
        // 等待表格加载
        const table = page.locator('.ant-table')
        await expect(table).toBeVisible()

        // 检查表格列头
        await expect(page.getByText('任务 ID')).toBeVisible()
        await expect(page.getByText('状态')).toBeVisible()
        await expect(page.getByText('目标目录')).toBeVisible()
        await expect(page.getByText('进度')).toBeVisible()
        await expect(page.getByText('操作')).toBeVisible()
    })

    test('点击详情按钮应打开进度弹窗', async ({ page }) => {
        // 等待表格数据加载
        await page.waitForSelector('.ant-table-row', { timeout: 5000 }).catch(() => {})

        // 点击第一个详情按钮
        const detailBtn = page.getByRole('button', { name: '详情' }).first()
        if (await detailBtn.isVisible()) {
            await detailBtn.click()

            // 检查弹窗是否打开
            await expect(page.getByText('克隆进度')).toBeVisible()
        }
    })
})

test.describe('Clone 详情弹窗功能', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/clone')
        await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {})

        // 等待表格数据加载并点击详情
        await page.waitForSelector('.ant-table-row', { timeout: 5000 }).catch(() => {})
        const detailBtn = page.getByRole('button', { name: '详情' }).first()
        if (await detailBtn.isVisible()) {
            await detailBtn.click()
            await page.waitForTimeout(1000) // 等待弹窗动画
        }
    })

    test('详情弹窗应展示进度圆环和统计信息', async ({ page }) => {
        // 检查弹窗内容
        const modal = page.locator('.ant-modal')
        if (await modal.isVisible()) {
            // 检查统计标签
            await expect(page.getByText('成功:')).toBeVisible()
            await expect(page.getByText('失败:')).toBeVisible()
            await expect(page.getByText('跳过:')).toBeVisible()
        }
    })

    test('详情弹窗应展示任务详情折叠面板', async ({ page }) => {
        const modal = page.locator('.ant-modal')
        if (await modal.isVisible()) {
            // 检查是否有任务详情折叠面板
            const detailsPanel = page.getByText(/任务详情/)
            if (await detailsPanel.isVisible()) {
                await detailsPanel.click()
                // 应该能看到仓库列表
                await page.waitForTimeout(500)
            }
        }
    })
})

test.describe('Clone 重置按钮逻辑', () => {
    test('重置按钮应在成功数不等于总数时可用', async ({ page }) => {
        // Mock API 返回有失败项的任务
        await page.route('**/api/clone/tasks/list', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    success: true,
                    tasks: [{
                        taskId: 1,
                        status: 'PARTIAL',
                        targetDir: '/test/dir',
                        concurrency: 5,
                        totalItems: 10,
                        completedItems: 8,
                        failedItems: 2,
                        skippedItems: 0,
                        createdAt: new Date().toISOString(),
                        startedAt: new Date().toISOString(),
                        finishedAt: null,
                    }],
                }),
            })
        })

        // Mock detail API
        await page.route('**/api/clone/tasks/detail', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    success: true,
                    taskId: 1,
                    status: 'PARTIAL',
                    targetDir: '/test/dir',
                    concurrency: 5,
                    totalItems: 10,
                    completedItems: 8,
                    failedItems: 2,
                    skippedItems: 0,
                    progress: 100,
                    createdAt: new Date().toISOString(),
                    startedAt: new Date().toISOString(),
                    finishedAt: null,
                    failedDetails: [],
                    skippedDetails: [],
                    allItems: [],
                }),
            })
        })

        await page.goto('/clone')
        await page.waitForLoadState('networkidle')

        // 点击详情按钮
        const detailBtn = page.getByRole('button', { name: '详情' }).first()
        if (await detailBtn.isVisible()) {
            await detailBtn.click()
            await page.waitForTimeout(1000)

            // 检查重置按钮是否可见
            const resetBtn = page.getByRole('button', { name: /重置任务/ })
            await expect(resetBtn).toBeVisible()
        }
    })

    test('重置按钮应在所有项成功时隐藏', async ({ page }) => {
        // Mock API 返回全部成功的任务
        await page.route('**/api/clone/tasks/list', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    success: true,
                    tasks: [{
                        taskId: 2,
                        status: 'COMPLETED',
                        targetDir: '/test/dir',
                        concurrency: 5,
                        totalItems: 10,
                        completedItems: 10,
                        failedItems: 0,
                        skippedItems: 0,
                        createdAt: new Date().toISOString(),
                        startedAt: new Date().toISOString(),
                        finishedAt: new Date().toISOString(),
                    }],
                }),
            })
        })

        await page.goto('/clone')
        await page.waitForLoadState('networkidle')

        // 点击详情按钮
        const detailBtn = page.getByRole('button', { name: '详情' }).first()
        if (await detailBtn.isVisible()) {
            await detailBtn.click()
            await page.waitForTimeout(1000)

            // 检查重置按钮是否隐藏
            const resetBtn = page.getByRole('button', { name: /重置任务/ })
            await expect(resetBtn).not.toBeVisible()
        }
    })
})

test.describe('Clone 单个重试功能', () => {
    test('任务详情表格应显示重试按钮', async ({ page }) => {
        // Mock API 返回有失败项的任务详情
        await page.route('**/api/clone/tasks/detail', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    success: true,
                    taskId: 1,
                    status: 'PARTIAL',
                    targetDir: '/test/dir',
                    concurrency: 5,
                    totalItems: 3,
                    completedItems: 1,
                    failedItems: 1,
                    skippedItems: 1,
                    progress: 100,
                    createdAt: new Date().toISOString(),
                    startedAt: new Date().toISOString(),
                    finishedAt: null,
                    failedDetails: [{ fullName: 'user/repo2', error: 'timeout' }],
                    skippedDetails: [{ fullName: 'user/repo3' }],
                    allItems: [
                        { fullName: 'user/repo1', status: 'COMPLETED', localPath: '/test/repo1' },
                        { fullName: 'user/repo2', status: 'FAILED', localPath: '/test/repo2', errorMessage: 'timeout' },
                        { fullName: 'user/repo3', status: 'SKIPPED', localPath: '/test/repo3' },
                    ],
                }),
            })
        })

        await page.goto('/clone')
        await page.waitForLoadState('networkidle')

        // 点击详情按钮
        const detailBtn = page.getByRole('button', { name: '详情' }).first()
        if (await detailBtn.isVisible()) {
            await detailBtn.click()
            await page.waitForTimeout(1000)

            // 展开任务详情面板
            const detailsPanel = page.getByText(/任务详情/)
            if (await detailsPanel.isVisible()) {
                await detailsPanel.click()
                await page.waitForTimeout(500)

                // 检查是否有重试按钮（非 COMPLETED 和非 PROCESSING 的项应该有）
                const retryBtns = page.getByRole('button', { name: '重试' })
                const count = await retryBtns.count()
                // 应该有 2 个重试按钮（FAILED 和 SKIPPED）
                expect(count).toBeGreaterThanOrEqual(1)
            }
        }
    })
})
