import api from './request'

export interface LogFile {
    name: string
    size: number
    mtime: string
}

export async function fetchLogFiles(): Promise<LogFile[]> {
    const { data } = await api.get<{ success: boolean; files: LogFile[] }>('/api/logs/files')
    return data.files || []
}

export async function fetchLogContent(
    file: string,
    lines?: number,
): Promise<string> {
    const { data } = await api.get<{ success: boolean; content: string }>(
        '/api/logs/view',
        { params: { file, lines } },
    )
    return data.content || ''
}

export async function clearLogFile(file: string): Promise<boolean> {
    const { data } = await api.post<{ success: boolean }>('/api/logs/clear', {
        file,
    })
    return data.success
}
