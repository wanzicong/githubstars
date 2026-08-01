import { useState, useMemo, useEffect, useRef, type ReactNode } from 'react'
import { Card, Button, Space, Typography, Modal, theme } from 'antd'
import { ReadOutlined, ExpandOutlined } from '@ant-design/icons'
import type { RepoDetailData } from '../../types'
import MarkdownRenderer from '../common/MarkdownRenderer'
import RepoReadmeToc from './RepoReadmeToc'
import { extractToc } from '../../utils/toc'

const { Text } = Typography

/** 顶部固定栏高度（header 56px + tabs 36px + 间距） */
const SCROLL_OFFSET = 96
/** TOC 面板距顶部的额外偏移，往下挪避免遮挡按钮行 */
const TOC_TOP_OFFSET = 60
/** FloatButton.Group（两个 40px 按钮 + 间距 + 底部 24px）占用的安全区域 */
const FLOAT_BUTTON_BOTTOM = 132
/** 页面右侧最小安全边距，避免贴边 */
const SIDE_MARGIN = 16
/** TOC 展开状态持久化 key */
const TOC_EXPANDED_KEY = 'repo-readme-toc-expanded'
/** 桌面端最小宽度（Ant Design lg 断点），低于此宽度不渲染悬浮 TOC */
const DESKTOP_TOC_QUERY = '(min-width: 992px)'
/** scroll-spy 判定线：标题越过视口顶部 SCROLL_OFFSET、且未滚过视口 70% 处视为当前阅读区 */
const SPY_ROOT_MARGIN = `-${SCROLL_OFFSET}px 0px -70% 0px`

/**
 * 滚动到指定锚点标题位置，带动画且避开页面顶部固定栏。
 * 本项目全局滚动容器是 <body>（body.scrollHeight 远大于视口，documentElement 不滚动），
 * 因此必须操作 document.body.scrollTo / document.body.scrollTop，
 * 不能用 window.scrollTo（window 不是该页面的滚动容器）。
 */
function scrollToHeading(slug: string) {
    const el = document.getElementById(slug)
    if (!el) return
    const rect = el.getBoundingClientRect()
    const offset = rect.top + document.body.scrollTop - SCROLL_OFFSET
    document.body.scrollTo({ top: offset, behavior: 'smooth' })
}

/** 监听媒体查询，返回当前是否匹配（SSR/初始渲染按 false 处理） */
function useMediaQuery(query: string): boolean {
    const [matches, setMatches] = useState(() => window.matchMedia(query).matches)
    useEffect(() => {
        const mq = window.matchMedia(query)
        const handler = (e: MediaQueryListEvent) => setMatches(e.matches)
        mq.addEventListener('change', handler)
        return () => mq.removeEventListener('change', handler)
    }, [query])
    return matches
}

/**
 * 通用阅读进度计算：返回 0~1，或 undefined 表示"内容不足一屏无需显示进度"。
 * scrollContainer 为 null 时表示主页面滚动（本项目主滚动容器是 document.body）。
 */
function computeProgress(content: HTMLElement, scrollContainer: HTMLElement | null, topOffset: number): number | undefined {
    const rect = content.getBoundingClientRect()
    if (scrollContainer) {
        const containerRect = scrollContainer.getBoundingClientRect()
        const total = content.scrollHeight - scrollContainer.clientHeight
        if (total <= 0) return undefined
        const done = Math.min(Math.max(containerRect.top - rect.top, 0), total)
        return done / total
    }
    const total = rect.height - window.innerHeight + topOffset
    if (total <= 0) return undefined
    const done = Math.min(Math.max(-rect.top + topOffset, 0), total)
    return done / total
}

export interface RepoReadmeCardProps {
    repo: RepoDetailData
}

/**
 * 仓库详情页 README 卡片（含结构导航）
 *
 * 左侧渲染 Markdown 内容，右侧 fixed 悬浮 TOC 导航面板：
 * - scroll-spy 滚动同步高亮当前章节
 * - 顶部阅读进度条（内容不足一屏时自动隐藏）
 * - 展开状态持久化到 localStorage
 * - 仅当 README 卡片在视口内时可见，避免遮挡页面底部元素
 * - 窄屏（<992px）不渲染悬浮 TOC，避免遮挡正文
 * - 全屏弹窗内提供 TOC 双栏导航（独立 scroll-spy + 阅读进度）
 */
export default function RepoReadmeCard({ repo }: RepoReadmeCardProps) {
    const { token } = theme.useToken()
    const [fullscreenVisible, setFullscreenVisible] = useState(false)
    const [tocExpanded, setTocExpanded] = useState(() => localStorage.getItem(TOC_EXPANDED_KEY) === '1')
    const [tocInView, setTocInView] = useState(false)
    const [activeSlug, setActiveSlug] = useState<string | null>(null)
    const [progress, setProgress] = useState<number | undefined>(undefined)
    const [modalActiveSlug, setModalActiveSlug] = useState<string | null>(null)
    const [modalProgress, setModalProgress] = useState<number | undefined>(undefined)
    const cardRef = useRef<HTMLDivElement>(null)
    const modalContentRef = useRef<HTMLDivElement>(null)
    const visibleHeadingsRef = useRef<Set<string>>(new Set())
    const modalVisibleHeadingsRef = useRef<Set<string>>(new Set())
    const isDesktop = useMediaQuery(DESKTOP_TOC_QUERY)

    const displayReadme = repo.readmeCn || repo.readmeOriginal || ''
    const hasReadme = Boolean(displayReadme)
    const showingChinese = Boolean(repo.readmeCn)
    const readmeLabel = showingChinese ? 'README 中文' : 'README 原文'

    const tocItems = useMemo(() => (hasReadme ? extractToc(displayReadme) : []), [displayReadme, hasReadme])
    const hasTocItems = tocItems.length > 1
    // 悬浮 TOC 仅桌面端渲染；弹窗内 TOC 不限宽度（弹窗本身有布局保障）
    const showFixedToc = hasTocItems && isDesktop

    // TOC 面板仅当 README 卡片在视口内时显示，避免遮挡页面底部元素
    useEffect(() => {
        const card = cardRef.current
        if (!card) return
        const observer = new IntersectionObserver(([entry]) => setTocInView(entry.isIntersecting), { rootMargin: '-80px 0px -80px 0px' })
        observer.observe(card)
        return () => observer.disconnect()
    }, [])

    // 卡片 scroll-spy：监听所有标题，文档序最后一个进入"阅读线"的标题为当前章节。
    // 全屏弹窗打开期间断开监听，避免后台空转。
    useEffect(() => {
        if (!hasTocItems || fullscreenVisible) return
        visibleHeadingsRef.current.clear()
        const root = document.getElementById('readme-content-anchor')
        if (!root) return
        const headings = Array.from(root.querySelectorAll('h1[id], h2[id], h3[id]'))
        if (headings.length === 0) return
        const visible = visibleHeadingsRef.current
        const observer = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) {
                    if (entry.isIntersecting) visible.add(entry.target.id)
                    else visible.delete(entry.target.id)
                }
                for (let i = headings.length - 1; i >= 0; i--) {
                    if (visible.has(headings[i].id)) {
                        setActiveSlug(headings[i].id)
                        return
                    }
                }
            },
            { rootMargin: SPY_ROOT_MARGIN, threshold: 0 },
        )
        for (const h of headings) observer.observe(h)
        return () => observer.disconnect()
    }, [hasTocItems, displayReadme, fullscreenVisible])

    // 卡片阅读进度：按 README 内容已滚过视口的比例计算（rAF 节流）。
    // 主滚动容器是 document.body，故监听 body 的 scroll；resize 仍挂在 window。
    // 弹窗打开期间断开监听；内容不足一屏时返回 undefined 隐藏进度条。
    useEffect(() => {
        if (!hasReadme || fullscreenVisible) return
        const content = document.getElementById('readme-content-anchor')
        if (!content) return
        let raf = 0
        const update = () => setProgress(computeProgress(content, null, SCROLL_OFFSET))
        const onScroll = () => {
            cancelAnimationFrame(raf)
            raf = requestAnimationFrame(update)
        }
        update()
        document.body.addEventListener('scroll', onScroll, { passive: true })
        window.addEventListener('resize', onScroll)
        return () => {
            document.body.removeEventListener('scroll', onScroll)
            window.removeEventListener('resize', onScroll)
            cancelAnimationFrame(raf)
        }
    }, [hasReadme, displayReadme, fullscreenVisible])

    // 弹窗 scroll-spy：观察者在弹窗打开且内容渲染后建立，root 为弹窗滚动容器
    useEffect(() => {
        if (!fullscreenVisible || !hasTocItems) return
        modalVisibleHeadingsRef.current.clear()
        const rootEl = modalContentRef.current
        if (!rootEl) return
        const headings = Array.from(rootEl.querySelectorAll('h1[id], h2[id], h3[id]'))
        if (headings.length === 0) return
        const visible = modalVisibleHeadingsRef.current
        const observer = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) {
                    if (entry.isIntersecting) visible.add(entry.target.id)
                    else visible.delete(entry.target.id)
                }
                for (let i = headings.length - 1; i >= 0; i--) {
                    if (visible.has(headings[i].id)) {
                        setModalActiveSlug(headings[i].id)
                        return
                    }
                }
            },
            { root: rootEl, rootMargin: '0px 0px -70% 0px', threshold: 0 },
        )
        for (const h of headings) observer.observe(h)
        return () => observer.disconnect()
    }, [fullscreenVisible, hasTocItems, displayReadme])

    // 弹窗阅读进度：监听弹窗滚动容器（rAF 节流）
    useEffect(() => {
        if (!fullscreenVisible || !hasReadme) return
        const container = modalContentRef.current
        if (!container) return
        let raf = 0
        const update = () => setModalProgress(computeProgress(container, container, 0))
        const onScroll = () => {
            cancelAnimationFrame(raf)
            raf = requestAnimationFrame(update)
        }
        update()
        container.addEventListener('scroll', onScroll, { passive: true })
        return () => {
            container.removeEventListener('scroll', onScroll)
            cancelAnimationFrame(raf)
        }
    }, [fullscreenVisible, hasReadme, displayReadme])

    /** 折叠/展开切换，并持久化偏好 */
    const handleToggleToc = () => {
        const next = !tocExpanded
        setTocExpanded(next)
        localStorage.setItem(TOC_EXPANDED_KEY, next ? '1' : '0')
    }

    /** 全屏弹窗内的跳转：作用域限定在弹窗容器内，避免与卡片重复 ID 冲突 */
    const scrollToHeadingInModal = (slug: string) => {
        const root = modalContentRef.current
        const el = root?.querySelector<HTMLElement>(`#${CSS.escape(slug)}`)
        el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }

    const cardTitle = (
        <Space>
            <ReadOutlined />
            <span>{hasReadme ? readmeLabel : 'README'}</span>
        </Space>
    )

    const tocPanelWidth = tocExpanded ? 200 : 40

    let readmeContent: ReactNode
    if (hasReadme) {
        readmeContent = (
            <div style={{ display: 'flex', gap: 16 }}>
                <div
                    style={{
                        flex: 1,
                        minWidth: 0,
                        overflow: 'hidden',
                        // TOC 收起时只需留出窄按钮的空间，展开时留出面板宽度
                        paddingRight: showFixedToc ? tocPanelWidth + SIDE_MARGIN : 0,
                        transition: 'padding-right 0.2s',
                    }}
                    id='readme-content-anchor'
                >
                    <MarkdownRenderer content={displayReadme} style={{ padding: '8px 16px' }} />
                </div>

                {/* 结构导航 —— fixed 悬浮于视口右侧，仅 README 卡片可见且桌面端时出现 */}
                {showFixedToc && (
                    <RepoReadmeToc
                        items={tocItems}
                        expanded={tocExpanded}
                        onToggle={handleToggleToc}
                        onNavigate={scrollToHeading}
                        activeSlug={activeSlug}
                        progress={progress}
                        inView={tocInView}
                        top={SCROLL_OFFSET + TOC_TOP_OFFSET}
                        bottom={FLOAT_BUTTON_BOTTOM}
                        right={SIDE_MARGIN}
                    />
                )}
            </div>
        )
    } else if (repo.readmeFetched) {
        readmeContent = (
            <div style={{ textAlign: 'center', padding: 24 }}>
                <ReadOutlined style={{ fontSize: 32, color: '#d9d9d9', marginBottom: 8 }} />
                <br />
                <Text type='secondary'>该仓库没有 README</Text>
            </div>
        )
    } else {
        readmeContent = (
            <div style={{ textAlign: 'center', padding: 24 }}>
                <ReadOutlined style={{ fontSize: 32, color: '#d9d9d9', marginBottom: 8 }} />
                <br />
                <Text type='secondary'>README 尚未获取</Text>
            </div>
        )
    }

    const extraContent = hasReadme ? (
        <Button size='small' icon={<ExpandOutlined />} onClick={() => setFullscreenVisible(true)}>
            放大查看
        </Button>
    ) : undefined

    return (
        <>
            <Card className='star-detail-readme-shell' title={cardTitle} extra={extraContent} ref={cardRef as React.RefObject<HTMLDivElement>}>
                {readmeContent}
            </Card>

            {/* README 全屏查看弹窗（左 TOC 导航 + 右内容，各自独立滚动） */}
            <Modal
                title={
                    <Space>
                        <ExpandOutlined />
                        <span>{readmeLabel} - 全屏查看</span>
                    </Space>
                }
                open={fullscreenVisible}
                onCancel={() => setFullscreenVisible(false)}
                footer={
                    <Button type='primary' onClick={() => setFullscreenVisible(false)}>
                        关闭
                    </Button>
                }
                width='95%'
                style={{ top: 20, paddingBottom: 0 }}
                styles={{ body: { maxHeight: 'calc(100vh - 160px)', overflow: 'hidden', padding: 0 } }}
            >
                <div style={{ display: 'flex', height: 'calc(100vh - 170px)' }}>
                    {hasTocItems && (
                        <div style={{ width: 200, flexShrink: 0, borderRight: `1px solid ${token.colorBorderSecondary}` }}>
                            <RepoReadmeToc
                                items={tocItems}
                                layout='inline'
                                expanded
                                onNavigate={scrollToHeadingInModal}
                                activeSlug={modalActiveSlug}
                                progress={modalProgress}
                            />
                        </div>
                    )}
                    <div ref={modalContentRef} style={{ flex: 1, overflow: 'auto', padding: '16px 24px', minWidth: 0 }}>
                        <MarkdownRenderer content={displayReadme} style={{ padding: '8px 16px' }} />
                    </div>
                </div>
            </Modal>
        </>
    )
}
