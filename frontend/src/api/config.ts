import api from './request'

export interface ConfigItem {
    id: number
    configKey: string
    configValue: string
    displayValue: string
    description: string
    sensitive: boolean
}

export async function fetchAllConfig(): Promise<ConfigItem[]> {
    const { data } = await api.get<ConfigItem[]>('/api/config')
    return data
}

export async function saveConfig(updates: Record<string, string>): Promise<{ success: boolean; message: string }> {
    const { data } = await api.post('/api/config', updates)
    return data
}
