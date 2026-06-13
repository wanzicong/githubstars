import { useState, useEffect, useCallback, useRef } from 'react'
import { Segmented, Select, Card, Spin, Empty, Typography, Tag, Space, Row, Col, message, Button, Modal } from 'antd'
import { StarFilled, ForkOutlined, FireOutlined, BulbOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { fetchTrending, analyzeTrending } from '../api/trending'
import { getAnalyzeStatus } from '../api/analyze'
import MarkdownRenderer from '../components/MarkdownRenderer'
import type { GithubSearchRepo } from '../api/github'

const { Title, Text, Paragraph } = Typography

const LANGUAGE_OPTIONS = [
    { value: '', label: '全部语言' },
    { value: 'JavaScript', label: 'JavaScript' },
    { value: 'TypeScript', label: 'TypeScript' },
    { value: 'Python', label: 'Python' },
    { value: 'Java', label: 'Java' },
    { value: 'Go', label: 'Go' },
    { value: 'Rust', label: 'Rust' },
    { value: 'C++', label: 'C++' },
    { value: 'C', label: 'C' },
    { value: 'C#', label: 'C#' },
    { value: 'Ruby', label: 'Ruby' },
    { value: 'Swift', label: 'Swift' },
    { value: 'Kotlin', label: 'Kotlin' },
]

function getRelativeTime(dateStr: string): string {
    if (!dateStr) return ''
    const days = dayjs().diff(dayjs(dateStr), 'day')
    if (days <= 0) return '今天'
    if (days === 1) return '昨天'
    if (days < 7) return `${days}天前`
    if (days < 30) return `${Math.floor(days / 7)}周前`
    return `${Math.floor(days / 30)}月前`
}

function formatCount(count: number): string {
    if (count >= 1000) return (count / 1000).toFixed(1) + 'k'
    return String(count)
}

export default function Trending() {
    const [since, setSince] = useState<string>('daily')
    const [language, setLanguage] = useState<string>('')
    const [repos, setRepos] = useState<GithubSearchRepo[]>([])
    const [total, setTotal] = useState(0)
    const [dateRange, setDateRange] = useState('')
    const [loading, setLoading] = useState(false)
    const [analyzing, setAnalyzing] = useState(false)
    const [analyzeTaskId, setAnalyzeTaskId] = useState<string | null>(null)
    const [analyzeModalVisible, setAnalyzeModalVisible] = useState(false)
    const [analyzeResult, setAnalyzeResult] = useState<string | null>(null)
    const [analyzeStatus, setAnalyzeStatus] = useState('')
    const analyzePollRef = useRef<ReturnType<typeof setInterval> | null>(null)

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

    const handleAnalyze = useCallback(async () => {
        setAnalyzing(true)
        try {
            const res = await analyzeTrending(since, language || undefined)
            if (res.success && res.taskId) {
                setAnalyzeTaskId(res.taskId)
                setAnalyzeStatus('PROCESSING')
                setAnalyzeResult(null)
                setAnalyzeModalVisible(true)
                const tid = res.taskId
                if (analyzePollRef.current) clearInterval(analyzePollRef.current)
                analyzePollRef.current = setInterval(async () => {
                    try {
                        const s = await getAnalyzeStatus(tid)
                        if (s.status === 'COMPLETED') {
                            clearInterval(analyzePollRef.current!)
                            setAnalyzeStatus('COMPLETED')
                            setAnalyzeResult(s.content || '')
                        }
                    } catch {}
                }, 3000)
            }
        } catch {
            message.error('分析请求失败')
        } finally {
            setAnalyzing(false)
        }
    }, [since, language])

    return (
        <div>
            <div
                style={{
                    marginBottom: 24,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 12,
                }}
            >
                <Title level={3} style={{ margin: 0 }}>
                    <FireOutlined style={{ color: '#ff4d4f', marginRight: 8 }} />
                    趋势排行榜
                </Title>
                <Space>
                    <Select
                        value={language || ''}
                        onChange={(v) => setLanguage(v)}
                        options={LANGUAGE_OPTIONS}
                        style={{ width: 140 }}
                        placeholder='语言'
                    />
                    <Segmented
                        value={since}
                        onChange={(v) => {
                            setSince(v as string)
                        }}
                        options={[
                            { value: 'daily', label: '📅 今日' },
                            { value: 'weekly', label: '📆 本周' },
                            { value: 'monthly', label: '📊 本月' },
                        ]}
                    />
                    <Button icon={<BulbOutlined />} loading={analyzing} onClick={handleAnalyze} type='primary' ghost>
                        AI 趋势分析
                    </Button>
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
                    <Row gutter={[16, 16]}>
                        {repos.map((repo, idx) => (
                            <Col xs={24} sm={12} lg={8} key={repo.id}>
                                <Card hoverable size='small' styles={{ body: { padding: 16 } }}>
                                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                                        {/* 排名徽章 */}
                                        <div
                                            style={{
                                                width: 36,
                                                height: 36,
                                                borderRadius: 8,
                                                flexShrink: 0,
                                                background: idx < 3 ? ['#ff4d4f', '#ff7a45', '#ffa940'][idx] : '#f0f0f0',
                                                color: idx < 3 ? '#fff' : '#666',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                fontWeight: 700,
                                                fontSize: idx < 3 ? 16 : 13,
                                            }}
                                        >
                                            {idx + 1}
                                        </div>

                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                                                <img
                                                    src={repo.owner_avatar_url}
                                                    alt=''
                                                    style={{ width: 18, height: 18, borderRadius: '50%' }}
                                                />
                                                <a
                                                    href={repo.html_url}
                                                    target='_blank'
                                                    rel='noopener noreferrer'
                                                    style={{ fontWeight: 600, fontSize: 14, color: '#1677ff' }}
                                                >
                                                    {repo.full_name}
                                                </a>
                                            </div>

                                            {repo.description && (
                                                <Paragraph
                                                    ellipsis={{ rows: 2 }}
                                                    type='secondary'
                                                    style={{ fontSize: 12, marginBottom: 8 }}
                                                >
                                                    {repo.description}
                                                </Paragraph>
                                            )}

                                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                                                {repo.language && (
                                                    <Tag color='blue' style={{ fontSize: 11, margin: 0 }}>
                                                        {repo.language}
                                                    </Tag>
                                                )}
                                                <span>
                                                    <StarFilled style={{ color: '#faad14', fontSize: 12 }} />{' '}
                                                    <Text style={{ fontSize: 13, fontWeight: 600 }}>
                                                        {formatCount(repo.stargazers_count)}
                                                    </Text>
                                                </span>
                                                <span>
                                                    <ForkOutlined style={{ fontSize: 12 }} />{' '}
                                                    <Text style={{ fontSize: 12 }}>{formatCount(repo.forks_count)}</Text>
                                                </span>
                                                <Text type='secondary' style={{ fontSize: 11, marginLeft: 'auto' }}>
                                                    {getRelativeTime(repo.pushed_at)}
                                                </Text>
                                            </div>
                                        </div>
                                    </div>
                                </Card>
                            </Col>
                        ))}
                    </Row>
                )}
            </Spin>

            <Modal
                title={
                    <Space>
                        <BulbOutlined style={{ color: '#faad14' }} />
                        AI 趋势分析报告
                    </Space>
                }
                open={analyzeModalVisible}
                onCancel={() => {
                    setAnalyzeModalVisible(false)
                    if (analyzePollRef.current) clearInterval(analyzePollRef.current)
                }}
                footer={
                    <Button type='primary' onClick={() => setAnalyzeModalVisible(false)}>
                        关闭
                    </Button>
                }
                width={900}
                style={{ top: 20 }}
                maskClosable={analyzeStatus === 'COMPLETED'}
            >
                {analyzeStatus === 'PROCESSING' && (
                    <div style={{ textAlign: 'center', padding: 40 }}>
                        <Spin size='large' />
                        <div style={{ marginTop: 16 }}>AI 正在分析趋势数据...</div>
                    </div>
                )}
                {analyzeStatus === 'COMPLETED' && analyzeResult && (
                    <MarkdownRenderer content={analyzeResult} style={{ maxHeight: '65vh', overflow: 'auto' }} />
                )}
            </Modal>
        </div>
    )
}
