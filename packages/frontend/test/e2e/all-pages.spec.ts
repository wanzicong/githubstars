import { test, expect } from '@playwright/test';

const BASE = process.env.BASE_URL || 'http://localhost:10001';

/** 所有页面路由及标题 */
const PAGES = [
    { path: '/', title: /GitHub Stars/ },
    { path: '/sync', title: /同步管理/ },
    { path: '/stats', title: /数据统计/ },
    { path: '/authors', title: /作者中心/ },
    { path: '/search', title: /GitHub搜索/ },
    { path: '/trending', title: /趋势排行/ },
    { path: '/categories', title: /分类管理/ },
    { path: '/clone', title: /克隆管理/ },
    { path: '/settings', title: /系统配置/ },
    { path: '/logs', title: /系统日志/ },
];

test.describe('全页面冒烟测试', () => {
    for (const { path, title } of PAGES) {
        test(`页面 ${path} 应正常加载`, async ({ page }) => {
            const errors: string[] = [];
            page.on('console', (msg) => {
                if (msg.type() === 'error') errors.push(msg.text());
            });

            const response = await page.goto(`${BASE}${path}`, {
                waitUntil: 'domcontentloaded',
                timeout: 20000,
            });

            // 页面应返回 200
            expect(response?.status()).toBe(200);

            // 页面标题应包含预期内容
            await expect(page).toHaveTitle(title);

            // 等待主要内容区域渲染
            await page.waitForSelector('main', { timeout: 10000 });

            // 不应有白色错误页面
            const errorText = await page.locator('body').textContent();
            expect(errorText).not.toContain('Unexpected Application Error');

            // 不应有 JS 运行时错误
            expect(errors.filter((e) => !e.includes('antd') && !e.includes('deprecated'))).toEqual([]);
        });
    }
});

test.describe('详情页测试', () => {
    test('Star详情页 /stars/999 应展示空状态', async ({ page }) => {
        await page.goto(`${BASE}/stars/999`, { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('main', { timeout: 10000 });
        const text = await page.textContent('main');
        // 应展示"仓库不存在"或类似提示
        expect(text).toMatch(/未找到|不存在|暂无/);
    });

    test('作者详情页 /authors/nonexistent 应展示空状态', async ({ page }) => {
        await page.goto(`${BASE}/authors/nonexistent`, { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('main', { timeout: 10000 });
        const text = await page.textContent('main');
        const hasText = /暂无/.test(text) || text.includes('无') && text.includes('仓库')
        expect(hasText).toBe(true);
    });
});

test.describe('API错误处理', () => {
    test('首页 API 失败时页面不应崩溃', async ({ page }) => {
        // Mock API 返回 500
        await page.route('**/api/**', (route) => {
            route.fulfill({ status: 500, body: JSON.stringify({ message: 'Server Error' }) });
        });

        await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('main', { timeout: 10000 });

        // 页面不应崩溃（白屏）
        const text = await page.locator('body').textContent();
        expect(text).not.toContain('Unexpected Application Error');
    });

    test('数据统计页 API 失败时页面不应崩溃', async ({ page }) => {
        await page.route('**/api/stats/**', (route) => {
            route.fulfill({ status: 500, body: JSON.stringify({ message: 'Server Error' }) });
        });

        await page.goto(`${BASE}/stats`, { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('main', { timeout: 10000 });

        const text = await page.locator('body').textContent();
        expect(text).not.toContain('Unexpected Application Error');
    });
});
