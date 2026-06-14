import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
    Card, Tag, Typography, Button, Spin, Empty, Space, Modal,
    Input, Alert, message, Steps, Tooltip, Popconfirm, Divider,
    Segmented, Select as AntSelect, Drawer, Progress,
} from 'antd'
import {
    TagsOutlined, ReloadOutlined,
    BulbOutlined, ThunderboltOutlined, SearchOutlined,
    LoadingOutlined, CheckCircleOutlined, ExclamationCircleOutlined,
    DeleteOutlined, ClearOutlined, PlayCircleOutlined,
    ApartmentOutlined, UnorderedListOutlined, LinkOutlined,
    CaretRightOutlined, CaretDownOutlined,
    BarChartOutlined, NodeIndexOutlined,
} from '@ant-design/icons'
import api from '../api/request'
import * as tagsApi from '../api/tags'
import { setTagParent, setGroupParent, fetchTagDistribution } from '../api/tags'
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

    // 树形/列表切换
    const [viewMode, setViewMode] = useState<'flat' | 'tree'>('flat')

    // 设置父标签 Modal
    const [parentModalVisible, setParentModalVisible] = useState(false)
    const [parentModalTag, setParentModalTag] = useState<any>(null)
    const [parentModalGroup, setParentModalGroup] = useState<any>(null)
    const [selectedParentId, setSelectedParentId] = useState<number | null | undefined>(undefined)
    const [settingParent, setSettingParent] = useState(false)

    // 设置维度父级 Modal
    const [groupParentModalVisible, setGroupParentModalVisible] = useState(false)
    const [groupParentModalGroup, setGroupParentModalGroup] = useState<any>(null)
    const [selectedGroupParentId, setSelectedGroupParentId] = useState<number | null | undefined>(undefined)
    const [settingGroupParent, setSettingGroupParent] = useState(false)

    // 标签下钻抽屉
    const [drillDrawerVisible, setDrillDrawerVisible] = useState(false)
    const [drillTag, setDrillTag] = useState<any>(null)
    const [drillLoading, setDrillLoading] = useState(false)
    const [drillData, setDrillData] = useState<{
        totalRepos: number
        distributions: Array<{
            groupId: number; groupName: string; groupColor: string; groupIcon: string | null;
            tags: Array<{ tagId: number; tagName: string; tagColor: string | null; count: number; percentage: number }>
        }>
    } | null>(null)

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

    // ── 标签树构建工具函数 ──
    const buildTagTree = (tags: any[]) => {
        const map = new Map<number, any>()
        const roots: any[] = []
        for (const t of tags) {
            map.set(t.id, { ...t, children: [] })
        }
        for (const t of map.values()) {
            if (t.parentId && map.has(t.parentId)) {
                map.get(t.parentId)!.children.push(t)
            } else {
                roots.push(t)
            }
        }
        // Sort children by repoCount desc
        for (const t of map.values()) {
            t.children.sort((a: any, b: any) => b.repoCount - a.repoCount)
        }
        return roots.sort((a: any, b: any) => b.repoCount - a.repoCount)
    }

    /** 将树结构扁平化，附带深度信息，用于渲染 */
    const flattenTree = (nodes: any[], depth: number = 0): any[] => {
        const result: any[] = []
        for (const node of nodes) {
            const { children, ...rest } = node
            result.push({ ...rest, _depth: depth, _hasChildren: (children || []).length > 0 })
            if (children && children.length > 0) {
                result.push(...flattenTree(children, depth + 1))
            }
        }
        return result
    }

    // 树形模式下的标签数据
    const filteredTreeGroups = useMemo(() => {
        if (viewMode !== 'tree') return null
        return filteredGroups.map((g) => ({
            ...g,
            tags: flattenTree(buildTagTree(g.tags)),
        }))
    }, [filteredGroups, viewMode])

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

    // ======================== 父标签设置 ========================

    const openParentModal = (tag: any, group: any) => {
        setParentModalTag(tag)
        setParentModalGroup(group)
        setSelectedParentId(tag.parentId || null)
        setParentModalVisible(true)
    }

    const handleSetParent = async () => {
        if (!parentModalTag || selectedParentId === undefined) return
        // selectedParentId === null means "remove parent"
        // selectedParentId === parentModalTag.parentId means no change
        if (selectedParentId === (parentModalTag.parentId || null) && selectedParentId !== undefined) {
            setParentModalVisible(false)
            return
        }
        setSettingParent(true)
        try {
            const res = await setTagParent(parentModalTag.id, selectedParentId as number | null)
            if (res.success) {
                message.success(selectedParentId === null ? '已解除父级关联' : '父标签设置成功')
                setParentModalVisible(false)
                load()
            } else {
                message.error(res.message || '设置失败')
            }
        } catch {
            message.error('设置失败')
        } finally {
            setSettingParent(false)
        }
    }

    // ======================== 维度父级设置 ========================
    const openGroupParentModal = (group: any) => {
        setGroupParentModalGroup(group)
        setSelectedGroupParentId(group.parentId || null)
        setGroupParentModalVisible(true)
    }

    const handleSetGroupParent = async () => {
        if (!groupParentModalGroup || selectedGroupParentId === undefined) return
        if (selectedGroupParentId === (groupParentModalGroup.parentId || null)) {
            setGroupParentModalVisible(false)
            return
        }
        setSettingGroupParent(true)
        try {
            const res = await setGroupParent(groupParentModalGroup.id, selectedGroupParentId as number | null)
            if (res.success) {
                message.success(selectedGroupParentId === null ? '已解除维度父级' : '维度父级设置成功')
                setGroupParentModalVisible(false)
                load()
            } else {
                message.error(res.message || '设置失败')
            }
        } catch {
            message.error('设置失败')
        } finally {
            setSettingGroupParent(false)
        }
    }

    // ======================== 标签下钻 ========================
    const openDrillDrawer = async (tag: any) => {
        setDrillTag(tag)
        setDrillDrawerVisible(true)
        setDrillLoading(true)
        setDrillData(null)
        try {
            const data = await fetchTagDistribution(tag.id)
            setDrillData(data)
        } catch {
            message.error('加载下钻数据失败')
        } finally {
            setDrillLoading(false)
        }
    }

    // ======================== 标签下钻展开（懒加载子维度标签分布） ========================
    const [drillExpandedTags, setDrillExpandedTags] = useState<Set<number>>(new Set())
    const [drillTagData, setDrillTagData] = useState<Map<number, any>>(new Map())
    const [drillTagLoading, setDrillTagLoading] = useState<Set<number>>(new Set())

    const toggleDrillExpand = async (tag: any, group: any) => {
        const tid = tag.id
        if (drillExpandedTags.has(tid)) {
            // 收起
            setDrillExpandedTags(prev => { const s = new Set(prev); s.delete(tid); return s })
            return
        }
        // 展开（如果已有数据则直接展开）
        if (drillTagData.has(tid)) {
            setDrillExpandedTags(prev => new Set(prev).add(tid))
            return
        }
        // 懒加载
        setDrillTagLoading(prev => new Set(prev).add(tid))
        setDrillExpandedTags(prev => new Set(prev).add(tid))
        try {
            const dist = await fetchTagDistribution(tid)
            if (dist && dist.distributions) {
                // 过滤掉当前维度自身
                const filtered = dist.distributions.filter((d: any) => d.groupId !== group.id)
                setDrillTagData(prev => new Map(prev).set(tid, filtered))
            } else {
                setDrillTagData(prev => new Map(prev).set(tid, []))
            }
        } catch {
            setDrillTagData(prev => new Map(prev).set(tid, []))
        } finally {
            setDrillTagLoading(prev => { const s = new Set(prev); s.delete(tid); return s })
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
                    {/* 树形/列表切换 */}
                    <Segmented
                        value={viewMode}
                        onChange={(val) => setViewMode(val as 'flat' | 'tree')}
                        options={[
                            { value: 'flat', icon: <UnorderedListOutlined />, label: '列表' },
                            { value: 'tree', icon: <ApartmentOutlined />, label: '树形' },
                        ]}
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
                        {(viewMode === 'tree' ? filteredTreeGroups! : filteredGroups).map((group: any) => (
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
                                        {group.parentId && (
                                            <Tooltip title={`父维度 ID: ${group.parentId}`}>
                                                <Tag color='purple' icon={<NodeIndexOutlined />} style={{ fontSize: 11 }}>
                                                    有父维度
                                                </Tag>
                                            </Tooltip>
                                        )}
                                    </Space>
                                }
                                extra={
                                    <Tooltip title='设置该维度的父维度（用于钻取分析）'>
                                        <Button
                                            type='text'
                                            size='small'
                                            icon={<ApartmentOutlined />}
                                            onClick={() => openGroupParentModal(group)}
                                        >
                                            维度父级
                                        </Button>
                                    </Tooltip>
                                }
                                styles={{ body: { padding: '12px 16px' } }}
                            >
                                {group.tags.length > 0 ? (
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: viewMode === 'tree' ? '6px 8px' : 8, alignItems: 'center' }}>
                                        {group.tags.map((tag: any) => {
                                            const depth = tag._depth ?? 0
                                            const isChild = viewMode === 'tree' && depth > 0
                                            return (
                                                <span
                                                    key={tag.id}
                                                    style={{
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: 2,
                                                        marginLeft: isChild ? depth * 24 : 0,
                                                    }}
                                                >
                                                    {isChild && (
                                                        <span style={{ color: '#bbb', fontSize: 12, marginRight: 2, userSelect: 'none' }}>└</span>
                                                    )}
                                                    <Tooltip
                                                        title={tag.repoCount > 0 ? `查看 ${tag.repoCount} 个仓库` : '暂无仓库使用此标签'}
                                                    >
                                                        <Tag
                                                            color={tag.repoCount > 0 ? (tag.color || group.color) : '#d9d9d9'}
                                                            style={{
                                                                fontSize: isChild ? 12 : 13,
                                                                padding: '2px 10px',
                                                                cursor: tag.repoCount > 0 ? 'pointer' : 'default',
                                                                borderRadius: 12,
                                                                opacity: tag.repoCount > 0 ? 1 : 0.5,
                                                                margin: 0,
                                                                lineHeight: isChild ? '18px' : undefined,
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
                                                    {tag.repoCount > 0 && (
                                                        <Button
                                                            type='text'
                                                            size='small'
                                                            icon={drillExpandedTags.has(tag.id) ? <CaretDownOutlined /> : <CaretRightOutlined />}
                                                            title='展开查看子维度标签分布'
                                                            style={{
                                                                fontSize: 10, padding: 0, minWidth: 18, height: 18,
                                                                color: drillExpandedTags.has(tag.id) ? '#1677ff' : '#ccc',
                                                            }}
                                                            onClick={(e) => { e.stopPropagation(); toggleDrillExpand(tag, group) }}
                                                        />
                                                    )}
                                                    <Button
                                                        type='text'
                                                        size='small'
                                                        icon={<LinkOutlined />}
                                                        title='设置父标签'
                                                        style={{
                                                            fontSize: 10,
                                                            padding: 0,
                                                            minWidth: 18,
                                                            height: 18,
                                                            color: '#bbb',
                                                        }}
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            openParentModal(tag, group)
                                                        }}
                                                    />
                                                    {tag.repoCount > 0 && (
                                                        <Button
                                                            type='text'
                                                            size='small'
                                                            icon={<BarChartOutlined />}
                                                            title='下钻分析（查看子维度标签分布）'
                                                            style={{
                                                                fontSize: 10,
                                                                padding: 0,
                                                                minWidth: 18,
                                                                height: 18,
                                                                color: '#1677ff',
                                                            }}
                                                            onClick={(e) => {
                                                                e.stopPropagation()
                                                                openDrillDrawer(tag)
                                                            }}
                                                        />
                                                    )}
                                                </span>
                                            )
                                        })}
                                    </div>
                                ) : (
                                    <Text type='secondary' style={{ fontSize: 13 }}>暂无标签</Text>
                                )}
                                {/* 展开标签的下钻分布（内联展示子维度标签） */}
                                {group.tags.filter((t: any) => drillExpandedTags.has(t.id) && drillTagData.has(t.id)).map((tag: any) => {
                                    const dists = drillTagData.get(tag.id) || []
                                    if (!dists.length) return null
                                    return (
                                        <div key={`drill-${tag.id}`} style={{
                                            marginTop: 12, paddingLeft: 28, paddingTop: 8,
                                            borderTop: '1px dashed #e8e8e8',
                                        }}>
                                            <Text type='secondary' style={{ fontSize: 11, marginBottom: 6, display: 'block' }}>
                                                ↳ 「{tag.name}」标签下 {tag.repoCount} 个项目在其他维度的分布：
                                            </Text>
                                            {dists.map((dist: any) => (
                                                <div key={dist.groupId} style={{ marginBottom: 6 }}>
                                                    <Text type='secondary' style={{ fontSize: 11, fontWeight: 600 }}>
                                                        {dist.groupName}：
                                                    </Text>
                                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 2 }}>
                                                        {dist.tags.slice(0, 8).map((dt: any) => (
                                                            <Tag
                                                                key={dt.tagId}
                                                                color={dt.tagColor || dist.groupColor}
                                                                style={{
                                                                    fontSize: 11, padding: '0 6px', cursor: 'pointer',
                                                                    borderRadius: 8, margin: 0,
                                                                }}
                                                                onClick={() => navigate(`/?tagIds=${tag.id},${dt.tagId}`)}
                                                            >
                                                                {dt.tagName}
                                                                <span style={{ marginLeft: 2, opacity: 0.6, fontSize: 10 }}>
                                                                    {dt.count}
                                                                </span>
                                                            </Tag>
                                                        ))}
                                                        {dist.tags.length > 8 && (
                                                            <Text type='secondary' style={{ fontSize: 10 }}>
                                                                +{dist.tags.length - 8} 更多
                                                            </Text>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )
                                })}
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

            {/* ── 设置父标签 Modal ── */}
            <Modal
                title={
                    <Space>
                        <ApartmentOutlined style={{ color: '#1677ff' }} />
                        设置父标签 — {parentModalTag?.name}
                    </Space>
                }
                open={parentModalVisible}
                onCancel={() => setParentModalVisible(false)}
                onOk={handleSetParent}
                confirmLoading={settingParent}
                okText={selectedParentId === null ? '解除父级' : '保存'}
                cancelText='取消'
                destroyOnClose
            >
                <Alert
                    type='info'
                    showIcon
                    message='将当前标签设为某个父标签的子标签，便于在标签管理页以树形结构展示'
                    description='父级候选范围限定为同一维度下的其他标签。选择"无（设为顶级）"将解除父级关联。'
                    style={{ marginBottom: 16 }}
                />
                <div style={{ marginBottom: 8 }}>
                    <Text strong>父标签</Text>
                </div>
                <AntSelect
                    style={{ width: '100%' }}
                    placeholder='选择父标签'
                    value={selectedParentId === null ? '__null__' : selectedParentId}
                    onChange={(val) => setSelectedParentId(val === '__null__' ? null : (val as number))}
                    showSearch
                    filterOption={(input, option) =>
                        ((option?.label as string) || '').toLowerCase().includes(input.toLowerCase())
                    }
                    options={[
                        { value: '__null__', label: '— 无（设为顶级标签） —' },
                        ...((parentModalGroup?.tags || [])
                            .filter((t: any) => t.id !== parentModalTag?.id)
                            .map((t: any) => ({
                                value: t.id,
                                label: `${t.name} (${t.repoCount} 个仓库)`,
                            }))),
                    ]}
                />
                {parentModalTag?.parentId && (
                    <Text type='secondary' style={{ fontSize: 12, display: 'block', marginTop: 8 }}>
                        当前父标签 ID: {parentModalTag.parentId}
                    </Text>
                )}
            </Modal>

            {/* ── 设置维度父级 Modal ── */}
            <Modal
                title={
                    <Space>
                        <ApartmentOutlined style={{ color: '#722ed1' }} />
                        设置维度父级 — {groupParentModalGroup?.name}
                    </Space>
                }
                open={groupParentModalVisible}
                onCancel={() => setGroupParentModalVisible(false)}
                onOk={handleSetGroupParent}
                confirmLoading={settingGroupParent}
                okText={selectedGroupParentId === null ? '解除父级' : '保存'}
                cancelText='取消'
                destroyOnClose
            >
                <Alert
                    type='info'
                    showIcon
                    message='设置该维度的父维度，建立钻取分析路径'
                    description='例如：将"领域"设为"技术栈"的子维度后，从"技术栈:Python"可以下钻查看 Python 项目在"领域"维度的标签分布。'
                    style={{ marginBottom: 16 }}
                />
                <div style={{ marginBottom: 8 }}>
                    <Text strong>父维度</Text>
                </div>
                <AntSelect
                    style={{ width: '100%' }}
                    placeholder='选择父维度'
                    value={selectedGroupParentId === null ? '__null__' : selectedGroupParentId}
                    onChange={(val) => setSelectedGroupParentId(val === '__null__' ? null : (val as number))}
                    showSearch
                    filterOption={(input, option) =>
                        ((option?.label as string) || '').toLowerCase().includes(input.toLowerCase())
                    }
                    options={[
                        { value: '__null__', label: '— 无（设为顶级维度） —' },
                        ...((groups || [])
                            .filter((g) => g.id !== groupParentModalGroup?.id)
                            .map((g) => ({
                                value: g.id,
                                label: `${g.icon || '📌'} ${g.name} (${g.tags.length} 个标签)`,
                            }))),
                    ]}
                />
                {groupParentModalGroup?.parentId && (
                    <Text type='secondary' style={{ fontSize: 12, display: 'block', marginTop: 8 }}>
                        当前父维度 ID: {groupParentModalGroup.parentId}
                    </Text>
                )}
            </Modal>

            {/* ── 标签下钻分析 Drawer ── */}
            <Drawer
                title={
                    <Space>
                        <BarChartOutlined style={{ color: '#1677ff' }} />
                        <span>下钻分析</span>
                        {drillTag && (
                            <Tag color='cyan'>{drillTag.name}</Tag>
                        )}
                        {drillData && (
                            <Text type='secondary' style={{ fontSize: 13 }}>
                                共 {drillData.totalRepos} 个项目
                            </Text>
                        )}
                    </Space>
                }
                placement='right'
                width={520}
                open={drillDrawerVisible}
                onClose={() => setDrillDrawerVisible(false)}
                extra={
                    drillTag && (
                        <Button
                            type='primary'
                            size='small'
                            onClick={() => navigate(`/?tagIds=${drillTag.id}`)}
                        >
                            查看项目列表
                        </Button>
                    )
                }
            >
                <Spin spinning={drillLoading}>
                    {!drillLoading && drillData && drillData.distributions.length === 0 && (
                        <Empty description='这些项目暂无其他维度的标签数据' />
                    )}
                    {drillData && drillData.distributions.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                            <Alert
                                type='info'
                                showIcon
                                message={`下钻显示「${drillTag?.name}」标签下 ${drillData.totalRepos} 个项目在其他维度的标签分布`}
                            />
                            {drillData.distributions
                                .sort((a, b) => b.tags.reduce((s, t) => s + t.count, 0) - a.tags.reduce((s, t) => s + t.count, 0))
                                .map((dist) => (
                                    <Card
                                        key={dist.groupId}
                                        size='small'
                                        title={
                                            <Space>
                                                <span>{dist.groupIcon ? '' : '📌'} {dist.groupName}</span>
                                                <Text type='secondary' style={{ fontSize: 12 }}>
                                                    {dist.tags.length} 个标签
                                                </Text>
                                            </Space>
                                        }
                                        styles={{ body: { padding: '12px 16px' } }}
                                    >
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                            {dist.tags.slice(0, 10).map((t) => (
                                                <div key={t.tagId} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                    <div style={{ minWidth: 110, fontSize: 13 }}>
                                                        <Tooltip title={`点击查看「${drillTag?.name}」+「${t.tagName}」交集项目`}>
                                                            <a
                                                                onClick={() => navigate(`/?tagIds=${drillTag.id},${t.tagId}`)}
                                                                style={{ color: '#1677ff', cursor: 'pointer' }}
                                                            >
                                                                {t.tagName}
                                                            </a>
                                                        </Tooltip>
                                                    </div>
                                                    <Progress
                                                        percent={t.percentage}
                                                        size='small'
                                                        format={() => `${t.count} (${t.percentage}%)`}
                                                        strokeColor={dist.groupColor}
                                                        style={{ flex: 1, marginBottom: 0 }}
                                                    />
                                                </div>
                                            ))}
                                            {dist.tags.length > 10 && (
                                                <Text type='secondary' style={{ fontSize: 12, marginTop: 4 }}>
                                                    还有 {dist.tags.length - 10} 个标签...
                                                </Text>
                                            )}
                                        </div>
                                    </Card>
                                ))}
                        </div>
                    )}
                </Spin>
            </Drawer>
        </div>
    )
}
