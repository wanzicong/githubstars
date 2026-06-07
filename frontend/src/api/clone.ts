import api from './request'

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
}): Promise<CloneStartResult> {
  const searchParams = new URLSearchParams({ maxCount: String(params.maxCount ?? 50) })
  if (params.keyword) searchParams.set('keyword', params.keyword)
  if (params.language) searchParams.set('language', params.language)
  if (params.categoryIds) searchParams.set('categoryIds', params.categoryIds)
  if (params.subDirectory) searchParams.set('subDirectory', params.subDirectory)
  const { data } = await api.post<CloneStartResult>(`/api/clone/start?${searchParams.toString()}`)
  return data
}

export async function fetchCloneTask(taskId: string) {
  const { data } = await api.get(`/api/clone/task/${taskId}`)
  return data
}
