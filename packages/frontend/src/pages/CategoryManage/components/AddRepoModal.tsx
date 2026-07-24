import { useState, useCallback, useEffect } from 'react'
import { Modal, Input, List, Avatar, Checkbox, Space, Tag, Typography, Empty, Spin, App } from 'antd'
import { SearchOutlined, StarFilled, CheckCircleFilled } from '@ant-design/icons'
import { fetchStarList, bindCategoryRepos } from '../../../api'
import { fetchCategoryBatchIds } from '../../../api/category'
import type { GithubRepo } from '../../../types'

const { Text } = Typography

interface AddRepoModalProps {
    open: boolean
    categoryId: number
    categoryName: string
    onCancel: () => void
    onSuccess: () => void
}

/** 简单的数字格式化（k/m） */
function fmtCompact(n: number): string {
    if (!Number.isFinite(n)) return '0'
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'm'
    if (n >= 1000) return (n / 1000).toFixed(1) + 'k'
    return String(n)
}

export default function AddRepoModal({ open, categoryId, categoryName, onCancel, onSuccess }: AddRepoModalProps) {
    const { message } = App.useApp()
    const [keyword, setKeyword] = useState('')
    const [loading, setLoading] = useState(false)
    const [repos, setRepos] = useState<GithubRepo[]>([])
    const [total, setTotal] = useState(0)
    const [page, setPage] = useState(1)
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
    const [existingIds, setExistingIds] = useState<Set<number>>(new Set())
    const [submitting, setSubmitting] = useState(false)
    // 渲染期派生：open 变化时重置表单状态
    const [prevOpen, setPrevOpen] = useState(open)
    if (prevOpen !== open) {
        setPrevOpen(open)
        setKeyword('')
        setSelectedIds(new Set())
        setPage(1)
    }

    const doSearch = useCallback(async (p: number, kw: string) => {
        setLoading(true)
        try {
            const result = await fetchStarList({ page: p, size: 20, keyword: kw || undefined })
            setRepos(result.records)
            setTotal(result.total)
        } catch {
            message.error('搜索失败')
        } finally {
            setLoading(false)
        }
    }, [message])

    // 打开时：加载第一页 + 当前分类已有的 repoIds（keyword/selectedIds/page 在渲染期派生中重置）
    useEffect(() => {
        if (!open) return
        const init = async () => {
            setLoading(true)
            try {
                const [stars, existing] = await Promise.all([
                    fetchStarList({ page: 1, size: 20, keyword: undefined }),
                    fetchCategoryBatchIds(categoryId, true),
                ])
                setRepos(stars.records)
                setTotal(stars.total)
                setExistingIds(new Set(existing.repos.map((r) => r.id)))
            } catch {
                message.error('加载失败')
            } finally {
                setLoading(false)
            }
        }
        init().catch(() => { /* 错误已在内部 message.error */ })
    }, [open, categoryId, message])

    const toggleSelect = useCallback((id: number) => {
        setSelectedIds((prev) => {
            const next = new Set(prev)
            if (next.has(id)) { next.delete(id); } else { next.add(id); }
            return next
        })
    }, [])

    const handleSubmit = useCallback(async () => {
        if (selectedIds.size === 0) {
            message.warning('请至少选择一个仓库')
            return
        }
        setSubmitting(true)
        try {
            await bindCategoryRepos(categoryId, Array.from(selectedIds))
            message.success(`已添加 ${selectedIds.size} 个仓库到「${categoryName}」`)
            onSuccess()
        } catch {
            message.error('绑定失败')
        } finally {
            setSubmitting(false)
        }
    }, [selectedIds, categoryId, categoryName, message, onSuccess])

    return (
        <Modal
            title={`添加仓库到「${categoryName}」`}
            open={open}
            onCancel={onCancel}
            onOk={handleSubmit}
            okText={`确认添加 (${selectedIds.size})`}
            okButtonProps={{ disabled: selectedIds.size === 0, loading: submitting }}
            width={640}
            destroyOnClose
        >
            <Input.Search
                placeholder="搜索仓库名、描述..."
                allowClear
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                onSearch={(v) => { setPage(1); doSearch(1, v) }}
                style={{ marginBottom: 16 }}
                prefix={<SearchOutlined />}
                loading={loading}
            />
            <Spin spinning={loading}>
                {repos.length === 0 && !loading ? (
                    <Empty description="没有找到仓库" />
                ) : (
                    <List<GithubRepo>
                        dataSource={repos}
                        pagination={{
                            current: page,
                            pageSize: 20,
                            total,
                            size: 'small',
                            onChange: (p) => { setPage(p); doSearch(p, keyword) },
                        }}
                        renderItem={(repo) => {
                            const isExisting = existingIds.has(repo.id)
                            return (
                                <List.Item
                                    key={repo.id}
                                    style={{
                                        cursor: isExisting ? 'not-allowed' : 'pointer',
                                        padding: '8px 4px',
                                        opacity: isExisting ? 0.55 : 1,
                                    }}
                                    onClick={() => { if (!isExisting) toggleSelect(repo.id) }}
                                >
                                    {isExisting ? (
                                        <CheckCircleFilled style={{ color: '#52c41a', fontSize: 16, marginRight: 12 }} />
                                    ) : (
                                        <Checkbox checked={selectedIds.has(repo.id)} style={{ marginRight: 12 }} />
                                    )}
                                    <List.Item.Meta
                                        avatar={<Avatar src={repo.ownerAvatarUrl} size="small" />}
                                        title={
                                            <Space>
                                                <Text strong={!isExisting} delete={false} type={isExisting ? 'secondary' : undefined}>
                                                    {repo.fullName}
                                                </Text>
                                                {repo.language && <Tag color="blue">{repo.language}</Tag>}
                                                <Space size={4}>
                                                    <StarFilled style={{ color: '#faad14', fontSize: 12 }} />
                                                    <Text type="secondary" style={{ fontSize: 12 }}>{fmtCompact(repo.starsCount)}</Text>
                                                </Space>
                                                {isExisting && <Text type="success" style={{ fontSize: 12 }}>已添加</Text>}
                                            </Space>
                                        }
                                        description={repo.description ? (
                                            <Text type="secondary" ellipsis style={{ maxWidth: 480, fontSize: 12 }}>
                                                {repo.description}
                                            </Text>
                                        ) : null}
                                    />
                                </List.Item>
                            )
                        }}
                    />
                )}
            </Spin>
        </Modal>
    )
}
