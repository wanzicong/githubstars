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
    /** 点击跳转回调（slug 定位由父组件决定：卡片滚 window，弹窗滚容器） */
    onNavigate: (slug: string) => void
    /** 折叠/展开切换；inline 布局下不展示折叠按钮 */
    onToggle?: () => void
    /** 当前阅读到的章节（scroll-spy），不传则无高亮 */
    activeSlug?: string | null
    /** 阅读进度 0~1；undefined 表示内容不足一屏，不显示进度条 */
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
 * - fixed 布局：悬浮于视口右侧，支持折叠（带宽度+透明度过渡）、区域外淡出、
 *   scroll-spy 高亮、阅读进度条
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
    bottom = 132,
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
                  height: '100%',
              }

    return (
        <nav
            style={{
                ...panelStyle,
                // hover/active 背景经 CSS 变量注入，配合 index.css 中的 .toc-nav-item 规则，
                // 避免用 JS mouseenter/leave 操作 DOM（主题切换时不会自动更新）
                ['--toc-hover-bg' as string]: token.colorFillSecondary,
                ['--toc-active-bg' as string]: token.colorFillTertiary,
            }}
            role='navigation'
            aria-label='README 结构导航'
        >
            {/* 阅读进度条：有进度时填充，无进度/折叠时保持占位避免布局跳动 */}
            <div
                style={{
                    height: 3,
                    flexShrink: 0,
                    background: token.colorFillTertiary,
                    opacity: expanded ? 1 : 0,
                    transition: 'opacity 0.2s',
                }}
            >
                <div
                    style={{
                        width: progress === undefined ? '0%' : `${Math.round(progress * 100)}%`,
                        height: '100%',
                        background: token.colorPrimary,
                        transition: 'width 0.15s',
                    }}
                />
            </div>

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
                    <Button
                        type='text'
                        size='small'
                        icon={<OrderedListOutlined />}
                        onClick={onToggle}
                        title='结构导航'
                        aria-label={expanded ? '收起结构导航' : '展开结构导航'}
                        aria-expanded={expanded}
                    />
                    {expanded && (
                        <Text type='secondary' style={{ fontSize: 12 }}>
                            导航
                        </Text>
                    )}
                </div>
            )}

            {/* 章节列表：始终挂载，折叠时用透明度+事件屏蔽过渡，避免突兀的内容闪现 */}
            <div
                ref={listRef}
                aria-hidden={!expanded}
                style={{
                    flex: 1,
                    padding: 8,
                    overflow: 'auto',
                    minHeight: 0,
                    opacity: expanded ? 1 : 0,
                    visibility: expanded ? 'visible' : 'hidden',
                    pointerEvents: expanded ? 'auto' : 'none',
                    transition: 'opacity 0.15s, visibility 0.15s',
                }}
            >
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                    {items.map((item) => {
                        const active = item.slug === activeSlug
                        return (
                            <li key={item.slug}>
                                <button
                                    type='button'
                                    data-slug={item.slug}
                                    title={item.text}
                                    aria-current={active ? 'location' : undefined}
                                    tabIndex={expanded ? 0 : -1}
                                    className={active ? 'toc-nav-item toc-nav-item-active' : 'toc-nav-item'}
                                    onClick={() => onNavigate(item.slug)}
                                    style={{
                                        paddingLeft: tocItemIndent(item.level) + 4,
                                        color: active ? token.colorPrimary : token.colorTextSecondary,
                                        fontWeight: active ? 600 : 400,
                                    }}
                                >
                                    {item.text}
                                </button>
                            </li>
                        )
                    })}
                </ul>
            </div>
        </nav>
    )
}
