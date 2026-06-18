/**
 * MSW Handlers 聚合导出
 */
import { http, HttpResponse } from 'msw'

// ============ 通用响应工厂 ============

export function createPageResult<T>(records: T[], total?: number, params?: { size?: number; current?: number }) {
    const t = total ?? records.length
    const s = params?.size ?? 36
    return {
        records,
        total: t,
        size: s,
        current: params?.current ?? 1,
        pages: Math.ceil(t / s),
    }
}

export function createSuccess(data: any) {
    return HttpResponse.json({ success: true, ...data })
}

// ============ Stars ============

export const starsHandlers = [
    http.post('/api/stars/list', () => {
        return HttpResponse.json(createPageResult([], 0))
    }),
    http.post('/api/stars/detail', () => {
        return HttpResponse.json({ success: true, id: 1 })
    }),
    http.post('/api/stars/export', () => {
        return HttpResponse.json('https://github.com/test/repo1\nhttps://github.com/test/repo2')
    }),
    http.post('/api/export/md', () => {
        return new HttpResponse('# GitHub Stars 导出\n\n> 关键词: test\n> 导出时间: 2024-01-01T00:00:00.000Z', {
            headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        })
    }),
]

// ============ Sync ============

export const syncHandlers = [
    http.post('/api/sync/manual', () => {
        return createSuccess({ message: '同步已开始' })
    }),
    http.post('/api/sync/status', () => {
        return HttpResponse.json({
            success: true,
            syncing: false,
            inProgress: false,
            lastStatus: 'SUCCESS',
            lastSyncTime: '2024-01-01T00:00:00.000Z',
            lastSyncCount: 100,
            lastSyncType: 'manual',
        })
    }),
    http.post('/api/sync/logs', () => {
        return HttpResponse.json(
            createPageResult([
                {
                    id: 1,
                    syncType: 'manual',
                    status: 'SUCCESS',
                    totalCount: 100,
                    syncedCount: 100,
                    startedAt: '2024-01-01T00:00:00.000Z',
                    finishedAt: '2024-01-01T00:05:00.000Z',
                    createdAt: '2024-01-01T00:00:00.000Z',
                },
            ]),
        )
    }),
]

// ============ Translate ============

export const translateHandlers = [
    http.post('/api/translate/status', () => {
        return HttpResponse.json({
            success: true,
            total: 100,
            descCompleted: 80,
            descPending: 20,
            readmeCompleted: 50,
            readmePending: 50,
        })
    }),
    http.post('/api/translate/tasks/list', () => {
        return HttpResponse.json({
            success: true,
            tasks: [],
        })
    }),
    http.post('/api/translate', () => {
        return createSuccess({ taskId: 1, message: '翻译任务已创建' })
    }),
    http.post('/api/translate/tasks/detail', () => {
        return HttpResponse.json({
            success: true,
            taskId: 1,
            status: 'COMPLETED',
            totalItems: 10,
            completedItems: 10,
            failedItems: 0,
            descTotal: 5,
            descCompleted: 5,
            descFailed: 0,
            readmeTotal: 5,
            readmeCompleted: 5,
            readmeFailed: 0,
            createdAt: '2024-01-01T00:00:00.000Z',
            finishedAt: '2024-01-01T00:05:00.000Z',
            progress: 100,
        })
    }),
    http.post('/api/translate/tasks/retry', () => {
        return createSuccess({ taskId: 2, message: '重试任务已创建' })
    }),
]

// ============ Stats ============

export const statsHandlers = [
    http.post('/api/stats/overview', () => {
        return HttpResponse.json({
            totalRepos: 100,
            totalStars: 50000,
            totalForks: 10000,
            totalLanguages: 15,
            totalOwners: 80,
        })
    }),
    http.post('/api/stats/languages', () => {
        return HttpResponse.json([
            { language: 'TypeScript', count: 40, percentage: 40 },
            { language: 'Python', count: 30, percentage: 30 },
            { language: 'Go', count: 20, percentage: 20 },
            { language: 'Rust', count: 10, percentage: 10 },
        ])
    }),
    http.post('/api/stats/owners', () => {
        return HttpResponse.json([
            {
                ownerName: 'google',
                repoCount: 15,
                totalStars: 10000,
                primaryLanguage: 'TypeScript',
                lastStarredAt: '2024-01-01T00:00:00.000Z',
            },
        ])
    }),
    http.post('/api/stats/timeline', () => {
        return HttpResponse.json([
            { month: '2024-01', count: 15 },
            { month: '2024-02', count: 20 },
            { month: '2024-03', count: 10 },
        ])
    }),
    http.post('/api/stats/top-starred', () => {
        return HttpResponse.json([])
    }),
    http.post('/api/stats/recent-active', () => {
        return HttpResponse.json([])
    }),
]

// ============ Config ============

export const configHandlers = [
    http.post('/api/config/list', () => {
        return HttpResponse.json([
            { configKey: 'github.token', configValue: 'ghp_****xxxx', description: 'GitHub Token' },
            { configKey: 'deepseek.api_key', configValue: 'sk_****xxxx', description: 'DeepSeek API Key' },
        ])
    }),
]

// ============ Author ============

export const authorHandlers = [
    http.post('/api/authors/list', () => {
        return HttpResponse.json(createPageResult([], 0))
    }),
    http.post('/api/authors/repos', () => {
        return HttpResponse.json(createPageResult([], 0))
    }),
]

// ============ Trending ============

export const trendingHandlers = [
    http.post('/api/trending', () => {
        return HttpResponse.json({
            success: true,
            since: 'daily',
            total: 0,
            repos: [],
            dateRange: '2024-01-01 ~ 2024-01-02',
        })
    }),
]

// ============ Logs ============

export const logsHandlers = [
    http.post('/api/logs/files', () => {
        return HttpResponse.json({ success: true, files: [] })
    }),
]

// ============ 聚合全部 ============

export const handlers = [
    ...starsHandlers,
    ...syncHandlers,
    ...translateHandlers,
    ...statsHandlers,
    ...configHandlers,
    ...authorHandlers,
    ...trendingHandlers,
    ...logsHandlers,
]
