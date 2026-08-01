import { memo, useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'
import type { Components } from 'react-markdown'
import { buildHeadingIdMap, slugify } from '../../utils/toc'

/** 自定义 sanitize schema：保留 README 中常见的安全 HTML 元素，阻止脚本注入 */
const sanitizeSchema = {
    ...defaultSchema,
    attributes: {
        ...defaultSchema.attributes,
        '*': [...(defaultSchema.attributes?.['*'] || []), 'className', 'style'],
        details: ['open'],
        summary: [],
        div: [...(defaultSchema.attributes?.['*'] || []), 'align', 'className', 'style'],
        img: [...(defaultSchema.attributes?.['img'] || []), 'loading', 'align'],
    },
}

/** 从 React children 中递归提取纯文本（用于生成锚点 ID 的兜底） */
function extractTextContent(node: React.ReactNode): string {
    if (typeof node === 'string' || typeof node === 'number') return String(node)
    if (Array.isArray(node)) return node.map(extractTextContent).join('')
    if (node && typeof node === 'object' && 'props' in node) {
        const children = (node as { props: { children?: React.ReactNode } }).props.children
        return extractTextContent(children)
    }
    return ''
}

/** Markdown → React 的共享渲染组件映射，确保全站 README/AI 分析等 Markdown 渲染风格一致 */
const SHARED_MARKDOWN_COMPONENTS: Components = {
    h4: ({ children }) => <h4 style={{ fontSize: 14, marginTop: 12, marginBottom: 6 }}>{children}</h4>,
    p: ({ children }) => <p style={{ lineHeight: 1.8, marginBottom: 12, fontSize: 14 }}>{children}</p>,
    a: ({ href, children }) => (
        <a href={href} target='_blank' rel='noopener noreferrer' style={{ color: '#1677ff' }}>
            {children}
        </a>
    ),
    ul: ({ children }) => <ul style={{ paddingLeft: 24, marginBottom: 12, lineHeight: 1.8 }}>{children}</ul>,
    ol: ({ children }) => <ol style={{ paddingLeft: 24, marginBottom: 12, lineHeight: 1.8 }}>{children}</ol>,
    li: ({ children }) => <li style={{ marginBottom: 4, fontSize: 14 }}>{children}</li>,
    code: ({ children }) => (
        <code
            style={{
                backgroundColor: '#f5f5f5',
                padding: '2px 6px',
                borderRadius: 3,
                fontSize: 13,
                fontFamily: "'SFMono-Regular', Consolas, monospace",
            }}
        >
            {children}
        </code>
    ),
    pre: ({ children }) => (
        <pre
            style={{
                backgroundColor: '#f6f8fa',
                padding: 16,
                borderRadius: 6,
                overflow: 'auto',
                fontSize: 13,
                lineHeight: 1.5,
                marginBottom: 16,
                border: '1px solid #e8e8e8',
            }}
        >
            {children}
        </pre>
    ),
    blockquote: ({ children }) => (
        <blockquote
            style={{
                borderLeft: '4px solid #1677ff',
                paddingLeft: 16,
                color: '#666',
                margin: '12px 0',
                fontStyle: 'italic',
            }}
        >
            {children}
        </blockquote>
    ),
    table: ({ children }) => <table style={{ borderCollapse: 'collapse', width: '100%', marginBottom: 16 }}>{children}</table>,
    th: ({ children }) => (
        <th style={{ border: '1px solid #ddd', padding: '8px 12px', backgroundColor: '#f5f5f5', fontWeight: 600, fontSize: 13 }}>
            {children}
        </th>
    ),
    td: ({ children }) => <td style={{ border: '1px solid #ddd', padding: '8px 12px', fontSize: 13 }}>{children}</td>,
    img: ({ src, alt }) => (
        <img
            src={src}
            alt={alt || ''}
            loading='lazy'
            style={{ maxWidth: '100%', marginBottom: 12 }}
            onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
                ;(e.target as HTMLImageElement).style.display = 'none'
            }}
        />
    ),
    hr: () => <hr style={{ border: 'none', borderTop: '1px solid #eee', margin: '20px 0' }} />,
    strong: ({ children }) => <strong style={{ fontWeight: 600 }}>{children}</strong>,
}

interface MarkdownRendererProps {
    content: string
    /** 自定义组件覆盖，会与共享默认值合并 */
    components?: Components
    className?: string
    style?: React.CSSProperties
}

type HeadingProps = React.ComponentProps<'h1'> & { node?: { position?: { start?: { line?: number } } } }

/** h1~h3 标题样式（id 由调用方注入） */
const HEADING_STYLES = {
    h1: { fontSize: 22, borderBottom: '1px solid #eee', paddingBottom: 8, marginTop: 24, marginBottom: 12 },
    h2: { fontSize: 19, borderBottom: '1px solid #eee', paddingBottom: 6, marginTop: 20, marginBottom: 10 },
    h3: { fontSize: 16, marginTop: 16, marginBottom: 8 },
} as const

/**
 * 共享 Markdown 渲染器 — 统一全站 README/AI 分析/Trending 分析的 Markdown 样式。
 * 使用 React.memo 避免内容未变化时的重复渲染。
 *
 * h1~h3 的锚点 id 优先通过标题节点的源码行号查 buildHeadingIdMap，
 * 与 extractToc 生成的 TOC slug 完全一致（含重名去重后缀）；
 * 查不到时（如 HTML 内联标题无行号映射）回退到纯文本 slugify。
 */
const MarkdownRenderer = memo(function MarkdownRenderer({ content, components, className, style }: MarkdownRendererProps) {
    const headingIdMap = useMemo(() => buildHeadingIdMap(content), [content])

    const headingComponents = useMemo<Components>(() => {
        const resolveId = (node: HeadingProps['node'], children: React.ReactNode): string => {
            const line = node?.position?.start?.line
            const mapped = line === undefined ? undefined : headingIdMap.get(line)
            return mapped ?? slugify(extractTextContent(children))
        }
        return {
            h1: ({ node, children }: HeadingProps) => (
                <h1 id={resolveId(node, children)} style={HEADING_STYLES.h1}>
                    {children}
                </h1>
            ),
            h2: ({ node, children }: HeadingProps) => (
                <h2 id={resolveId(node, children)} style={HEADING_STYLES.h2}>
                    {children}
                </h2>
            ),
            h3: ({ node, children }: HeadingProps) => (
                <h3 id={resolveId(node, children)} style={HEADING_STYLES.h3}>
                    {children}
                </h3>
            ),
        }
    }, [headingIdMap])

    const mergedComponents: Components = { ...SHARED_MARKDOWN_COMPONENTS, ...headingComponents, ...components }

    return (
        <div className={className} style={style}>
            <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw, [rehypeSanitize, sanitizeSchema]]} components={mergedComponents}>
                {content}
            </ReactMarkdown>
        </div>
    )
})

export default MarkdownRenderer
