import api from './request'
import type { SyncStatus, PageResult, SyncLog } from '../types'

export async function triggerManualSync(): Promise<{ success: boolean; message?: string }> {
    const { data } = await api.post('/api/sync/manual')
    return data
}

export async function fetchSyncStatus(): Promise<SyncStatus> {
    const { data: wrapped } = await api.post<{ success: boolean; data: SyncStatus }>('/api/sync/status')
    return wrapped.data
}

export async function fetchSyncLogs(pageNum: number = 1, pageSize: number = 10): Promise<PageResult<SyncLog>> {
    const { data: wrapped } = await api.post<{ success: boolean; data: SyncLog[]; meta: { total: number; pages: number; current: number } }>('/api/sync/logs', { pageNum, pageSize })
    return {
        records: wrapped.data,
        total: wrapped.meta.total,
        pages: wrapped.meta.pages,
        current: wrapped.meta.current,
        size: pageSize,
    }
}
