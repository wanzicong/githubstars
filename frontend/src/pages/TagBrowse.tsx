import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
    Card, Tag, Typography, Button, Spin, Empty, Space, Modal,
    InputNumber, Input, Alert, message, Steps, Tooltip,
} from 'antd'
import {
    TagsOutlined, ReloadOutlined,
    BulbOutlined, ThunderboltOutlined,
    LoadingOutlined, CheckCircleOutlined, ExclamationCircleOutlined,
} from '@ant-design/icons'
import * as tagsApi from '../api/tags'
import { fetchStarList } from '../api/stars'
import type { TagGroup } from '../api/tags'

const { Title, Text } = Typography

export default function TagBrowse() {
    const navigate = useNavigate()
    const [searchParams] = useSearchParams()
    const [groups, setGroups] = useState<TagGroup[]>([])
    const [loading, setLoading] = useState(true)

    // Agent 自动标签状态
    const [agentModalVisible, setAgentModalVisible] = useState(false)
    const [agentStatus, setAgentStatus] = useState('')
    const [agentThinking, setAgentThinking] = useState('')
    const [agentToolCalls, setAgentToolCalls] = useState<string[]>([])
    const [agentResult, setAgentResult] = useState('')
    const [agentError, setAgentError] = useState('')
    const [agentRunning, setAgentRunning] = useState(false)
    const [agentRepoCount, setAgentRepoCount] = useState(50)
    const [agentKeyword, setAgentKeyword] = useState(searchParams.get('keyword') || '')
    const [agentLanguage, setAgentLanguage] = useState(searchParams.get('language') || '')
    const [agentStep, setAgentStep] = useState(0)
    const abortRef = useRef<(() => void) | null>(null)

    const load = useCallback(async () => {
        setLoading(true)
        try {
            const res = await tagsApi.fetchAllTags()
            setGroups(res)
        } catch {
            message.error('加载标签失败')
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { load() }, [load])

    const handleAgentAutoTag = async () => {
        setAgentModalVisible(true)
        setAgentStep(0)
        setAgentStatus('正在获取仓库列表...')
        setAgentThinking('')
        setAgentToolCalls([])
        setAgentResult('')
        setAgentError('')
        setAgentRunning(true)

        // 第一步：按筛选条件获取仓库 ID
        let repoIds: number[] = []
        try {
            const result = await fetchStarList({
                page: 1,
                size: Math.min(agentRepoCount, 500),
                keyword: agentKeyword || undefined,
                language: agentLanguage || undefined,
            })
            repoIds = result.records.map((r) => Number(r.id))
            setAgentStep(1)
            setAgentStatus(`已获取 ${repoIds.length} 个仓库，分批处理中...`)
        } catch {
            setAgentError('获取仓库列表失败')
            setAgentRunning(false)
            return
        }

        if (!repoIds.length) {
            setAgentError('没有可分析的仓库')
            setAgentRunning(false)
            return
        }

        abortRef.current?.()
        const abort = tagsApi.startAgentAutoTag(repoIds, {
            onStatus: (msg) => {
                setAgentStatus(msg)
                if (msg.includes('分析完成')) setAgentStep(3)
                else if (msg.includes('Agent 正在分析') || msg.includes('搜索')) setAgentStep(2)
            },
            onThinking: (content) => setAgentThinking((p) => p + content),
            onToolCall: (name, input) => {
                const label = name === 'WebSearch' ? `🌐 搜索: ${(input as any)?.query || ''}` :
                              name === 'WebFetch' ? `📄 读取: ${(input as any)?.url || ''}` :
                              name === 'search_tags' ? '🔍 查标签' : `🔧 ${name}`
                setAgentToolCalls((p) => [...p, label])
                setAgentStatus(`${label}`)
            },
            onResult: (msg) => {
                setAgentStep(4)
                setAgentResult(msg)
                setAgentRunning(false)
                load()
            },
            onError: (msg) => {
                setAgentStep(-1)
                setAgentError(msg)
                setAgentRunning(false)
            },
            onDone: () => setAgentRunning(false),
        })
        abortRef.current = abort
    }

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
                <Title level={3} style={{ margin: 0 }}>
                    <TagsOutlined style={{ marginRight: 8 }} />
                    标签管理
                </Title>
                <Space>
                    <Button icon={<ThunderboltOutlined />} type='primary' onClick={handleAgentAutoTag} loading={agentRunning}>
                        🤖 Agent 智能打标签
                    </Button>
                    <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>
                        刷新
                    </Button>
                </Space>
            </div>

            <Spin spinning={loading}>
                {groups.length === 0 && !loading ? (
                    <Empty description='暂无标签数据' style={{ marginTop: 80 }} />
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                        {groups.map((group) => (
                            <Card
                                key={group.id}
                                size='small'
                                title={
                                    <Space>
                                        <span style={{ fontSize: 16 }}>{group.icon || '📌'}</span>
                                        <Text strong style={{ fontSize: 15 }}>{group.name}</Text>
                                        <Tag color={group.isSystem ? 'blue' : 'default'} style={{ fontSize: 11 }}>
                                            {group.isSystem ? '系统' : '自定义'}
                                        </Tag>
                                    </Space>
                                }
                                styles={{ body: { padding: '12px 16px' } }}
                            >
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                    {group.tags.length > 0 ? (
                                        group.tags.map((tag) => (
                                            <Tooltip title={`查看 ${tag.repoCount} 个仓库`} key={tag.id}>
                                                <Tag
                                                    color={tag.color || group.color}
                                                    style={{
                                                        fontSize: 13,
                                                        padding: '2px 10px',
                                                        cursor: 'pointer',
                                                        borderRadius: 12,
                                                    }}
                                                    onClick={() => tag.repoCount > 0 && navigate(`/?tagIds=${tag.id}`)}
                                                >
                                                    {tag.name}
                                                    <span style={{ marginLeft: 4, opacity: 0.7, fontSize: 11 }}>
                                                        {tag.repoCount}
                                                    </span>
                                                </Tag>
                                            </Tooltip>
                                        ))
                                    ) : (
                                        <Text type='secondary' style={{ fontSize: 13 }}>暂无标签</Text>
                                    )}
                                </div>
                            </Card>
                        ))}
                    </div>
                )}
            </Spin>

            {/* Agent 自动标签弹窗 */}
            <Modal
                title={
                    <Space>
                        <BulbOutlined style={{ color: '#faad14' }} />
                        🤖 Agent 智能打标签
                    </Space>
                }
                open={agentModalVisible}
                onCancel={() => {
                    abortRef.current?.()
                    setAgentModalVisible(false)
                }}
                footer={
                    <Space>
                        {agentRunning && (
                            <Button danger onClick={() => { abortRef.current?.(); setAgentRunning(false) }}>
                                中止
                            </Button>
                        )}
                        <Button type='primary' onClick={() => setAgentModalVisible(false)}>
                            关闭
                        </Button>
                    </Space>
                }
                width={800}
                style={{ top: 20 }}
            >
                <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                    <div style={{ flex: 1 }}>
                        <Text>数量</Text>
                        <InputNumber
                            value={agentRepoCount}
                            onChange={(v) => setAgentRepoCount(v ?? 50)}
                            min={5}
                            max={500}
                            disabled={agentRunning}
                            style={{ width: '100%', marginTop: 4 }}
                            addonAfter='个'
                        />
                    </div>
                    <div style={{ flex: 1 }}>
                        <Text>关键词（可选）</Text>
                        <Input
                            placeholder='筛选仓库名/描述'
                            value={agentKeyword}
                            onChange={(e) => setAgentKeyword(e.target.value)}
                            disabled={agentRunning}
                            style={{ marginTop: 4 }}
                            allowClear
                        />
                    </div>
                    <div style={{ flex: 1 }}>
                        <Text>语言（可选）</Text>
                        <Input
                            placeholder='如 Python,Java'
                            value={agentLanguage}
                            onChange={(e) => setAgentLanguage(e.target.value)}
                            disabled={agentRunning}
                            style={{ marginTop: 4 }}
                            allowClear
                        />
                    </div>
                </div>
                {agentKeyword || agentLanguage ? (
                    <Alert type='info' showIcon message='将仅分析符合筛选条件的仓库' style={{ marginBottom: 12 }} />
                ) : (
                    <Alert type='info' showIcon message='将按 Star 数降序分析前 N 个仓库' style={{ marginBottom: 12 }} />
                )}

                {/* 步骤指示器 */}
                {agentRunning && (
                    <Steps
                        current={agentStep}
                        size='small'
                        status={agentStep === -1 ? 'error' : 'process'}
                        style={{ marginBottom: 16 }}
                        items={[
                            { title: '获取仓库' },
                            { title: 'Agent 分析' },
                            { title: '搜索了解' },
                            { title: '保存标签' },
                        ]}
                    />
                )}

                {agentError && (
                    <Alert type='error' showIcon icon={<ExclamationCircleOutlined />} message='分析失败' description={agentError} style={{ marginBottom: 12 }} />
                )}

                {agentResult && (
                    <Alert type='success' showIcon icon={<CheckCircleOutlined />} message='标签完成' description={agentResult} style={{ marginBottom: 12 }} />
                )}

                {/* Agent 工作状态 */}
                {(agentRunning || agentStatus) && !agentError && !agentResult && (
                    <Card size='small' style={{ marginBottom: 12, background: '#f6ffed', borderColor: '#b7eb8f' }}>
                        <Space>
                            {agentRunning && <LoadingOutlined spin style={{ color: '#1677ff' }} />}
                            <Text>{agentStatus}</Text>
                        </Space>
                    </Card>
                )}

                {/* 工具调用日志 */}
                {agentToolCalls.length > 0 && (
                    <Card size='small' title='🔧 工具调用记录' style={{ marginBottom: 12 }}>
                        <div style={{ maxHeight: 150, overflow: 'auto' }}>
                            {agentToolCalls.map((tc, i) => (
                                <div key={i} style={{ fontSize: 12, color: '#666', padding: '2px 0' }}>
                                    {tc}
                                </div>
                            ))}
                        </div>
                    </Card>
                )}

                {/* Agent 思考过程 */}
                {agentThinking && (
                    <Card size='small' title='💭 Agent 思考过程' style={{ marginBottom: 12 }}>
                        <div style={{ maxHeight: 250, overflow: 'auto', whiteSpace: 'pre-wrap', fontSize: 13, color: '#555', lineHeight: 1.6 }}>
                            {agentThinking}
                        </div>
                    </Card>
                )}
            </Modal>
        </div>
    )
}
