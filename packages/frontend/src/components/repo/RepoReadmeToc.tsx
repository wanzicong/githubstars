import { useEffect, useRef } from 'react'
import { Button, Typography, theme } from 'antd'
import { OrderedListOutlined } from '@ant-design/icons'
import type { TocHeading } from '../../utils/toc'

const { Text } = Typography

/** TOC 条目按层级缩进：h1=0、h2=8px、h3=20px */
function tocItemIndent(level: number): number {
    if (level === 3) return 20
    if (level === 2) return 8
    return 0
}

export interface RepoReadmeTocProps {
    items: TocHeading[]
    /** 是否展开列表 */
    expanded: boolean
    /** 点击跳转回调（slug 定位由父组件决定：卡片滚 body，弹窗滚容器） */
    onNavigate: (slug: string) => void
    /** 折叠/展开切换；inline 布局下不展示折叠按钮 */
    onToggle?: () => void
    /** 当前阅读到的章节（scroll-spy），不传则无高亮 */
    activeSlug?: string | null
    /** 阅读进度 0~1，不传则不显示进度条 */
    progress?: number
    /** fixed 布局下面板是否可见（README 区域外淡出） */
    inView?: boolean
    /** fixed=悬浮视口右侧；inline=文档流内（全屏弹窗用，始终展开、无折叠按钮） */
    layout?: 'fixed' | 'inline'
    /** fixed 布局定位参数 */
    top?: number
    bottom?: number
    right?: number
}

/**
 * README 结构导航（TOC）面板
 *
 * - fixed 布局：悬浮于视口右侧，支持折叠、区域外淡出、scroll-spy 高亮、阅读进度条
 * - inline 布局：嵌入文档流（全屏弹窗左栏），始终展开
 */
export default function RepoReadmeToc({
    items,
    expanded,
    onNavigate,
    onToggle,
    activeSlug = null,
    progress,
    inView = true,
    layout = 'fixed',
    top = 156,
    bottom = 72,
    right = 16,
}: RepoReadmeTocProps) {
    const { token } = theme.useToken()
    const listRef = useRef<HTMLDivElement>(null)

    const width = expanded ? 200 : 40

    // 高亮章节变化时，自动滚动 TOC 列表保持高亮项可见
    useEffect(() => {
        if (!activeSlug || !expanded) return
        const container = listRef.current
        const activeEl = container?.querySelector<HTMLElement>(`[data-slug="${CSS.escape(activeSlug)}"]`)
        if (!container || !activeEl) return
        container.scrollTo({ top: activeEl.offsetTop - container.clientHeight / 2 + 12, behavior: 'smooth' })
    }, [activeSlug, expanded])

    const panelStyle: React.CSSProperties =
        layout === 'fixed'
            ? {
                  position: 'fixed',
                  right,
                  top,
                  bottom,
                  width,
                  opacity: inView ? 1 : 0,
                  pointerEvents: inView ? 'auto' : 'none',
                  transition: 'width 0.2s, opacity 0.25s',
                  background: token.colorBgContainer,
                  borderRadius: 8,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                  zIndex: 10,
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
              }
            : {
                  width: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  minHeight: 0,
              }

    return (
        <div style={panelStyle}>
            {/* 阅读进度条 */}
            {progress !== undefined && expanded && (
                <div style={{ height: 3, flexShrink: 0, background: token.colorFillTertiary }}>
                    <div
                        style={{
                            width: `${Math.round(progress * 100)}%`,
                            height: '100%',
                            background: token.colorPrimary,
                            transition: 'width 0.15s',
                        }}
                    />
                </div>
            )}

            {/* 折叠工具行（仅 fixed 布局） */}
            {layout === 'fixed' && (
                <div
                    style={{
                        padding: '4px 8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexShrink: 0,
                        borderBottom: `1px solid ${token.colorBorderSecondary}`,
                    }}
                >
                    <Button type='text' size='small' icon={<OrderedListOutlined />} onClick={onToggle} title='结构导航' />
                    {expanded && <Text type='secondary' style={{ fontSize: 12 }}>导航</Text>}
                </div>
            )}

            {/* 章节列表 */}
            {expanded && (
                <div ref={listRef} style={{ flex: 1, padding: 8, overflow: 'auto', minHeight: 0 }}>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                        {items.map((item) => {
                            const active = item.slug === activeSlug
                            return (
                                <li key={item.slug}>
                                    <button
                                        type='button'
                                        data-slug={item.slug}
                                        title={item.text}
                                        onClick={() => onNavigate(item.slug)}
                                        style={{
                                            display: 'block',
                                            width: '100%',
                                            textAlign: 'left',
                                            border: 'none',
                                            background: active ? token.colorFillTertiary : 'none',
                                            cursor: 'pointer',
                                            fontSize: 12,
                                            lineHeight: '22px',
                                            padding: '1px 4px',
                                            paddingLeft: tocItemIndent(item.level) + 4,
                                            color: active ? token.colorPrimary : token.colorTextSecondary,
                                            fontWeight: active ? 600 : 400,
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap',
                                            borderRadius: 4,
                                            transition: 'background 0.15s, color 0.15s',
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.background = token.colorFillSecondary
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.background = active ? token.colorFillTertiary : 'none'
                                        }}
                                    >
                                        {item.text}
                                    </button>
                                </li>
                            )
                        })}
                    </ul>
                </div>
            )}
        </div>
    )
}
