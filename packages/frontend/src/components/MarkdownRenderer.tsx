import { memo } from 'react'
import ReactMarkdown from 'react-markdown'
import rehypeRaw from 'rehype-raw'
import remarkGfm from 'remark-gfm'
import type { Components } from 'react-markdown'

/** Markdown → React 的共享渲染组件映射，确保全站 README/AI 分析等 Markdown 渲染风格一致 */
const SHARED_MARKDOWN_COMPONENTS: Components = {
    h1: ({ children }) => (
        <h1 style={{ fontSize: 22, borderBottom: '1px solid #eee', paddingBottom: 8, marginTop: 24, marginBottom: 12 }}>
            {children}
        </h1>
    ),
    h2: ({ children }) => (
        <h2 style={{ fontSize: 19, borderBottom: '1px solid #eee', paddingBottom: 6, marginTop: 20, marginBottom: 10 }}>
            {children}
        </h2>
    ),
    h3: ({ children }) => <h3 style={{ fontSize: 16, marginTop: 16, marginBottom: 8 }}>{children}</h3>,
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

/**
 * 共享 Markdown 渲染器 — 统一全站 README/AI 分析/Trending 分析的 Markdown 样式。
 * 使用 React.memo 避免内容未变化时的重复渲染。
 */
const MarkdownRenderer = memo(function MarkdownRenderer({ content, components, className, style }: MarkdownRendererProps) {
    const mergedComponents: Components = { ...SHARED_MARKDOWN_COMPONENTS, ...components }

    return (
        <div className={className} style={style}>
            <ReactMarkdown rehypePlugins={[rehypeRaw]} remarkPlugins={[remarkGfm]} components={mergedComponents}>
                {content}
            </ReactMarkdown>
        </div>
    )
})

export { SHARED_MARKDOWN_COMPONENTS }
export default MarkdownRenderer
