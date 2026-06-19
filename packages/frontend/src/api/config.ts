import api from './request'
import type { ConfigItem } from '../types'

export async function fetchAllConfig(): Promise<ConfigItem[]> {
    const { data: wrapped } = await api.post<{ success: boolean; data: ConfigItem[] }>('/api/config/list')
    return wrapped.data
}

export async function saveConfig(updates: Record<string, string>): Promise<{ success: boolean; message: string }> {
    const { data } = await api.post('/api/config', updates)
    return data
}
