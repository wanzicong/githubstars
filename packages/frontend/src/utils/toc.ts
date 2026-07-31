/** 从 Markdown 源码中提取标题结构，用于 README 结构导航（TOC） */
export interface TocHeading {
    level: 1 | 2 | 3
    text: string
    slug: string
}

/**
 * 从 Markdown 文本中提取所有 # / ## / ### 标题，返回层级化 TOC 列表。
 *
 * 仅匹配行首的 `# ` 前缀（不计入代码块或行内），
 * 生成与 MarkdownRenderer 相同的 slug ID 用于 Anchor 跳转。
 */
export function extractToc(markdown: string): TocHeading[] {
    const lines = markdown.split('\n')
    const headings: TocHeading[] = []

    for (const line of lines) {
        // eslint-disable-next-line sonarjs/super-linear-regex
        const match = /^(#{1,3})\s+(.+)$/.exec(line.trim())
        if (!match) continue
        const level = match[1].length as TocHeading['level']
        const text = match[2].trim()
        if (!text) continue
        const slug = slugify(text)
        headings.push({ level, text, slug })
    }

    return headings
}

/** 从标题纯文本生成 slug（与 MarkdownRenderer 的 slugify 完全一致） */
function slugify(text: string): string {
    /* eslint-disable sonarjs/super-linear-regex -- README 标题长度有限，回溯可忽略 */
    return text
        .toLowerCase()
        .replace(/[^\w一-鿿]+/g, '-')
        .replace(/(?:^-+)|(?:-+$)/g, '')
    /* eslint-enable sonarjs/super-linear-regex */
}
