/**
 * 将数字转换为中文简写（用于列表快速阅读）
 * 例：1049 → "1千"、61217 → "6万1千"、193336 → "19万3千"
 */
export function formatNumberCn(n: number): string {
    if (n === 0) return '0'
    if (n < 1000) return String(n)

    let remaining = n
    const parts: string[] = []

    const wan = Math.floor(remaining / 10000)
    remaining %= 10000
    const qian = Math.floor(remaining / 1000)

    if (wan > 0) {
        parts.push(`${wan}万`)
        if (qian > 0) parts.push(`${qian}千`)
        return parts.join('')
    }

    // 1000 ~ 9999
    if (qian > 0) {
        parts.push(`${qian}千`)
        const bai = Math.floor(remaining / 100) % 10
        if (bai > 0) parts.push(`${bai}百`)
        return parts.join('')
    }

    return String(n)
}

/**
 * 解析日期字符串/元组为 Date 对象
 * @param dateStr 日期字符串或 [y, m, d, h, min, s] 元组
 * @returns Date 对象，无法解析时返回 null
 */
function parseDateArg(dateStr: string | number[] | null | undefined): Date | null {
    if (!dateStr) return null
    if (Array.isArray(dateStr)) {
        const [y, m, d, h = 0, min = 0, s = 0] = dateStr
        const date = new Date(y, m - 1, d, h, min, s)
        return Number.isNaN(date.getTime()) ? null : date
    }
    if (typeof dateStr === 'string') {
        const date = new Date(dateStr.replace(' ', 'T'))
        return Number.isNaN(date.getTime()) ? null : date
    }
    return null
}

/**
 * 计算相对于现在的口语化时间描述（x天前/周前/月前/年前）
 * @param date 参照日期
 * @returns 中文时间描述，未来日期返回 '-'
 */
function buildRelativeTime(date: Date): string {
    const diffMs = Date.now() - date.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    if (diffDays < 0) return '-'
    if (diffDays === 0) return '今天'
    if (diffDays === 1) return '昨天'
    if (diffDays < 7) return `${diffDays}天前`
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}周前`
    if (diffDays < 365) return `${Math.floor(diffDays / 30)}月前`
    return `${Math.floor(diffDays / 365)}年前`
}

/**
 * 统一日期格式化 — 替代各页面中重复的 formatDate 函数。
 *
 * @param dateStr 日期字符串、number[] 元组、或 null/undefined
 * @param format  输出格式：'date' (YYYY-MM-DD)、'datetime' (YYYY-MM-DD HH:mm:ss)、'relative' (x天前)
 */
export function formatDate(
    dateStr: string | number[] | null | undefined,
    format: 'date' | 'datetime' | 'relative' = 'date',
): string {
    const date = parseDateArg(dateStr)
    if (!date) return '-'

    const y = date.getFullYear()
    const mo = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')

    if (format === 'relative') return buildRelativeTime(date)

    if (format === 'datetime') {
        const hour = String(date.getHours()).padStart(2, '0')
        const min = String(date.getMinutes()).padStart(2, '0')
        const sec = String(date.getSeconds()).padStart(2, '0')
        return `${y}-${mo}-${d} ${hour}:${min}:${sec}`
    }

    return `${y}-${mo}-${d}`
}

/**
 * 获取相对时间描述（中文口语化）
 * 例："今天"、"昨天"、"3天前"、"2周前"、"5月前"
 */
export function getRelativeTime(dateStr: string | null | undefined): string {
    return formatDate(dateStr, 'relative')
}

/**
 * 英文数字缩写（用于紧凑展示）
 * 例：1049→"1.0k"、61217→"61.2k"、1933367→"1.9M"
 */
export function formatNumberShort(n: number): string {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
    if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
    return String(n)
}

/**
 * 格式化文件大小为人类可读格式
 * 例：512→"512 B"、2048→"2.0 KB"、1048576→"1.0 MB"
 */
export function formatSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / 1024 / 1024).toFixed(1) + ' MB'
}

// ─── 日期工具 ───

/**
 * 计算距今多少天
 * @param dateStr 日期字符串
 * @returns 天数，无效日期返回 null
 */
export function daysSince(dateStr: string | null | undefined): number {
    if (!dateStr) return 0
    const date = new Date(dateStr.replace(' ', 'T'))
    if (isNaN(date.getTime())) return 0
    const diffMs = Date.now() - date.getTime()
    return Math.floor(diffMs / (1000 * 60 * 60 * 24))
}

/**
 * 根据未更新天数返回对应的颜色标签
 * @param days 未更新天数
 * @returns 颜色名称：'green' | 'orange' | 'red'
 */
export function getStalenessColor(days: number): string {
    if (days > 180) return 'red'
    if (days > 30) return 'orange'
    return 'green'
}

// ─── 仓库名称解析 ───

/**
 * 将 "owner/repoName" 解析为 [owner, repoName]
 * @param fullName 完整仓库名，如 "facebook/react"
 * @returns [owner, repoName]，格式异常时返回 [fullName, '']
 */
export function parseFullName(fullName: string): [string, string] {
    const idx = fullName.indexOf('/')
    if (idx === -1) return [fullName, '']
    return [fullName.slice(0, idx), fullName.slice(idx + 1)]
}

