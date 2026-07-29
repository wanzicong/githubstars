import { useState, useEffect, useRef } from 'react'
import { Button, Space, Spin, Empty, Typography, theme } from 'antd'
import { CodeOutlined, LinkOutlined, ReloadOutlined, GithubOutlined } from '@ant-design/icons'

const { Text } = Typography

/** github1s 嵌入地址 —— VS Code 风格在线浏览仓库 */
const buildGithub1sUrl = (fullName: string): string => `https://github1s.com/${fullName}`
const buildGithubUrl = (fullName: string): string => `https://github.com/${fullName}`

interface CodePreviewCardProps {
    fullName: string
    /**
     * 是否立即加载（不使用 IntersectionObserver 延迟挂载）
     * - true：Drawer/Modal 等弹层场景，打开即加载
     * - false（默认）：文档流场景，滚动到可视区才加载，避免页面被强制跳走
     */
    eager?: boolean
    /** 嵌入区高度（默认撑满一个视口减 48px），Drawer 等场景可传 '100%' 由父容器控制 */
    height?: string
    /** 是否填满父容器剩余空间，适用于最大化 Modal 等固定高度容器 */
    fill?: boolean
}

/**
 * 仓库代码预览卡片
 *
 * 内嵌 github1s iframe，提供 VS Code 风格的代码浏览体验。
 * - 详情页：默认非 eager 模式，滚动到可视区才挂载，避免加载完成时浏览器聚焦跳走
 * - Drawer：eager 模式立即挂载，弹层打开即加载
 */
export default function CodePreviewCard({ fullName, eager = false, height, fill = false }: CodePreviewCardProps) {
    const { token } = theme.useToken()
    const [frameLoading, setFrameLoading] = useState(true)
    const [frameFailed, setFrameFailed] = useState(false)
    const [frameKey, setFrameKey] = useState(0)
    // 是否真正挂载 iframe src：文档流场景等滚动到容器进入视口才挂载，避免加载完成时浏览器自动聚焦导致页面跳走
    const [shouldMount, setShouldMount] = useState(eager)
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const containerRef = useRef<HTMLDivElement>(null)

    // IntersectionObserver 监听容器进入视口，才挂载 iframe src（仅非 eager 模式）
    // 这样 iframe 加载完成时用户已经在看它，浏览器不会因聚焦而强制跳走
    useEffect(() => {
        if (eager) return
        const container = containerRef.current
        if (!container) return
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries.some((e) => e.isIntersecting)) {
                    setShouldMount(true)
                    observer.disconnect()
                }
            },
            // 提前 100px 触发，用户还没看到就开始加载，减少白屏等待
            { rootMargin: '100px' }
        )
        observer.observe(container)
        return () => observer.disconnect()
    }, [eager])

    // iframe 加载超时兜底：20s 未完成加载则标记失败
    useEffect(() => {
        if (!frameLoading || !shouldMount) return
        timerRef.current = setTimeout(() => {
            setFrameLoading(false)
            setFrameFailed(true)
        }, 20000)
        return () => {
            if (timerRef.current) clearTimeout(timerRef.current)
        }
    }, [frameLoading, frameKey, shouldMount])

    const handleRefresh = () => {
        setFrameLoading(true)
        setFrameFailed(false)
        setFrameKey((k) => k + 1)
    }

    const handleFrameLoad = () => {
        if (timerRef.current) clearTimeout(timerRef.current)
        setFrameLoading(false)
        setFrameFailed(false)
    }

    return (
        <div
            style={
                fill
                    ? { height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column' }
                    : undefined
            }
        >
            {/* 工具栏 */}
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: 8,
                    marginBottom: 12,
                }}
            >
                <Space wrap>
                    <CodeOutlined style={{ color: token.colorPrimary }} />
                    <Text strong>代码预览</Text>
                    <Text type='secondary' style={{ fontSize: 12 }}>VS Code 风格</Text>
                </Space>
                <Space size={8} wrap>
                    <Button size='small' icon={<ReloadOutlined />} onClick={handleRefresh}>
                        刷新
                    </Button>
                    <Button
                        size='small'
                        icon={<LinkOutlined />}
                        href={buildGithub1sUrl(fullName)}
                        target='_blank'
                    >
                        新标签打开
                    </Button>
                    <Button
                        size='small'
                        icon={<GithubOutlined />}
                        href={buildGithubUrl(fullName)}
                        target='_blank'
                    >
                        GitHub
                    </Button>
                </Space>
            </div>

            {/* 嵌入区 — 高度默认撑满一个视口（减底部留白），Drawer 等场景可由 height prop 覆盖 */}
            <div
                ref={containerRef}
                style={{
                    position: 'relative',
                    borderRadius: 8,
                    height: fill ? undefined : (height ?? 'max(calc(100vh - 48px), 400px)'),
                    flex: fill ? 1 : undefined,
                    minHeight: fill ? 0 : undefined,
                    overflow: 'hidden',
                    border: `1px solid ${token.colorBorderSecondary}`,
                    background: token.colorBgContainer,
                }}
            >
                {!shouldMount && (
                    <div
                        style={{
                            position: 'absolute',
                            inset: 0,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 12,
                            zIndex: 1,
                            background: token.colorBgContainer,
                        }}
                    >
                        <CodeOutlined style={{ fontSize: 32, color: token.colorTextTertiary }} />
                        <Text type='secondary'>滚动到此处自动加载代码预览</Text>
                    </div>
                )}
                {shouldMount && frameLoading && (
                    <div
                        style={{
                            position: 'absolute',
                            inset: 0,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 12,
                            zIndex: 1,
                            background: token.colorBgContainer,
                        }}
                    >
                        <Spin size='large' />
                        <Text type='secondary'>正在加载 github1s 代码浏览…</Text>
                    </div>
                )}
                {frameFailed && !frameLoading && (
                    <div
                        style={{
                            position: 'absolute',
                            inset: 0,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 16,
                            zIndex: 2,
                            background: token.colorBgContainer,
                        }}
                    >
                        <Empty
                            image={Empty.PRESENTED_IMAGE_SIMPLE}
                            description={
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                    <Text type='secondary'>github1s 加载超时，可能是网络受限</Text>
                                    <Text type='secondary' style={{ fontSize: 12 }}>
                                        可尝试在新标签打开，或检查网络后重试
                                    </Text>
                                </div>
                            }
                        />
                        <Space>
                            <Button icon={<ReloadOutlined />} onClick={handleRefresh}>
                                重试
                            </Button>
                            <Button type='primary' ghost href={buildGithub1sUrl(fullName)} target='_blank'>
                                新标签打开
                            </Button>
                        </Space>
                    </div>
                )}
                {shouldMount && (
                    <iframe
                        key={`${fullName}-${frameKey}`}
                        src={buildGithub1sUrl(fullName)}
                        onLoad={handleFrameLoad}
                        title={`代码预览 - ${fullName}`}
                        style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
                    />
                )}
            </div>
        </div>
    )
}
