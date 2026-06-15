const INVALID_SEGMENT = /[<>:"|?*\x00-\x1f]/
const WINDOWS_RESERVED = new Set([
    'CON',
    'PRN',
    'AUX',
    'NUL',
    'COM1',
    'COM2',
    'COM3',
    'COM4',
    'COM5',
    'COM6',
    'COM7',
    'COM8',
    'COM9',
    'LPT1',
    'LPT2',
    'LPT3',
    'LPT4',
    'LPT5',
    'LPT6',
    'LPT7',
    'LPT8',
    'LPT9',
])

export function sanitizeSubdirectory(subDirectory: string): { value: string; error?: string } {
    if (!subDirectory || !subDirectory.trim()) {
        return { value: '' }
    }

    let normalized = subDirectory.trim().replace(/\\/g, '/')
    while (normalized.startsWith('/')) normalized = normalized.slice(1)
    while (normalized.endsWith('/')) normalized = normalized.slice(0, -1)

    if (normalized.includes(':')) {
        return { value: '', error: '子目录不能包含盘符或冒号' }
    }

    const segments = normalized.split('/')
    for (const segment of segments) {
        if (!segment) {
            return { value: '', error: '子目录不能包含空路径段' }
        }
        if (segment === '.' || segment === '..') {
            return { value: '', error: '子目录不能包含 . 或 .. 路径段' }
        }
        if (INVALID_SEGMENT.test(segment)) {
            return { value: '', error: '子目录包含非法字符' }
        }
        if (WINDOWS_RESERVED.has(segment.toUpperCase())) {
            return { value: '', error: `子目录不能使用系统保留名: ${segment}` }
        }
    }

    return { value: normalized }
}

export function buildTargetPath(baseDirectory: string, subDirectory: string): { path: string; error?: string } {
    const { value, error } = sanitizeSubdirectory(subDirectory)
    if (error) return { path: '', error }
    if (!baseDirectory) return { path: value || '-', error: value ? undefined : undefined }
    const base = baseDirectory.replace(/[/\\]+$/, '')
    return { path: value ? `${base}/${value}` : base }
}
