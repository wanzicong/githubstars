import { useState, useEffect, useMemo, useRef } from 'react'
import { Card, Button, Table, Tag, Select, Input, Row, Col, Typography, Spin, App } from 'antd'
import { GithubOutlined, RobotOutlined, ClearOutlined, FilterOutlined } from '@ant-design/icons'
import * as classifyApi from '../api/classify'
import * as categoriesApi from '../api/categories'
import type { GithubRepo } from '../types'

const { Title, Text } = Typography

const TOP_N_OPTIONS = [
    { label: '5 类', value: 5 },
    { label: '8 类', value: 8 },
    { label: '10 类', value: 10 },
    { label: '15 类', value: 15 },
]

export default function Classify() {
    const { message } = App.useApp()

    const [repos, setRepos] = useState<GithubRepo[]>([])
    const [selectedIds, setSelectedIds] = useState<number[]>([])
    const [keyword, setKeyword] = useState('')
    const [language, setLanguage] = useState('')
    const [topN, setTopN] = useState(8)
    const [loading, setLoading] = useState(false)
    const [classifying, setClassifying] = useState(false)
    const [results, setResults] = useState<Record<string, GithubRepo[]>>({})
    const [uncategorizedIds, setUncategorizedIds] = useState<Set<number>>(new Set())
    const [showUncategorizedOnly, setShowUncategorizedOnly] = useState(false)

    const resultsRef = useRef<HTMLDivElement>(null)

    const fetchRepos = async () => {
        setLoading(true)
        try {
            const res = await classifyApi.fetchClassifyRepos()
            if (Array.isArray(res)) {
                setRepos(res)
            } else if (res && typeof res === 'object' && 'repos' in res && Array.isArray((res as Record<string, unknown>).repos)) {
                setRepos((res as Record<string, GithubRepo[]>).repos)
            } else {
                setRepos([])
            }
        } catch {
            message.error('获取仓库列表失败')
            setRepos([])
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchRepos()
        categoriesApi
            .fetchUncategorizedRepos()
            .then((repos) => {
                setUncategorizedIds(new Set(repos.map((r) => r.id)))
            })
            .catch(() => {})
    }, [])

    const languages = useMemo(() => {
        const set = new Set<string>()
        repos.forEach((r) => {
            if (r.language) set.add(r.language)
        })
        return Array.from(set).sort()
    }, [repos])

    const filteredRepos = useMemo(() => {
        let list = repos
        if (showUncategorizedOnly) {
            list = list.filter((r) => uncategorizedIds.has(r.id))
        }
        if (keyword) {
            const kw = keyword.toLowerCase()
            list = list.filter(
                (r) => r.fullName.toLowerCase().includes(kw) || (r.description !== null && r.description.toLowerCase().includes(kw)),
            )
        }
        if (language) {
            list = list.filter((r) => r.language === language)
        }
        return list
    }, [repos, keyword, language, showUncategorizedOnly, uncategorizedIds])

    const handleSelectAll = () => {
        setSelectedIds(filteredRepos.map((r) => r.id))
    }

    const handleClearSelection = () => {
        setSelectedIds([])
    }

    const handleSmartClassify = async () => {
        setClassifying(true)
        setResults({})
        try {
            const res = await categoriesApi.smartClassify()
            if (res.success) {
                message.success(
                    `智能分类完成！处理 ${res.totalProcessed || 0} 个项目，匹配现有分类 ${res.matchedExisting || 0} 个，新建 ${res.createdNew || 0} 个`,
                )
                fetchRepos()
            } else {
                message.info(res.message || '没有需要分类的仓库')
            }
        } catch {
            message.error('智能分类请求失败')
        } finally {
            setClassifying(false)
        }
    }

    const handleClassify = async () => {
        if (selectedIds.length === 0) return
        setClassifying(true)
        setResults({})
        try {
            const res = await classifyApi.executeClassify(selectedIds, topN)
            if (res.success && res.categories) {
                setResults(res.categories)
                message.success(`AI 分类完成，共 ${Object.keys(res.categories).length} 个分类`)
                setTimeout(() => {
                    resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }, 150)
            } else {
                message.error('AI 分类失败，请稍后重试')
            }
        } catch {
            message.error('AI 分类请求失败')
        } finally {
            setClassifying(false)
        }
    }

    const columns = [
        {
            title: '仓库名',
            dataIndex: 'fullName',
            key: 'fullName',
            width: 240,
            render: (_: string, record: GithubRepo) => (
                <a href={record.htmlUrl} target='_blank' rel='noopener noreferrer'>
                    <GithubOutlined style={{ marginRight: 6 }} />
                    {record.fullName}
                </a>
            ),
        },
        {
            title: '描述',
            dataIndex: 'description',
            key: 'description',
            ellipsis: true,
            render: (v: string | null) => {
                if (!v) return '-'
                return v.length > 80 ? v.slice(0, 80) + '...' : v
            },
        },
        {
            title: '语言',
            dataIndex: 'language',
            key: 'language',
            width: 120,
            render: (lang: string | null) => (lang ? <Tag color='blue'>{lang}</Tag> : <Tag color='default'>-</Tag>),
        },
        {
            title: 'Star数',
            dataIndex: 'starsCount',
            key: 'starsCount',
            width: 100,
            align: 'right' as const,
            render: (v: number) => {
                if (v >= 1000) return (v / 1000).toFixed(1) + 'K'
                return String(v)
            },
        },
    ]

    return (
        <div>
            <Title level={3} style={{ marginBottom: 24 }}>
                AI 智能分类
            </Title>

            <Card style={{ marginBottom: 16 }}>
                <Row gutter={[12, 12]} align='middle'>
                    <Col>
                        <Select
                            placeholder='选择语言'
                            allowClear
                            style={{ width: 150 }}
                            value={language || undefined}
                            onChange={setLanguage}
                            options={languages.map((l) => ({ label: l, value: l }))}
                        />
                    </Col>
                    <Col>
                        <Input.Search
                            placeholder='搜索仓库...'
                            allowClear
                            style={{ width: 250 }}
                            value={keyword}
                            onChange={(e) => setKeyword(e.target.value)}
                            onSearch={setKeyword}
                        />
                    </Col>
                    <Col>
                        <Button
                            type={showUncategorizedOnly ? 'primary' : 'default'}
                            icon={<FilterOutlined />}
                            onClick={() => {
                                setShowUncategorizedOnly(!showUncategorizedOnly)
                                if (!showUncategorizedOnly) {
                                    // 开启时自动全选未分类仓库
                                    const ids = repos.filter((r) => uncategorizedIds.has(r.id)).map((r) => r.id)
                                    setSelectedIds(ids)
                                }
                            }}
                        >
                            仅未分类 ({uncategorizedIds.size})
                        </Button>
                    </Col>
                    <Col>
                        <Button onClick={handleSelectAll}>全选</Button>
                    </Col>
                    <Col>
                        <Button onClick={handleClearSelection} icon={<ClearOutlined />}>
                            清除选择
                        </Button>
                    </Col>
                    <Col>
                        <Text type='secondary'>
                            已选 <Text strong>{selectedIds.length}</Text> 项
                        </Text>
                    </Col>
                    <Col>
                        <Select value={topN} onChange={setTopN} options={TOP_N_OPTIONS} style={{ width: 100 }} />
                    </Col>
                    <Col>
                        <Button type='primary' icon={<RobotOutlined />} disabled={selectedIds.length === 0} onClick={handleClassify}>
                            开始 AI 分类
                        </Button>
                    </Col>
                    <Col>
                        <Button icon={<RobotOutlined />} onClick={handleSmartClassify} loading={classifying}>
                            智能分类(匹配现有)
                        </Button>
                    </Col>
                </Row>
            </Card>

            <Card>
                <Table
                    rowSelection={{
                        selectedRowKeys: selectedIds,
                        onChange: (keys) => setSelectedIds(keys as number[]),
                    }}
                    columns={columns}
                    dataSource={filteredRepos}
                    rowKey='id'
                    loading={loading}
                    pagination={{
                        showSizeChanger: true,
                        showTotal: (total: number) => `共 ${total} 个仓库`,
                        pageSizeOptions: ['10', '20', '50', '100'],
                    }}
                    scroll={{ x: 700 }}
                    size='small'
                />
            </Card>

            {Object.keys(results).length > 0 && (
                <div ref={resultsRef} style={{ marginTop: 24 }}>
                    <Title level={4} style={{ marginBottom: 16 }}>
                        分类结果
                    </Title>
                    <Row gutter={[16, 16]}>
                        {Object.entries(results).map(([category, repoList]) => (
                            <Col xs={24} md={12} lg={8} key={category}>
                                <Card
                                    title={
                                        <Text strong style={{ fontSize: 15 }}>
                                            {category}
                                        </Text>
                                    }
                                    extra={<Tag>{repoList.length} 个仓库</Tag>}
                                    style={{ height: '100%' }}
                                >
                                    {repoList.map((r) => (
                                        <div key={r.id} style={{ padding: '4px 0' }}>
                                            <a href={r.htmlUrl} target='_blank' rel='noopener noreferrer' style={{ fontSize: 13 }}>
                                                {r.fullName}
                                            </a>
                                            {r.description && (
                                                <div style={{ color: '#888', fontSize: 12, marginTop: 2 }}>
                                                    {r.description.length > 60 ? r.description.slice(0, 60) + '...' : r.description}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </Card>
                            </Col>
                        ))}
                    </Row>
                </div>
            )}

            {classifying && (
                <div
                    style={{
                        position: 'fixed',
                        inset: 0,
                        background: 'rgba(0, 0, 0, 0.45)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 9999,
                    }}
                >
                    <Spin size='large' />
                    <div style={{ color: '#fff', fontSize: 16, marginTop: 16 }}>AI 正在分析仓库...</div>
                </div>
            )}
        </div>
    )
}
