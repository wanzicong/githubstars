import api from './request'

/** 创建克隆任务 */
export async function createCloneTask(params: {
    repoIds: number[]
    targetDir: string
    concurrency: 5 | 10 | 20
    shallow?: boolean
}): Promise<{ success: boolean; taskId?: number; message?: string }> {
    const { data } = await api.post('/api/clone', params)
    return data
}

/** 获取克隆任务进度 */
export async function getCloneTaskProgress(taskId: number): Promise<CloneTaskProgress> {
    const { data } = await api.post<CloneTaskProgress>('/api/clone/tasks/detail', { id: taskId })
    return data
}

/** 重试克隆失败项 */
export async function retryCloneFailed(taskId: number): Promise<{ success: boolean; taskId?: number; message?: string }> {
    const { data } = await api.post('/api/clone/tasks/retry', { id: taskId })
    return data
}

/** 重试单个克隆项 */
export async function retryCloneItem(taskId: number, fullName: string): Promise<{ success: boolean; message?: string }> {
    const { data } = await api.post('/api/clone/tasks/retry-item', { id: taskId, fullName })
    return data
}

/** 重置整个克隆任务 */
export async function resetCloneTask(taskId: number): Promise<{ success: boolean; taskId?: number; message?: string }> {
    const { data } = await api.post('/api/clone/tasks/reset', { id: taskId })
    return data
}

/** 获取最近克隆任务列表 */
export async function getRecentCloneTasks(): Promise<CloneTaskListResult> {
    const { data } = await api.post<CloneTaskListResult>('/api/clone/tasks/list')
    return data
}

/** 获取常用克隆目录列表 */
export async function getRecentCloneDirectories(): Promise<{ success: boolean; directories: string[] }> {
    const { data } = await api.post('/api/clone/directories')
    return data
}

/** 删除克隆任务 */
export async function deleteCloneTask(taskId: number): Promise<{ success: boolean; taskId?: number; message?: string }> {
    const { data } = await api.post('/api/clone/tasks/delete', { id: taskId })
    return data
}

/** 克隆任务项类型 */
export interface CloneTaskItem {
    fullName: string
    status: string
    localPath?: string
    errorMessage?: string | null
}

/** 克隆任务进度类型 */
export interface CloneTaskProgress {
    success: boolean
    taskId: number
    status: string
    targetDir: string
    concurrency: number
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
    allItems?: Array<CloneTaskItem>
}

/** 克隆任务列表结果 */
export interface CloneTaskListResult {
    success: boolean
    tasks: Array<{
        taskId: number
        status: string
        targetDir: string
        concurrency: number
        totalItems: number
        completedItems: number
        failedItems: number
        skippedItems: number
        createdAt: string
        startedAt: string | null
        finishedAt: string | null
    }>
}
