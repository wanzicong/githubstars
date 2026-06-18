import api from './request'
import type { SyncStatus, PageResult, SyncLog } from '../types'

export async function triggerManualSync(): Promise<{ success: boolean; message?: string }> {
    const { data } = await api.post('/api/sync/manual')
    return data
}

export async function fetchSyncStatus(): Promise<SyncStatus> {
    const { data } = await api.post<SyncStatus>('/api/sync/status')
    return data
}

export async function fetchSyncLogs(pageNum: number = 1, pageSize: number = 10): Promise<PageResult<SyncLog>> {
    const { data } = await api.post<PageResult<SyncLog>>('/api/sync/logs', { pageNum, pageSize })
    return data
}
