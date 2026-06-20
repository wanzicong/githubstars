import { Typography } from 'antd'
const { Text } = Typography

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

export function DaysSinceText({ dateStr }: { dateStr: string }) {
    const display = daysSince(dateStr)
    if (!display) return <Text type='secondary'>-</Text>
    if (display === '今天') return <Text style={{ color: '#52c41a' }}>今天</Text>
    const num = parseInt(display)
    if (num < 90) return <Text style={{ color: '#52c41a' }}>{display}</Text>
    if (num < 365) return <Text style={{ color: '#faad14' }}>{display}</Text>
    return <Text style={{ color: '#ff4d4f' }}>{display}</Text>
}

export function parseTopics(topics: string | null): string[] {
    if (!topics) return []
    try { return JSON.parse(topics) } catch { return [] }
}
