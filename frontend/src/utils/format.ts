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
