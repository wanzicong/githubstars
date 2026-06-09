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
  descTotal: number
  descCompleted: number
  descFailed: number
  readmeTotal: number
  readmeCompleted: number
  readmeFailed: number
  createdAt: string
  finishedAt: string | null
  progress: number
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

/** 启动 README 批量翻译（翻译全部未获取 README 的仓库，异步） */
export async function startReadmeBatch(): Promise<{ success: boolean; taskId?: number; message?: string }> {
  const { data } = await api.post('/api/translate/readme-start')
  return data
}

/** 获取翻译任务进度 */
export async function getTaskProgress(taskId: number): Promise<TranslateTaskProgress> {
  const { data } = await api.get<TranslateTaskProgress>(`/api/translate/task/${taskId}`)
  return data
}

/** 重试失败项 */
export async function retryFailed(taskId: number): Promise<{ success: boolean; taskId?: number; message?: string }> {
  const { data } = await api.post(`/api/translate/task/${taskId}/retry`)
  return data
}

/** 获取失败项列表 */
export async function getTaskFailures(taskId: number): Promise<{ success: boolean; failures: Array<{ id: number; repoId: number; fullName: string; translateType: string; errorMessage: string }>; count: number }> {
  const { data } = await api.get(`/api/translate/task/${taskId}/failures`)
  return data
}

/** 获取最近任务列表 */
export async function getRecentTasks(): Promise<TaskListResult> {
  const { data } = await api.get<TaskListResult>('/api/translate/tasks')
  return data
}
