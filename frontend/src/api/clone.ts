import api from './request'
import type { PageResult, CloneTaskRecord, CloneTaskItem } from '../types'

export interface CloneConfig {
  success: boolean
  baseDirectory: string
  subdirectoryHistory: string[]
  lastSubdirectory: string
  hasActiveTask: boolean
  defaultCloneDepth: number
  defaultMaxRepoSizeMb: number
}

export interface CloneStartResult {
  success: boolean
  taskId?: string
  targetDirectory?: string
  message: string
}

export async function fetchCloneConfig(): Promise<CloneConfig> {
  const { data } = await api.get<CloneConfig>('/api/clone/config')
  return data
}

export async function startClone(params: {
  keyword?: string
  language?: string
  categoryIds?: string
  maxCount?: number
  subDirectory?: string
  dateField?: string
  startDate?: string
  endDate?: string
  sortBy?: string
  sortOrder?: string
  concurrency?: number
  cloneDepth?: number
  maxRepoSizeMb?: number
}): Promise<CloneStartResult> {
  const searchParams = new URLSearchParams()
  if (params.maxCount != null) searchParams.set('maxCount', String(params.maxCount))
  if (params.keyword) searchParams.set('keyword', params.keyword)
  if (params.language) searchParams.set('language', params.language)
  if (params.categoryIds) searchParams.set('categoryIds', params.categoryIds)
  if (params.subDirectory) searchParams.set('subDirectory', params.subDirectory)
  if (params.dateField) searchParams.set('dateField', params.dateField)
  if (params.startDate) searchParams.set('startDate', params.startDate)
  if (params.endDate) searchParams.set('endDate', params.endDate)
  if (params.sortBy) searchParams.set('sortBy', params.sortBy)
  if (params.sortOrder) searchParams.set('sortOrder', params.sortOrder)
  if (params.concurrency != null) searchParams.set('concurrency', String(params.concurrency))
  if (params.cloneDepth != null) searchParams.set('cloneDepth', String(params.cloneDepth))
  if (params.maxRepoSizeMb != null) searchParams.set('maxRepoSizeMb', String(params.maxRepoSizeMb))
  const { data } = await api.post<CloneStartResult>(`/api/clone/start?${searchParams.toString()}`)
  return data
}

export async function fetchCloneTask(taskId: string) {
  const { data } = await api.get(`/api/clone/task/${taskId}`)
  return data
}

/** 获取任务详情（从DB，含完整字段） */
export async function fetchCloneTaskDetail(taskId: string): Promise<{ success: boolean; task: CloneTaskRecord; items: CloneTaskItem[]; total: number }> {
  const { data } = await api.get(`/api/clone/tasks/${taskId}`)
  return data
}

export async function fetchCloneTasks(page: number, size: number): Promise<PageResult<CloneTaskRecord>> {
  const { data } = await api.get<PageResult<CloneTaskRecord>>('/api/clone/tasks', { params: { page, size } })
  return data
}

export async function fetchCloneTaskItems(taskId: string, page: number, size: number, status?: string): Promise<PageResult<CloneTaskItem>> {
  const params: Record<string, string | number> = { page, size }
  if (status) params.status = status
  const { data } = await api.get<PageResult<CloneTaskItem>>(`/api/clone/tasks/${taskId}/items`, { params })
  return data
}

export async function deleteCloneTask(taskId: string): Promise<{ success: boolean; message?: string }> {
  const { data } = await api.delete(`/api/clone/tasks/${taskId}`)
  return data
}

export async function retryCloneTask(taskId: string): Promise<{ success: boolean; message?: string; retryCount?: number }> {
  const { data } = await api.post(`/api/clone/tasks/${taskId}/retry`)
  return data
}

export async function retryAllCloneTasks(): Promise<{ success: boolean; message?: string }> {
  const { data } = await api.post('/api/clone/tasks/retry-all')
  return data
}

export async function togglePinCloneTask(taskId: string): Promise<{ success: boolean; pinned: boolean; message?: string }> {
  const { data } = await api.post(`/api/clone/tasks/${taskId}/pin`)
  return data
}

export async function cancelCloneTask(taskId: string): Promise<{ success: boolean; message?: string }> {
  const { data } = await api.post(`/api/clone/task/${taskId}/cancel`)
  return data
}

export interface DiskSpaceInfo {
  success: boolean
  freeSpaceMB: number
  estimatedSizeMB: number
  requiredSizeMB: number
  sufficient: boolean
  message: string
}

export async function checkDiskSpace(subDirectory: string, repoCount: number): Promise<DiskSpaceInfo> {
  const { data } = await api.get<DiskSpaceInfo>('/api/clone/disk-space', { params: { subDirectory, repoCount } })
  return data
}
