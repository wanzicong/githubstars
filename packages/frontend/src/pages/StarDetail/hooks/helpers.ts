/**
 * 日期工具函数 — 计算距今天数
 *
 * @param dateStr - ISO 日期字符串或 null
 * @returns 中文天数描述或 null
 */
export function daysSince(dateStr: string | null | undefined): string | null {
    if (!dateStr) return null
    const date = new Date(dateStr.replace(' ', 'T'))
    if (isNaN(date.getTime())) return null
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    if (diffDays < 0) return null
    return diffDays === 0 ? '今天' : diffDays + ' 天'
}

/**
 * 解析 topics JSON 字符串为数组
 *
 * @param topics - JSON 字符串或 null
 * @returns topics 数组
 */
export function parseTopics(topics: string | null): string[] {
    if (!topics) return []
    try { return JSON.parse(topics) as string[] } catch { return [] }
}
