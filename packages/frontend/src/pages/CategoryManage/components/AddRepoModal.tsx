import { useState, useCallback, useEffect } from 'react'
import { Modal, Input, List, Avatar, Checkbox, Space, Tag, Typography, Empty, Spin, App } from 'antd'
import { SearchOutlined, StarFilled } from '@ant-design/icons'
import { fetchStarList, bindCategoryRepos } from '../../../api'
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
    const [submitting, setSubmitting] = useState(false)

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

    useEffect(() => {
        if (open) {
            setKeyword('')
            setSelectedIds(new Set())
            setPage(1)
            doSearch(1, '')
        }
    }, [open, doSearch])

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
                        renderItem={(repo) => (
                            <List.Item key={repo.id} style={{ cursor: 'pointer', padding: '8px 4px' }}
                                onClick={() => toggleSelect(repo.id)}>
                                <Checkbox checked={selectedIds.has(repo.id)} style={{ marginRight: 12 }} />
                                <List.Item.Meta
                                    avatar={<Avatar src={repo.ownerAvatarUrl} size="small" />}
                                    title={
                                        <Space>
                                            <Text strong>{repo.fullName}</Text>
                                            {repo.language && <Tag color="blue">{repo.language}</Tag>}
                                            <Space size={4}>
                                                <StarFilled style={{ color: '#faad14', fontSize: 12 }} />
                                                <Text type="secondary" style={{ fontSize: 12 }}>{fmtCompact(repo.starsCount)}</Text>
                                            </Space>
                                        </Space>
                                    }
                                    description={repo.description ? (
                                        <Text type="secondary" ellipsis style={{ maxWidth: 480, fontSize: 12 }}>
                                            {repo.description}
                                        </Text>
                                    ) : null}
                                />
                            </List.Item>
                        )}
                    />
                )}
            </Spin>
        </Modal>
    )
}
