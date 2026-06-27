/**
 * 日期显示组件 — 根据距今天数显示不同颜色
 */
import { Typography } from 'antd'
import { daysSince } from './helpers'

const { Text } = Typography

interface DaysSinceTextProps {
    readonly dateStr: string
}

export function DaysSinceText({ dateStr }: DaysSinceTextProps) {
    const display = daysSince(dateStr)
    if (!display) return <Text type='secondary'>-</Text>
    if (display === '今天') return <Text style={{ color: '#52c41a' }}>今天</Text>
    const num = Number.parseInt(display)
    if (num < 90) return <Text style={{ color: '#52c41a' }}>{display}</Text>
    if (num < 365) return <Text style={{ color: '#faad14' }}>{display}</Text>
    return <Text style={{ color: '#ff4d4f' }}>{display}</Text>
}
