import { useState, useEffect, useCallback, useRef } from 'react'
import {
    Card, Tag, Typography, Button, Spin, Empty, Space, Modal,
    Input, Alert, message,
} from 'antd'
import {
    TagsOutlined, ReloadOutlined,
    BulbOutlined, ThunderboltOutlined,
} from '@ant-design/icons'
import * as tagsApi from '../api/tags'
import type { TagGroup } from '../api/tags'

const { Title, Text } = Typography

export default function TagBrowse() {
    const [groups, setGroups] = useState<TagGroup[]>([])
    const [loading, setLoading] = useState(true)

    // Agent 自动标签状态
    const [agentModalVisible, setAgentModalVisible] = useState(false)
    const [agentStatus, setAgentStatus] = useState('')
    const [agentThinking, setAgentThinking] = useState('')
    const [agentResult, setAgentResult] = useState('')
    const [agentError, setAgentError] = useState('')
    const [agentRunning, setAgentRunning] = useState(false)
    const [agentRepoCount, setAgentRepoCount] = useState(30)
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
        setAgentStatus('正在准备 Agent 分析环境...')
        setAgentThinking('')
        setAgentResult('')
        setAgentError('')
        setAgentRunning(true)

        abortRef.current?.()
        const abort = tagsApi.startAgentAutoTag(
            Array.from({ length: agentRepoCount }, (_, i) => i + 1), // 使用前 N 个仓库做演示
            {
            onStatus: (msg) => setAgentStatus(msg),
            onThinking: (content) => setAgentThinking((p) => p + content),
            onToolCall: (name) => setAgentStatus(`Agent 正在使用 ${name} 工具...`),
            onResult: (msg) => {
                setAgentResult(msg)
                setAgentRunning(false)
                load()
            },
            onError: (msg) => {
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
                                            <Tag
                                                key={tag.id}
                                                color={tag.color || group.color}
                                                style={{
                                                    fontSize: 13,
                                                    padding: '2px 10px',
                                                    cursor: 'pointer',
                                                    borderRadius: 12,
                                                }}
                                            >
                                                {tag.name}
                                                <span style={{ marginLeft: 4, opacity: 0.7, fontSize: 11 }}>
                                                    {tag.repoCount}
                                                </span>
                                            </Tag>
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
                <div style={{ marginBottom: 16 }}>
                    <Text>分析仓库数量</Text>
                    <Input
                        type='number'
                        value={agentRepoCount}
                        onChange={(e) => setAgentRepoCount(Number(e.target.value))}
                        min={5}
                        max={200}
                        disabled={agentRunning}
                        style={{ marginTop: 8 }}
                        addonAfter='个'
                    />
                </div>

                {agentStatus && (
                    <Alert type='info' showIcon message={agentStatus} style={{ marginBottom: 12 }} />
                )}

                {agentThinking && (
                    <Card size='small' title='💭 Agent 思考过程' style={{ marginBottom: 12 }}>
                        <div style={{ maxHeight: 300, overflow: 'auto', whiteSpace: 'pre-wrap', fontSize: 13, color: '#555' }}>
                            {agentThinking}
                        </div>
                    </Card>
                )}

                {agentResult && (
                    <Alert type='success' showIcon message='' description={agentResult} />
                )}

                {agentError && (
                    <Alert type='error' showIcon message='分析失败' description={agentError} />
                )}
            </Modal>
        </div>
    )
}
