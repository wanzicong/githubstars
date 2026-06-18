import api from './request'
import type { GithubRepo, TranslateTaskProgress, TaskListResult } from '../types'

/** 翻译单个仓库的描述 */
export async function translateDescription(repoId: number): Promise<{ success: boolean; translated?: boolean; message?: string }> {
    const { data } = await api.post<{ success: boolean; translated?: boolean; message?: string }>('/api/translate/description', { id: repoId })
    return data
}

/** 获取仓库详情（从 Star API，translate 模块需要此能力） */
export async function fetchRepoDetail(repoId: number): Promise<GithubRepo> {
    const { data } = await api.post<GithubRepo>('/api/stars/detail', { id: repoId })
    return data
}

/** 启动单个仓库的 README 翻译（异步，立即返回 taskId） */
export async function startSingleReadme(repoId: number): Promise<{ success: boolean; taskId?: number; message?: string }> {
    const { data } = await api.post('/api/translate/readme-async', { id: repoId })
    return data
}

/** 强制重新翻译单个仓库的 README（异步，忽略已处理标记） */
export async function retranslateReadme(repoId: number): Promise<{ success: boolean; taskId?: number; message?: string }> {
    const { data } = await api.post('/api/translate/retranslate', { id: repoId })
    return data
}

/** 批量翻译描述 */
export async function translateBatch(repoIds?: number[]): Promise<{ success: boolean; taskId?: number; message?: string }> {
    const { data } = await api.post('/api/translate', {
        type: 'description',
        scope: repoIds?.length ? 'selected' : 'all',
        repoIds,
    })
    return data
}

/** 启动全量翻译（异步）
 * @deprecated 使用 createTranslateTask 替代
 */
export async function startFullTranslate(): Promise<{ success: boolean; taskId?: number; message?: string }> {
    const { data } = await api.post('/api/translate', { type: 'both', scope: 'all' })
    return data
}

/** 
 * @deprecated 使用 createTranslateTask 替代
 */
export async function startReadmeBatch(): Promise<{ success: boolean; taskId?: number; message?: string }> {
    const { data } = await api.post('/api/translate', { type: 'readme', scope: 'all' })
    return data
}

/** 获取翻译任务进度 */
export async function getTaskProgress(taskId: number): Promise<TranslateTaskProgress> {
    const { data } = await api.post<TranslateTaskProgress>('/api/translate/tasks/detail', { id: taskId })
    return data
}

/** 重试失败项 */
export async function retryFailed(taskId: number): Promise<{ success: boolean; taskId?: number; message?: string }> {
    const { data } = await api.post('/api/translate/tasks/retry', { id: taskId })
    return data
}

/** 基于筛选条件批量翻译描述
 * @deprecated 使用 createTranslateTask 替代
 */
export async function startFilterBatch(params: {
    keyword?: string
    language?: string
    categoryIds?: string
    sortBy?: string
    sortOrder?: string
    dateField?: string
    startDate?: string
    endDate?: string
}): Promise<{ success: boolean; taskId?: number; message?: string }> {
    const { data } = await api.post('/api/translate', {
        type: 'description',
        scope: 'filtered',
        filters: params,
    })
    return data
}

/** 获取最近任务列表 */
export async function getRecentTasks(): Promise<TaskListResult> {
    const { data } = await api.post<TaskListResult>('/api/translate/tasks/list')
    return data
}

/** 【新】统一创建翻译任务 (合并了 start/filter-batch/readme-start/batch) */
export async function createTranslateTask(params: {
    type: 'description' | 'readme' | 'both'
    scope: 'filtered' | 'all' | 'selected'
    repoIds?: number[]
    filters?: Record<string, string | undefined>
}): Promise<{ success: boolean; taskId?: number; message?: string; translatedCount?: number }> {
    const { data } = await api.post('/api/translate', params)
    return data
}

/** 获取翻译配置（检查 API Key 是否已配置） */
export async function getTranslateConfig(): Promise<{ success: boolean; apiKeyConfigured: boolean }> {
    const { data } = await api.post('/api/translate/config')
    return data
}

/** 获取翻译覆盖统计 */
export async function getTranslationStatus(filters?: Record<string, string | undefined>): Promise<{
    success: boolean
    total: number
    descCompleted: number
    descPending: number
    readmeCompleted: number
    readmePending: number
}> {
    const body: Record<string, any> = {}
    if (filters) {
        Object.entries(filters).forEach(([k, v]) => {
            if (v) body[k] = v === 'true' ? true : v
        })
    }
    const { data } = await api.post('/api/translate/status', body)
    return data
}
