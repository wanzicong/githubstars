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
 * 统一日期格式化 — 替代各页面中重复的 formatDate 函数。
 *
 * @param dateStr 日期字符串、number[] 元组、或 null/undefined
 * @param format  输出格式：'date' (YYYY-MM-DD)、'datetime' (YYYY-MM-DD HH:mm:ss)、'relative' (x天前)
 */
export function formatDate(
    dateStr: string | number[] | null | undefined,
    format: 'date' | 'datetime' | 'relative' = 'date',
): string {
    if (!dateStr) return '-'

    let date: Date

    if (Array.isArray(dateStr)) {
        const [y, m, d, h = 0, min = 0, s = 0] = dateStr
        date = new Date(y, m - 1, d, h, min, s)
    } else if (typeof dateStr === 'string') {
        date = new Date(dateStr.replace(' ', 'T'))
    } else {
        return '-'
    }

    if (isNaN(date.getTime())) return '-'

    const y = date.getFullYear()
    const mo = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    const hour = String(date.getHours()).padStart(2, '0')
    const min = String(date.getMinutes()).padStart(2, '0')
    const sec = String(date.getSeconds()).padStart(2, '0')

    if (format === 'datetime') {
        return `${y}-${mo}-${d} ${hour}:${min}:${sec}`
    }

    if (format === 'relative') {
        const diffMs = Date.now() - date.getTime()
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
        if (diffDays < 0) return '-'
        if (diffDays === 0) return '今天'
        if (diffDays < 30) return `${diffDays}天前`
        if (diffDays < 365) return `${Math.floor(diffDays / 30)}月前`
        return `${Math.floor(diffDays / 365)}年前`
    }

    return `${y}-${mo}-${d}`
}

