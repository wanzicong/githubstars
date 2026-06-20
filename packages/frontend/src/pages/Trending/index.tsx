import { useState, useEffect, useCallback } from 'react'
import { Segmented, Select, Spin, Empty, Typography, Tag, Space, Button, App } from 'antd'
import { StarFilled, ForkOutlined, FireOutlined, TranslationOutlined } from '@ant-design/icons'
import { fetchTrending, translateTrending } from '../../api'
import type { GithubSearchRepo } from '../../types'
import { LANGUAGE_OPTIONS, RANK_BADGE_COLORS } from '../../constants'
import { formatNumberShort, getRelativeTime } from '../../utils/format'

const { Title, Text } = Typography

export default function Trending() {
    const { message } = App.useApp()
    const [since, setSince] = useState<string>('daily')
    const [language, setLanguage] = useState<string>('')
    const [repos, setRepos] = useState<GithubSearchRepo[]>([])
    const [total, setTotal] = useState(0)
    const [dateRange, setDateRange] = useState('')
    const [loading, setLoading] = useState(false)
    const [translating, setTranslating] = useState(false)

    const load = useCallback(async (s: string, lang: string) => {
        setLoading(true)
        try {
            const data = await fetchTrending(s, lang || undefined, 20)
            setRepos(data.repos || [])
            setTotal(data.total || 0)
            setDateRange(data.dateRange || '')
        } catch {
            message.error('加载趋势数据失败')
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        load(since, language)
    }, [since, language, load])

    /** 触发翻译未缓存的描述 */
    const handleTranslate = useCallback(async () => {
        setTranslating(true)
        try {
            const result = await translateTrending(since, language || undefined, 20)
            if (result.success) {
                // 使用翻译接口返回的仓库数据直接更新显示
                if (result.repos && result.repos.length > 0) {
                    setRepos(result.repos)
                }
                if (result.translated > 0) {
                    message.success(result.message)
                } else if (result.skipped > 0) {
                    message.success(result.message)
                } else {
                    message.info(result.message)
                }
            }
        } catch {
            message.error('翻译失败')
        } finally {
            setTranslating(false)
        }
    }, [since, language, load])

    // 统计未翻译数量
    const untranslatedCount = repos.filter((r) => r.description && !r.descriptionCn).length

    // 最大 Star 数（用于横条宽度计算）
    const maxStars = repos.length > 0 ? Math.max(...repos.map((r) => r.starsCount || 1)) : 1

    return (
        <div>
            <div
                style={{
                    marginBottom: 24,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    flexWrap: 'wrap',
                    gap: 12,
                }}
            >
                <Title level={3} style={{ margin: 0 }}>
                    <FireOutlined style={{ color: '#ff4d4f', marginRight: 8 }} />
                    趋势排行榜
                </Title>
                <Space wrap size={[8, 8]}>
                    {untranslatedCount > 0 && (
                        <Button
                            icon={<TranslationOutlined />}
                            onClick={handleTranslate}
                            loading={translating}
                            size='small'
                        >
                            翻译描述 ({untranslatedCount})
                        </Button>
                    )}
                    <Select
                        value={language || ''}
                        onChange={(v) => setLanguage(v)}
                        options={LANGUAGE_OPTIONS}
                        style={{ width: 140 }}
                        placeholder='语言'
                    />
                    <Segmented
                        value={since}
                        onChange={(v) => setSince(v as string)}
                        options={[
                            { value: 'daily', label: '今日' },
                            { value: 'weekly', label: '本周' },
                            { value: 'monthly', label: '本月' },
                        ]}
                    />
                </Space>
            </div>

            <Spin spinning={loading}>
                {dateRange && (
                    <Text type='secondary' style={{ display: 'block', marginBottom: 16, fontSize: 12 }}>
                        统计时段: {dateRange} | 共 {total} 个新仓库
                    </Text>
                )}

                {repos.length === 0 && !loading ? (
                    <Empty description='暂无趋势数据' style={{ marginTop: 60 }} />
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {repos.map((repo, idx) => {
                            const barPercent = maxStars > 0 ? (repo.starsCount / maxStars) * 100 : 0
                            return (
                                <div
                                    key={repo.id}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'stretch',
                                        background: '#fff',
                                        borderRadius: 8,
                                        border: '1px solid #f0f0f0',
                                        overflow: 'hidden',
                                        minHeight: 72,
                                    }}
                                >
                                    {/* 排名徽章 */}
                                    <div
                                        style={{
                                            width: 44,
                                            flexShrink: 0,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            background: idx < 3 ? RANK_BADGE_COLORS[idx] : '#f5f5f5',
                                            color: idx < 3 ? '#fff' : '#999',
                                            fontWeight: 700,
                                            fontSize: idx < 3 ? 18 : 14,
                                        }}
                                    >
                                        {idx + 1}
                                    </div>

                                    {/* 仓库信息 */}
                                    <div style={{ flex: 1, padding: '10px 16px', minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                            <img
                                                src={repo.ownerAvatarUrl}
                                                alt=''
                                                style={{ width: 20, height: 20, borderRadius: '50%', flexShrink: 0 }}
                                            />
                                            <a
                                                href={repo.htmlUrl}
                                                target='_blank'
                                                rel='noopener noreferrer'
                                                style={{ fontWeight: 600, fontSize: 14, color: '#1677ff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                                            >
                                                {repo.fullName}
                                            </a>
                                            {repo.language && (
                                                <Tag color='blue' style={{ fontSize: 11, margin: 0, flexShrink: 0 }}>
                                                    {repo.language}
                                                </Tag>
                                            )}
                                        </div>
                                        {(repo.descriptionCn || repo.description) && (
                                            <Text
                                                type='secondary'
                                                style={{
                                                    fontSize: 12,
                                                    lineHeight: '18px',
                                                    display: '-webkit-box',
                                                    WebkitLineClamp: 2,
                                                    WebkitBoxOrient: 'vertical',
                                                    overflow: 'hidden',
                                                }}
                                            >
                                                {repo.descriptionCn || repo.description}
                                            </Text>
                                        )}
                                    </div>

                                    {/* Star 横条 */}
                                    <div
                                        style={{
                                            width: 200,
                                            flexShrink: 0,
                                            padding: '10px 16px 10px 0',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            justifyContent: 'center',
                                            alignItems: 'flex-end',
                                            gap: 4,
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                            <StarFilled style={{ color: '#faad14', fontSize: 12 }} />
                                            <Text style={{ fontSize: 14, fontWeight: 700 }}>{formatNumberShort(repo.starsCount)}</Text>
                                            <ForkOutlined style={{ fontSize: 11, color: '#999', marginLeft: 4 }} />
                                            <Text type='secondary' style={{ fontSize: 11 }}>{formatNumberShort(repo.forksCount)}</Text>
                                        </div>
                                        <div style={{ width: '100%', height: 8, background: '#f5f5f5', borderRadius: 4, overflow: 'hidden' }}>
                                            <div
                                                style={{
                                                    width: `${barPercent}%`,
                                                    height: '100%',
                                                    borderRadius: 4,
                                                    background: idx < 3
                                                        ? `linear-gradient(90deg, ${RANK_BADGE_COLORS[idx]}, ${RANK_BADGE_COLORS[idx]}cc)`
                                                        : 'linear-gradient(90deg, #91caff, #b7eb8f)',
                                                    transition: 'width 0.6s ease',
                                                }}
                                            />
                                        </div>
                                        <Text type='secondary' style={{ fontSize: 10 }}>
                                            {getRelativeTime(repo.pushedAt)}
                                        </Text>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </Spin>
        </div>
    )
}
