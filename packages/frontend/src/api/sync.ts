import api from './request'
import type { SyncStatus, PageResult, SyncLog } from '../types'

/**
 * 同步管理 API
 *
 * 提供手动触发同步、查询同步状态和分页获取同步日志的能力。
 */

/**
 * 触发手动同步（REPLACE 模式）
 *
 * @returns 同步启动结果
 */
export async function triggerManualSync(): Promise<{ success: boolean; message?: string }> {
    const { data } = await api.post('/api/sync/manual')
    return data
}

/**
 * 获取当前同步状态概览
 *
 * @returns 同步锁状态、仓库总数、上次成功同步时间等
 */
export async function fetchSyncStatus(): Promise<SyncStatus> {
    const { data: wrapped } = await api.post<{ success: boolean; data: SyncStatus }>('/api/sync/status')
    return wrapped.data
}

/**
 * 分页获取同步日志
 *
 * @param pageNum  页码（从 1 开始），默认 1
 * @param pageSize 每页条数，默认 10
 * @returns 分页后的同步日志列表
 */
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
