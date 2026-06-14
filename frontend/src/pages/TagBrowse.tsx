import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
    Card, Tag, Typography, Button, Spin, Empty, Space, Modal,
    Input, Alert, message, Steps, Tooltip, Popconfirm, Divider,
} from 'antd'
import {
    TagsOutlined, ReloadOutlined,
    BulbOutlined, ThunderboltOutlined, SearchOutlined,
    LoadingOutlined, CheckCircleOutlined, ExclamationCircleOutlined,
    DeleteOutlined, ClearOutlined, PlayCircleOutlined,
} from '@ant-design/icons'
import api from '../api/request'
import * as tagsApi from '../api/tags'
import { fetchStarList } from '../api/stars'
import type { TagGroup } from '../api/tags'

const { Title, Text } = Typography

export default function TagBrowse() {
    const navigate = useNavigate()
    const [searchParams] = useSearchParams()
    const [groups, setGroups] = useState<TagGroup[]>([])
    const [loading, setLoading] = useState(true)

    // 标签搜索
    const [tagSearch, setTagSearch] = useState('')

    // Agent 自动标签 — Modal 配置参数（与执行分离）
    const [agentModalVisible, setAgentModalVisible] = useState(false)
    const [agentKeyword, setAgentKeyword] = useState(searchParams.get('keyword') || '')
    const [agentLanguage, setAgentLanguage] = useState(searchParams.get('language') || '')
    const [agentTagIds, setAgentTagIds] = useState(searchParams.get('tagIds') || '')

    // Agent 执行状态
    const [agentRunning, setAgentRunning] = useState(false)
    const [agentStatus, setAgentStatus] = useState('')
    const [agentThinking, setAgentThinking] = useState('')
    const [agentToolCalls, setAgentToolCalls] = useState<{ label: string; result?: string }[]>([])
    const [agentResult, setAgentResult] = useState('')
    const [agentError, setAgentError] = useState('')
    const [agentStep, setAgentStep] = useState(0)
    const [agentBatchProgress, setAgentBatchProgress] = useState('')
    const abortRef = useRef<(() => void) | null>(null)
    const thinkingEndRef = useRef<HTMLDivElement>(null)

    // 操作 loading
    const [deletingEmpty, setDeletingEmpty] = useState(false)
    const [deletingAll, setDeletingAll] = useState(false)

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

    // ── sessionStorage 持久化：Agent 状态变化时自动保存（不保存错误态）──
    useEffect(() => {
        if ((agentRunning || agentResult) && !agentError) {
            const state = {
                agentRunning, agentStatus, agentThinking, agentToolCalls,
                agentResult, agentStep, agentBatchProgress,
                agentKeyword, agentLanguage, agentTagIds,
                savedAt: Date.now(),
            }
            sessionStorage.setItem('agent_tag_state', JSON.stringify(state))
        }
    }, [agentRunning, agentStatus, agentThinking, agentToolCalls, agentResult, agentStep, agentBatchProgress, agentKeyword, agentLanguage, agentTagIds])

    // ── 页面加载时恢复状态 + 检查后台任务 ──
    useEffect(() => {
        // 1. 先尝试从 sessionStorage 恢复（5 分钟内有效）
        const saved = sessionStorage.getItem('agent_tag_state')
        if (saved) {
            try {
                const s = JSON.parse(saved)
                if (Date.now() - s.savedAt < 300000) {
                    setAgentRunning(s.agentRunning || false)
                    setAgentStatus(s.agentStatus || '')
                    setAgentThinking(s.agentThinking || '')
                    setAgentToolCalls(s.agentToolCalls || [])
                    setAgentResult(s.agentResult || '')
                    setAgentError(s.agentError || '')
                    setAgentStep(s.agentStep || 0)
                    setAgentBatchProgress(s.agentBatchProgress || '')
                    if (s.agentKeyword) setAgentKeyword(s.agentKeyword)
                    if (s.agentLanguage) setAgentLanguage(s.agentLanguage)
                    if (s.agentTagIds) setAgentTagIds(s.agentTagIds)
                }
            } catch { sessionStorage.removeItem('agent_tag_state') }
        }

        // 2. 检查后端是否还有运行中的任务
        api.get('/api/agent/tags/running')
            .then(({ data }: any) => {
                if (data?.tasks?.length > 0) {
                    const t = data.tasks[0]
                    setAgentRunning(true)
                    setAgentStatus(t.status || '后台分析中...')
                    setAgentStep(2)
                    message.info(`检测到后台分析任务运行中（已处理 ${t.processedCount}/${t.repoCount} 个仓库，点击「Agent 智能打标签」查看详情）`, 6)
                    // 保存到 sessionStorage
                    sessionStorage.setItem('agent_tag_state', JSON.stringify({
                        agentRunning: true, agentStatus: t.status,
                        agentStep: 2, savedAt: Date.now(),
                    }))
                } else if (saved) {
                    // 任务已完成，清除旧状态
                    sessionStorage.removeItem('agent_tag_state')
                }
            })
            .catch(() => {})
    }, []) // eslint-disable-line react-hooks/exhaustive-deps

    // 搜索过滤 + 按 repoCount 降序排序后的标签组
    const filteredGroups = useMemo(() => {
        const sortTags = (tags: typeof groups[0]['tags']) =>
            [...tags].sort((a, b) => b.repoCount - a.repoCount)
        if (!tagSearch.trim()) {
            return groups.map((g) => ({ ...g, tags: sortTags(g.tags) }))
        }
        const kw = tagSearch.toLowerCase()
        return groups
            .map((g) => {
                const filtered = g.tags.filter((t) => t.name.toLowerCase().includes(kw))
                return { ...g, tags: sortTags(filtered) }
            })
            .filter((g) => g.tags.length > 0)
    }, [groups, tagSearch])

    // 空标签数量
    const emptyTagCount = useMemo(() => {
        let count = 0
        for (const g of groups) {
            for (const t of g.tags) {
                if (t.repoCount === 0) count++
            }
        }
        return count
    }, [groups])

    // ======================== Agent: 打开配置弹窗（保留运行状态，清除错误态） ========================
    const handleOpenAgentModal = () => {
        // 错误态 → 重置为配置模式，允许重试
        if (agentError && !agentRunning) {
            setAgentError('')
            setAgentResult('')
            setAgentStep(0)
            setAgentStatus('')
            setAgentThinking('')
            setAgentToolCalls([])
            setAgentBatchProgress('')
            sessionStorage.removeItem('agent_tag_state')
        }
        setAgentModalVisible(true)
    }

    // ======================== Agent: 确认并开始执行 ========================
    const handleStartAgent = async () => {
        setAgentRunning(true)
        setAgentStep(0)
        setAgentStatus('正在获取仓库列表...')
        setAgentThinking('')
        setAgentToolCalls([])
        setAgentResult('')
        setAgentError('')
        setAgentBatchProgress('')

        // 收集仓库：无筛选条件 → 全部仓库；有筛选条件 → 按条件过滤（不分页，取全部匹配）
        const hasFilter = !!(agentKeyword || agentLanguage || agentTagIds)
        let repoIds: number[] = []
        try {
            if (hasFilter) {
                // 按筛选条件取匹配仓库（最多 2000，实际够用）
                const result = await fetchStarList({
                    page: 1,
                    size: 2000,
                    keyword: agentKeyword || undefined,
                    language: agentLanguage || undefined,
                    tagIds: agentTagIds || undefined,
                })
                repoIds = result.records.map((r) => Number(r.id))
            } else {
                // 无筛选 → 获取全部仓库
                let page = 1
                const allIds: number[] = []
                while (true) {
                    const result = await fetchStarList({ page, size: 500 })
                    allIds.push(...result.records.map((r) => Number(r.id)))
                    if (allIds.length >= result.total) break
                    page++
                }
                repoIds = allIds
            }
            setAgentStep(1)
            setAgentStatus(`已获取 ${repoIds.length} 个仓库，分批处理中...`)
        } catch {
            setAgentError('获取仓库列表失败')
            setAgentRunning(false)
            return
        }

        if (!repoIds.length) {
            setAgentError('没有可分析的仓库，请调整筛选条件')
            setAgentRunning(false)
            return
        }

        abortRef.current?.()
        const abort = tagsApi.startAgentAutoTag(repoIds, {
            onStatus: (msg) => {
                setAgentStatus(msg)
                // 更新步骤指示器
                if (msg.includes('已加载')) setAgentStep(1)
                else if (msg.includes('启动并发分析') || msg.includes('并发处理')) setAgentStep(2)
                else if (msg.includes('第 ') && msg.includes(' 批')) setAgentStep(3)
                else if (msg.includes('全部完成')) setAgentStep(4)
                // 批次进度
                if (msg.startsWith('━━━') || msg.startsWith('✅ 第') || msg.startsWith('⚠️ 第')) {
                    setAgentBatchProgress((p) => p + msg + '\n')
                }
            },
            onThinking: (content) => {
                setAgentThinking((p) => p + content)
                // 自动滚动到底部
                setTimeout(() => {
                    thinkingEndRef.current?.scrollIntoView({ behavior: 'smooth' })
                }, 50)
            },
            onToolCall: (name, input) => {
                const label = name === 'get_repo_details'
                    ? `📋 get_repo_details(${(input as any)?.repoIds?.length || '?'} 个仓库)`
                    : name === 'search_tags'
                    ? `🔍 search_tags("${(input as any)?.keyword || ''}")`
                    : `⛔ ${name}（已拦截）`
                setAgentToolCalls((p) => [...p, { label }])
                setAgentStatus(label)
            },
            onToolResult: (content) => {
                // 将工具返回内容关联到最后一次调用
                setAgentToolCalls((p) => {
                    const updated = [...p]
                    if (updated.length > 0) {
                        const last = { ...updated[updated.length - 1], result: content }
                        updated[updated.length - 1] = last
                    }
                    return updated
                })
            },
            onResult: (msg) => {
                setAgentStep(4)
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

    // ======================== 标签操作 ========================

    const handleDeleteTag = async (tagId: number, tagName: string) => {
        try {
            const res = await tagsApi.deleteTag(tagId)
            if (res.success) {
                message.success(`已删除标签「${tagName}」`)
                load()
            } else {
                message.error(res.message || '删除失败')
            }
        } catch {
            message.error('删除失败')
        }
    }

    const handleDeleteEmpty = async () => {
        setDeletingEmpty(true)
        try {
            const res = await tagsApi.deleteEmptyTags()
            if (res.success) {
                message.success(res.message || `已删除 ${res.deleted} 个空标签`)
                load()
            } else {
                message.error(res.message || '操作失败')
            }
        } catch {
            message.error('操作失败')
        } finally {
            setDeletingEmpty(false)
        }
    }

    const handleDeleteAll = async () => {
        setDeletingAll(true)
        try {
            const res = await tagsApi.deleteAllTags()
            if (res.success) {
                message.success(res.message || `已清空 ${res.deleted} 个标签`)
                load()
            } else {
                message.error(res.message || '操作失败')
            }
        } catch {
            message.error('操作失败')
        } finally {
            setDeletingAll(false)
        }
    }

    // ======================== 渲染 ========================

    return (
        <div>
            {/* ── Agent 后台运行状态条（Modal 关闭时可见）── */}
            {agentRunning && !agentModalVisible && (
                <Alert
                    type='info'
                    showIcon
                    icon={<LoadingOutlined spin style={{ color: '#1677ff' }} />}
                    message={
                        <Space>
                            <span>Agent 正在后台分析标签...</span>
                            <Text type='secondary' style={{ fontSize: 12 }}>{agentStatus}</Text>
                            <Button size='small' type='link' onClick={handleOpenAgentModal}>
                                查看详情
                            </Button>
                        </Space>
                    }
                    style={{ marginBottom: 16 }}
                />
            )}

            {/* ── 顶部操作栏 ── */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
                <Title level={3} style={{ margin: 0 }}>
                    <TagsOutlined style={{ marginRight: 8 }} />
                    标签管理
                </Title>
                <Space wrap>
                    {/* 搜索标签 */}
                    <Input
                        placeholder='搜索标签...'
                        prefix={<SearchOutlined />}
                        value={tagSearch}
                        onChange={(e) => setTagSearch(e.target.value)}
                        allowClear
                        style={{ width: 200 }}
                    />
                    {emptyTagCount > 0 && (
                        <Button
                            icon={<ClearOutlined />}
                            onClick={handleDeleteEmpty}
                            loading={deletingEmpty}
                            danger
                        >
                            清除空标签 ({emptyTagCount})
                        </Button>
                    )}
                    <Popconfirm
                        title='确认重置'
                        description='将删除全部标签及仓库关联，确定重置？'
                        onConfirm={handleDeleteAll}
                        okText='确认重置'
                        okType='danger'
                        cancelText='取消'
                    >
                        <Button
                            icon={<DeleteOutlined />}
                            loading={deletingAll}
                            danger
                        >
                            重置全部标签
                        </Button>
                    </Popconfirm>
                    <Button icon={<ThunderboltOutlined />} type='primary' onClick={handleOpenAgentModal}>
                        🤖 Agent 智能打标签
                    </Button>
                    <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>
                        刷新
                    </Button>
                </Space>
            </div>

            {/* ── 标签列表 ── */}
            <Spin spinning={loading}>
                {filteredGroups.length === 0 && !loading ? (
                    <Empty
                        description={tagSearch ? `未找到匹配「${tagSearch}」的标签` : '暂无标签数据，点击「Agent 智能打标签」开始分析'}
                        style={{ marginTop: 80 }}
                    >
                        {!tagSearch && (
                            <Button type='primary' icon={<ThunderboltOutlined />} onClick={handleOpenAgentModal}>
                                🤖 Agent 智能打标签
                            </Button>
                        )}
                    </Empty>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                        {filteredGroups.map((group) => (
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
                                        <Text type='secondary' style={{ fontSize: 12 }}>
                                            {group.tags.length} 个标签
                                        </Text>
                                    </Space>
                                }
                                styles={{ body: { padding: '12px 16px' } }}
                            >
                                {group.tags.length > 0 ? (
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                                        {group.tags.map((tag) => (
                                            <Tooltip
                                                title={tag.repoCount > 0 ? `查看 ${tag.repoCount} 个仓库` : '暂无仓库使用此标签'}
                                                key={tag.id}
                                            >
                                                <Tag
                                                    color={tag.repoCount > 0 ? (tag.color || group.color) : '#d9d9d9'}
                                                    style={{
                                                        fontSize: 13,
                                                        padding: '2px 10px',
                                                        cursor: tag.repoCount > 0 ? 'pointer' : 'default',
                                                        borderRadius: 12,
                                                        opacity: tag.repoCount > 0 ? 1 : 0.5,
                                                    }}
                                                    onClick={() => tag.repoCount > 0 && navigate(`/?tagIds=${tag.id}`)}
                                                    closable
                                                    onClose={(e) => {
                                                        e.preventDefault()
                                                        handleDeleteTag(tag.id, tag.name)
                                                    }}
                                                    closeIcon={
                                                        <Popconfirm
                                                            title={`删除标签「${tag.name}」？`}
                                                            description={tag.repoCount > 0 ? `该标签下有 ${tag.repoCount} 个仓库，删除后仓库将失去此标签` : '此标签暂无仓库使用'}
                                                            onConfirm={() => handleDeleteTag(tag.id, tag.name)}
                                                            okText='删除'
                                                            okType='danger'
                                                            cancelText='取消'
                                                        >
                                                            <DeleteOutlined style={{ fontSize: 10 }} />
                                                        </Popconfirm>
                                                    }
                                                >
                                                    {tag.name}
                                                    <span style={{ marginLeft: 4, opacity: 0.7, fontSize: 11 }}>
                                                        {tag.repoCount}
                                                    </span>
                                                </Tag>
                                            </Tooltip>
                                        ))}
                                    </div>
                                ) : (
                                    <Text type='secondary' style={{ fontSize: 13 }}>暂无标签</Text>
                                )}
                            </Card>
                        ))}
                    </div>
                )}
            </Spin>

            {/* ── Agent 配置弹窗（参数设置 + 执行进度合并展示）── */}
            <Modal
                title={
                    <Space>
                        <BulbOutlined style={{ color: '#faad14' }} />
                        🤖 Agent 智能打标签
                    </Space>
                }
                open={agentModalVisible}
                onCancel={() => {
                    // 关闭弹窗但不断开 SSE 连接，Agent 继续后台运行
                    setAgentModalVisible(false)
                }}
                footer={
                    <Space>
                        {agentRunning && (
                            <Button danger onClick={() => { abortRef.current?.(); setAgentRunning(false); setAgentStatus('已中止'); }}>
                                🛑 中止分析
                            </Button>
                        )}
                        {agentError && !agentRunning && (
                            <Button type='primary' onClick={() => { setAgentError(''); setAgentResult(''); handleOpenAgentModal(); }}>
                                重试
                            </Button>
                        )}
                        <Button type='primary' onClick={() => setAgentModalVisible(false)}>
                            {agentRunning ? '收起窗口（后台继续）' : '关闭'}
                        </Button>
                    </Space>
                }
                width={800}
                style={{ top: 20 }}
                destroyOnClose
            >
                {/* ── 参数配置区（执行前显示，执行中也显示但禁用）── */}
                <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                    <div style={{ flex: 1 }}>
                        <Text strong>关键词（可选）</Text>
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
                        <Text strong>语言（可选）</Text>
                        <Input
                            placeholder='如 Python,Java'
                            value={agentLanguage}
                            onChange={(e) => setAgentLanguage(e.target.value)}
                            disabled={agentRunning}
                            style={{ marginTop: 4 }}
                            allowClear
                        />
                    </div>
                    <div style={{ flex: 1 }}>
                        <Text strong>标签ID（可选，逗号分隔）</Text>
                        <Input
                            placeholder='如 1,5,12'
                            value={agentTagIds}
                            onChange={(e) => setAgentTagIds(e.target.value)}
                            disabled={agentRunning}
                            style={{ marginTop: 4 }}
                            allowClear
                        />
                    </div>
                </div>

                {!agentRunning && !agentResult && !agentError && (
                    <>
                        {agentKeyword || agentLanguage || agentTagIds ? (
                            <Alert type='info' showIcon message='将仅分析符合筛选条件的全部仓库' style={{ marginBottom: 12 }} />
                        ) : (
                            <Alert type='info' showIcon message='未设筛选条件，将分析全部仓库（按 Star 数降序分批处理）' style={{ marginBottom: 12 }} />
                        )}
                        <div style={{ textAlign: 'center', padding: '20px 0 8px' }}>
                            <Button
                                type='primary'
                                size='large'
                                icon={<PlayCircleOutlined />}
                                onClick={handleStartAgent}
                                style={{ minWidth: 200 }}
                            >
                                开始分析
                            </Button>
                        </div>
                    </>
                )}

                {/* ── 执行进度区 ── */}
                {agentRunning && (
                    <Steps
                        current={agentStep}
                        size='small'
                        status={agentStep === -1 ? 'error' : 'process'}
                        style={{ marginBottom: 16 }}
                        items={[
                            { title: '获取仓库列表' },
                            { title: '加载标签体系' },
                            { title: 'Agent 分析打标' },
                            { title: '保存结果' },
                        ]}
                    />
                )}

                {agentError && (
                    <Alert type='error' showIcon icon={<ExclamationCircleOutlined />} message='分析失败' description={agentError} style={{ marginBottom: 12 }} />
                )}

                {agentResult && (
                    <Alert type='success' showIcon icon={<CheckCircleOutlined />} message='分析完成' description={agentResult} style={{ marginBottom: 12 }} />
                )}

                {/* Agent 状态卡片 */}
                {(agentRunning || agentStatus) && !agentError && !agentResult && (
                    <Card size='small' style={{ marginBottom: 12, background: '#f6ffed', borderColor: '#b7eb8f' }}>
                        <Space>
                            {agentRunning && <LoadingOutlined spin style={{ color: '#1677ff' }} />}
                            <Text>{agentStatus}</Text>
                        </Space>
                    </Card>
                )}

                {/* 批次进度汇总 */}
                {agentBatchProgress && (
                    <Card size='small' title='📊 批次进度' style={{ marginBottom: 12, background: '#fffbe6', borderColor: '#ffe58f' }}>
                        <div style={{ maxHeight: 120, overflow: 'auto', whiteSpace: 'pre-wrap', fontSize: 12, fontFamily: 'monospace' }}>
                            {agentBatchProgress}
                        </div>
                    </Card>
                )}

                {/* 工具调用记录（含返回结果） */}
                {agentToolCalls.length > 0 && (
                    <Card size='small' title={`🔧 工具调用 (${agentToolCalls.length} 次)`} style={{ marginBottom: 12 }}>
                        <div style={{ maxHeight: 250, overflow: 'auto' }}>
                            {agentToolCalls.map((tc, i) => (
                                <div key={i} style={{ marginBottom: 8, borderBottom: '1px solid #f0f0f0', paddingBottom: 6 }}>
                                    <div style={{ fontSize: 12, fontWeight: 600, color: '#1677ff' }}>
                                        {tc.label}
                                    </div>
                                    {tc.result && (
                                        <div style={{
                                            fontSize: 11,
                                            color: '#666',
                                            marginTop: 4,
                                            padding: '4px 8px',
                                            background: '#fafafa',
                                            borderRadius: 4,
                                            whiteSpace: 'pre-wrap',
                                            maxHeight: 80,
                                            overflow: 'auto',
                                        }}>
                                            {tc.result}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </Card>
                )}

                {/* Agent 思考过程 */}
                {agentThinking && (
                    <Card size='small' title='💭 Agent 思考过程' style={{ marginBottom: 12 }}>
                        <div
                            style={{ maxHeight: 350, overflow: 'auto', whiteSpace: 'pre-wrap', fontSize: 13, color: '#555', lineHeight: 1.6 }}
                        >
                            {agentThinking}
                            <div ref={thinkingEndRef} />
                        </div>
                    </Card>
                )}
            </Modal>
        </div>
    )
}
