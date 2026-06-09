import api from './request'
import type { PageResult, CloneTaskRecord, CloneTaskItem } from '../types'

export interface CloneConfig {
  success: boolean
  baseDirectory: string
  subdirectoryHistory: string[]
  lastSubdirectory: string
  hasActiveTask: boolean
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
  const { data } = await api.post<CloneStartResult>(`/api/clone/start?${searchParams.toString()}`)
  return data
}

export async function fetchCloneTask(taskId: string) {
  const { data } = await api.get(`/api/clone/task/${taskId}`)
  return data
}

export async function fetchCloneTasks(page: number, size: number): Promise<PageResult<CloneTaskRecord>> {
  const { data } = await api.get<PageResult<CloneTaskRecord>>('/api/clone/tasks', { params: { page, size } })
  return data
}

export async function fetchCloneTaskItems(taskId: string, page: number, size: number): Promise<PageResult<CloneTaskItem>> {
  const { data } = await api.get<PageResult<CloneTaskItem>>(`/api/clone/tasks/${taskId}/items`, { params: { page, size } })
  return data
}

export async function deleteCloneTask(taskId: string): Promise<{ success: boolean; message?: string }> {
  const { data } = await api.delete(`/api/clone/tasks/${taskId}`)
  return data
}
