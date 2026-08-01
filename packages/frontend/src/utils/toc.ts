/** README 结构导航（TOC）工具：标题提取、slug 生成、行号→slug 映射 */

export interface TocHeading {
    level: 1 | 2 | 3
    text: string
    slug: string
}

/**
 * 从标题纯文本生成 slug：转小写 + 非字母数字（保留中日韩字符）替换为 - + 去首尾 -
 * MarkdownRenderer 与 extractToc 共用此实现，禁止再复制第三份。
 */
export function slugify(text: string): string {
    /* eslint-disable sonarjs/super-linear-regex -- README 标题长度有限，回溯可忽略 */
    return text
        .toLowerCase()
        .replace(/[^\w一-鿿]+/g, '-')
        .replace(/(?:^-+)|(?:-+$)/g, '')
    /* eslint-enable sonarjs/super-linear-regex */
}

/** 行内 Markdown 标记 / HTML 标签清洗正则 */
/* eslint-disable sonarjs/super-linear-regex -- 标题行长度有限，回溯可忽略 */
const HTML_TAG_RE = /<[^>]*>/g
const IMAGE_RE = /!\[([^\]]*)\]\([^)]*\)/g
const LINK_RE = /\[([^\]]*)\]\([^)]*\)/g
const BOLD_STAR_RE = /\*\*([^*]*)\*\*/g
const BOLD_UNDERSCORE_RE = /__([^_]*)__/g
const EM_RE = /([*_])([^*_]*)\1/g
const STRIKETHROUGH_RE = /~~([^~]*)~~/g
const INLINE_CODE_RE = /`([^`]*)`/g
/* eslint-enable sonarjs/super-linear-regex */

/** 剔除标题中的行内 Markdown 标记与 HTML 标签，得到纯文本（与渲染后的可见文本一致） */
function cleanHeadingText(raw: string): string {
    return raw
        .replace(HTML_TAG_RE, '')
        .replace(IMAGE_RE, '$1')
        .replace(LINK_RE, '$1')
        .replace(BOLD_STAR_RE, '$1')
        .replace(BOLD_UNDERSCORE_RE, '$1')
        .replace(EM_RE, '$2')
        .replace(STRIKETHROUGH_RE, '$1')
        .replace(INLINE_CODE_RE, '$1')
        .trim()
}

/**
 * 创建带去重能力的 slug 生成器（与 GitHub 行为一致）：
 * 首次出现原样返回，重名追加 -1、-2 …；空 slug 兜底为 section-N。
 */
export function createSlugger(): (text: string) => string {
    const seen = new Map<string, number>()
    return (text: string) => {
        const base = slugify(text) || 'section'
        const count = seen.get(base) ?? 0
        seen.set(base, count + 1)
        return count === 0 ? base : `${base}-${count}`
    }
}

/** 判断当前行是否处于围栏代码块（``` 或 ~~~）之外 */
function createFenceTracker(): (line: string) => boolean {
    let inFence = false
    let fenceMarker = ''
    return (line: string) => {
        const trimmed = line.trim()
        const fenceMatch = /^(`{3,}|~{3,})/.exec(trimmed)
        if (fenceMatch) {
            const marker = fenceMatch[1][0]
            if (!inFence) {
                inFence = true
                fenceMarker = marker
            } else if (marker === fenceMarker) {
                inFence = false
                fenceMarker = ''
            }
            return false
        }
        return !inFence
    }
}

/**
 * 逐行扫描 Markdown，产出 (行号 → TOC 条目) 序列。
 * 跳过围栏/缩进代码块中的 # 行，文本经行内标记清洗，slug 全局去重。
 * 这是 extractToc 与 buildHeadingIdMap 的共同数据源，保证两边 slug 完全一致。
 */
function scanHeadings(markdown: string): Array<{ line: number; heading: TocHeading }> {
    const lines = markdown.split('\n')
    const outsideCode = createFenceTracker()
    const slugger = createSlugger()
    const result: Array<{ line: number; heading: TocHeading }> = []

    lines.forEach((rawLine, index) => {
        const inContent = outsideCode(rawLine)
        if (!inContent) return
        // 缩进代码块（4 空格/Tab 开头）不是标题
        if (/^(?: {4}|\t)/.test(rawLine)) return
        // eslint-disable-next-line sonarjs/super-linear-regex -- 标题行长度有限
        const match = /^(#{1,3})\s+(.+?)\s*#*\s*$/.exec(rawLine.trim())
        if (!match) return
        const level = match[1].length as TocHeading['level']
        const text = cleanHeadingText(match[2])
        if (!text) return
        result.push({ line: index + 1, heading: { level, text, slug: slugger(text) } })
    })

    return result
}

/** 从 Markdown 源码提取 h1~h3 标题结构，用于 README 结构导航（TOC） */
export function extractToc(markdown: string): TocHeading[] {
    return scanHeadings(markdown).map((item) => item.heading)
}

/**
 * 构建 行号 → slug 的映射，供 MarkdownRenderer 通过标题 AST 节点的
 * position.start.line 查到与 TOC 完全一致（含去重后缀）的 id。
 */
export function buildHeadingIdMap(markdown: string): Map<number, string> {
    const map = new Map<number, string>()
    for (const item of scanHeadings(markdown)) {
        map.set(item.line, item.heading.slug)
    }
    return map
}
