import api from './request'
import type { ConfigItem } from '../types'

/**
 * 系统配置 API
 *
 * 提供系统配置项的查询和批量保存能力。
 */

/**
 * 获取全部配置项
 *
 * @returns 配置项数组，包含 key/value/描述/敏感标记
 */
export async function fetchAllConfig(): Promise<ConfigItem[]> {
    const { data: wrapped } = await api.post<{ success: boolean; data: ConfigItem[] }>('/api/config/list')
    return wrapped.data
}

/**
 * 批量保存配置项
 *
 * @param updates 键值对集合
 * @returns 保存结果，含 success 标志和 message
 */
export async function saveConfig(updates: Record<string, string>): Promise<{ success: boolean; message: string }> {
    const { data } = await api.post('/api/config', updates)
    return data
}
