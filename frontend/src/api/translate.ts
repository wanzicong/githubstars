import api from './request'
import type { GithubRepo } from '../types'

export interface TranslateResult {
  success: boolean
  descriptionCn?: string | null
  readmeCn?: string | null
  readmeFetched?: boolean
  message?: string
  translatedCount?: number
  total?: number
}

export interface TranslateTaskProgress {
  success: boolean
  taskId: number
  status: string
  totalItems: number
  completedItems: number
  failedItems: number
  pendingItems: number
  descTotal: number
  descCompleted: number
  descFailed: number
  readmeTotal: number
  readmeCompleted: number
  readmeFailed: number
  createdAt: string
  finishedAt: string | null
  progress: number
  /** 已完成项明细（成功时也有备注，如"该仓库没有 README 文件"） */
  completedDetails?: Array<{ fullName: string; type: string; note: string }>
  /** 失败项明细 */
  failedDetails?: Array<{ fullName: string; type: string; error: string }>
}

export interface TaskListResult {
  success: boolean
  tasks: Array<{
    id: number
    status: string
    totalItems: number
    completedItems: number
    failedItems: number
    createdAt: string
    finishedAt: string | null
  }>
}

/** 翻译单个仓库的描述 */
export async function translateDescription(repoId: number): Promise<TranslateResult> {
  const { data } = await api.post<TranslateResult>(`/api/translate/${repoId}/description`)
  return data
}

/** 翻译单个仓库的 README */
export async function translateReadme(repoId: number): Promise<TranslateResult> {
  const { data } = await api.post<TranslateResult>(`/api/translate/${repoId}/readme`)
  return data
}

/** 全量翻译单个仓库（描述 + README） */
export async function translateAll(repoId: number): Promise<TranslateResult> {
  const { data } = await api.post<TranslateResult>(`/api/translate/${repoId}`)
  return data
}

/** 批量翻译描述 */
export async function translateBatch(repoIds?: number[]): Promise<TranslateResult> {
  const body = repoIds ? { repoIds } : {}
  const { data } = await api.post<TranslateResult>('/api/translate/batch', body)
  return data
}

/** 获取翻译状态 */
export async function getTranslateStatus(repoId: number): Promise<TranslateResult> {
  const { data } = await api.get<TranslateResult>(`/api/translate/${repoId}/status`)
  return data
}

/** 获取仓库详情 */
export async function fetchRepoDetail(repoId: number): Promise<GithubRepo> {
  const { data } = await api.get<GithubRepo>(`/api/stars/${repoId}`)
  return data
}

/** 启动全量翻译（异步） */
export async function startFullTranslate(): Promise<{ success: boolean; taskId?: number; message?: string }> {
  const { data } = await api.post('/api/translate/start')
  return data
}

/** 启动单个仓库的 README 翻译（异步，立即返回 taskId） */
export async function startSingleReadme(repoId: number): Promise<{ success: boolean; taskId?: number; message?: string }> {
  const { data } = await api.post(`/api/translate/${repoId}/readme/async`)
  return data
}

/** 强制重新翻译单个仓库的 README（异步，忽略已处理标记） */
export async function retranslateReadme(repoId: number): Promise<{ success: boolean; taskId?: number; message?: string }> {
  const { data } = await api.post(`/api/translate/${repoId}/readme/retranslate`)
  return data
}

/** 启动 README 批量翻译（翻译全部未获取 README 的仓库，异步） */
export async function startReadmeBatch(): Promise<{ success: boolean; taskId?: number; message?: string }> {
  const { data } = await api.post('/api/translate/readme-start')
  return data
}

/** 获取翻译任务进度 */
export async function getTaskProgress(taskId: number): Promise<TranslateTaskProgress> {
  const { data } = await api.get<TranslateTaskProgress>(`/api/translate/tasks/${taskId}`)
  return data
}

/** 重试失败项 */
export async function retryFailed(taskId: number): Promise<{ success: boolean; taskId?: number; message?: string }> {
  const { data } = await api.post(`/api/translate/tasks/${taskId}/retry`)
  return data
}

/** 获取失败项列表 */
export async function getTaskFailures(taskId: number): Promise<{ success: boolean; failures: Array<{ id: number; repoId: number; fullName: string; translateType: string; errorMessage: string }>; count: number }> {
  const { data } = await api.get(`/api/translate/tasks/${taskId}/failures`)
  return data
}

/** 基于筛选条件批量翻译描述 */
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
  const searchParams = new URLSearchParams()
  if (params.keyword) searchParams.set('keyword', params.keyword)
  if (params.language) searchParams.set('language', params.language)
  if (params.categoryIds) searchParams.set('categoryIds', params.categoryIds)
  if (params.sortBy) searchParams.set('sortBy', params.sortBy)
  if (params.sortOrder) searchParams.set('sortOrder', params.sortOrder)
  if (params.dateField) searchParams.set('dateField', params.dateField)
  if (params.startDate) searchParams.set('startDate', params.startDate)
  if (params.endDate) searchParams.set('endDate', params.endDate)
  const { data } = await api.post(`/api/translate/filter-batch?${searchParams.toString()}`)
  return data
}

/** 获取最近任务列表 */
export async function getRecentTasks(): Promise<TaskListResult> {
  const { data } = await api.get<TaskListResult>('/api/translate/tasks')
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
  const { data } = await api.get('/api/translate/config')
  return data
}

/** 获取翻译覆盖统计 */
export async function getTranslationStatus(filters?: Record<string, string | undefined>): Promise<{
  success: boolean; total: number; descCompleted: number; descPending: number
  readmeCompleted: number; readmePending: number
}> {
  const searchParams = new URLSearchParams()
  if (filters) {
    Object.entries(filters).forEach(([k, v]) => { if (v) searchParams.set(k, v) })
  }
  const { data } = await api.get(`/api/translate/status?${searchParams.toString()}`)
  return data
}
