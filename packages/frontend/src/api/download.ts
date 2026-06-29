import api from './request'

/** 镜像代理源类型 */
export type DownloadMirrorSource = 'ghproxy' | 'gh-proxy' | 'gh-proxy-org' | 'gh-proxy-v4' | 'gh-proxy-v6' | 'gh-proxy-cdn' | 'gitclone' | 'direct'

/** 创建下载任务 */
export async function createDownloadTask(params: {
    repoIds: number[]
    targetDir: string
    concurrency: 3 | 5 | 10 | 20 | 50
    /** 镜像源列表（按优先级排序），下载时会按顺序尝试，失败自动回退到下一个源 */
    mirrorSources?: DownloadMirrorSource[]
}): Promise<{ success: boolean; taskId?: number; message?: string }> {
    const { data } = await api.post('/api/download', params)
    return data
}

/** 获取下载任务进度 */
export async function getDownloadTaskProgress(taskId: number): Promise<DownloadTaskProgress> {
    const { data } = await api.post<DownloadTaskProgress>('/api/download/tasks/detail', { id: taskId })
    return data
}

/** 重试下载失败项 */
export async function retryDownloadFailed(taskId: number): Promise<{ success: boolean; taskId?: number; message?: string }> {
    const { data } = await api.post('/api/download/tasks/retry', { id: taskId })
    return data
}

/** 重试单个下载项 */
export async function retryDownloadItem(taskId: number, fullName: string): Promise<{ success: boolean; message?: string }> {
    const { data } = await api.post('/api/download/tasks/retry-item', { id: taskId, fullName })
    return data
}

/** 重置整个下载任务 */
export async function resetDownloadTask(taskId: number): Promise<{ success: boolean; taskId?: number; message?: string }> {
    const { data } = await api.post('/api/download/tasks/reset', { id: taskId })
    return data
}

/** 获取最近下载任务列表 */
export async function getRecentDownloadTasks(): Promise<DownloadTaskListResult> {
    const { data } = await api.post<DownloadTaskListResult>('/api/download/tasks/list')
    return data
}

/** 获取常用下载目录列表 */
export async function getRecentDownloadDirectories(): Promise<{ success: boolean; directories: string[] }> {
    const { data } = await api.post('/api/download/directories')
    return data
}

/** 删除下载任务 */
export async function deleteDownloadTask(taskId: number): Promise<{ success: boolean; taskId?: number; message?: string }> {
    const { data } = await api.post('/api/download/tasks/delete', { id: taskId })
    return data
}

/** 下载任务项类型 */
export interface DownloadTaskItem {
    fullName: string
    status: string
    localFilePath?: string
    extractDir?: string
    fileSize?: number | string
    errorMessage?: string | null
}

/** 解压任务项 */
export async function extractDownloadItem(taskId: number, fullName: string): Promise<{ success: boolean; message?: string }> {
    const { data } = await api.post('/api/download/tasks/extract', { taskId, fullName })
    return data
}

/** 删除任务项的压缩包 */
export async function deleteDownloadItemFile(taskId: number, fullName: string): Promise<{ success: boolean; message?: string }> {
    const { data } = await api.post('/api/download/tasks/delete-item', { taskId, fullName })
    return data
}

/** 下载任务进度类型 */
export interface DownloadTaskProgress {
    success: boolean
    taskId: number
    status: string
    targetDir: string
    concurrency: number
    mirrorSources: string[]
    extractArchive: boolean
    deleteAfterExtract: boolean
    totalItems: number
    completedItems: number
    failedItems: number
    skippedItems: number
    progress: number
    createdAt: string
    startedAt: string | null
    finishedAt: string | null
    failedDetails?: Array<{ fullName: string; error: string }>
    skippedDetails?: Array<{ fullName: string }>
    allItems?: Array<DownloadTaskItem>
}

/** 下载任务列表结果 */
export interface DownloadTaskListResult {
    success: boolean
    tasks: Array<{
        taskId: number
        status: string
        targetDir: string
        concurrency: number
        mirrorSources: string[]
        extractArchive: boolean
        deleteAfterExtract: boolean
        totalItems: number
        completedItems: number
        failedItems: number
        skippedItems: number
        createdAt: string
        startedAt: string | null
        finishedAt: string | null
    }>
}
