import { useState, useCallback } from 'react'
import { Card, Table, Input, Select, Button, Space, Tag, Avatar, Typography, Tooltip, Empty, App } from 'antd'
import { SearchOutlined, PlusOutlined, DeleteOutlined, StarFilled, ReloadOutlined, CloudDownloadOutlined, DownloadOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import type { CategoryNode, CategoryRepo, GithubRepo } from '../../../types'
import type { UseCategoryReposReturn } from '../hooks/useCategoryRepos'
import { LANGUAGE_OPTIONS } from '../../../constants'
import { fetchCategoryBatchIds } from '../../../api/category'
import AddRepoModal from './AddRepoModal'
import CloneWizardModal from '@/components/clone/CloneWizardModal'
import DownloadWizardModal from '@/components/download/DownloadWizardModal'

const { Text, Link } = Typography

interface CategoryRepoPanelProps {
    selectedNode: CategoryNode | null
    repoState: UseCategoryReposReturn
    onCategoryRefresh: () => Promise<void>
}

export default function CategoryRepoPanel({ selectedNode, repoState, onCategoryRefresh }: CategoryRepoPanelProps) {
    const { message } = App.useApp()
    const [addModalOpen, setAddModalOpen] = useState(false)
    const [selectedRowKeys, setSelectedRowKeys] = useState<number[]>([])
    const [cloneWizardOpen, setCloneWizardOpen] = useState(false)
    const [downloadWizardOpen, setDownloadWizardOpen] = useState(false)
    const [batchRepos, setBatchRepos] = useState<CategoryRepo[]>([])
    const [batchLoading, setBatchLoading] = useState(false)

    const { repos, total, loading, currentPage, pageSize, filters, setCurrentPage,
        setPageSize, setFilters, resetFilters, refresh, handleUnbind } = repoState

    const handleBindSuccess = useCallback(async () => {
        setAddModalOpen(false)
        await refresh()
        await onCategoryRefresh()
    }, [refresh, onCategoryRefresh])

    const handleBatchRemove = useCallback(async () => {
        await handleUnbind(selectedRowKeys)
        setSelectedRowKeys([])
    }, [selectedRowKeys, handleUnbind])

    const handleBatchAction = useCallback(async (type: 'clone' | 'download') => {
        if (!selectedNode) return
        setBatchLoading(true)
        try {
            const { repos, totalCount } = await fetchCategoryBatchIds(selectedNode.id, true)
            if (totalCount === 0) {
                message.warning('该分类下没有仓库')
                return
            }
            setBatchRepos(repos)
            if (type === 'clone') setCloneWizardOpen(true)
            else setDownloadWizardOpen(true)
        } catch {
            message.error('获取仓库列表失败')
        } finally {
            setBatchLoading(false)
        }
    }, [selectedNode, message])

    const columns: ColumnsType<CategoryRepo> = [
        {
            title: '仓库', dataIndex: 'repoName', key: 'repoName', ellipsis: true,
            render: (_: unknown, record: CategoryRepo) => (
                <Space>
                    <Avatar src={record.ownerAvatarUrl} size="small" />
                    <div>
                        <Link href={record.htmlUrl} target="_blank" strong style={{ fontSize: 14 }}>{record.fullName}</Link>
                        {record.description && (
                            <div><Text type="secondary" ellipsis style={{ maxWidth: 400, fontSize: 12 }}>{record.description}</Text></div>
                        )}
                    </div>
                </Space>
            ),
        },
        {
            title: '语言', dataIndex: 'language', key: 'language', width: 100,
            render: (lang: string | null) => lang ? <Tag color="blue">{lang}</Tag> : <Text type="secondary">-</Text>,
        },
        {
            title: 'Stars', dataIndex: 'starsCount', key: 'starsCount', width: 80,
            render: (count: number) => (
                <Space size={4}><StarFilled style={{ color: '#faad14' }} />{count}</Space>
            ),
        },
        {
            title: '操作', key: 'action', width: 80,
            render: (_: unknown, record: CategoryRepo) => (
                <Tooltip title="从分类中移除">
                    <Button type="text" danger size="small" icon={<DeleteOutlined />}
                        onClick={(e) => { e.stopPropagation(); handleUnbind([record.id]) }} />
                </Tooltip>
            ),
        },
    ]

    if (!selectedNode) {
        return <Card style={{ height: '100%' }}><Empty description="请在左侧选择一个分类" style={{ marginTop: 120 }} /></Card>
    }

    return (
        <Card
            title={<Space><span>分类仓库</span><Tag color="processing">{selectedNode.name}</Tag>
                <Text type="secondary">({total})</Text></Space>}
            size="small"
            extra={<Space>
                <Button icon={<CloudDownloadOutlined />} loading={batchLoading} onClick={() => handleBatchAction('clone')}>批量克隆</Button>
                <Button icon={<DownloadOutlined />} loading={batchLoading} onClick={() => handleBatchAction('download')}>批量下载</Button>
                <Button type="primary" icon={<PlusOutlined />} onClick={() => setAddModalOpen(true)}>添加仓库</Button>
                {selectedRowKeys.length > 0 && (
                    <Button danger icon={<DeleteOutlined />} onClick={handleBatchRemove}>移除 ({selectedRowKeys.length})</Button>
                )}
            </Space>}>
            <Space wrap style={{ marginBottom: 16 }}>
                <Input.Search placeholder="搜索仓库名或描述" allowClear value={filters.keyword}
                    onChange={(e) => setFilters({ keyword: e.target.value })} onSearch={() => refresh()}
                    style={{ width: 260 }} prefix={<SearchOutlined />} />
                <Select placeholder="语言筛选" allowClear value={filters.language || undefined}
                    onChange={(v) => setFilters({ language: v ?? '' })} options={LANGUAGE_OPTIONS} style={{ width: 140 }} />
                {(filters.keyword || filters.language) && <Button onClick={resetFilters}>重置筛选</Button>}
                <Button icon={<ReloadOutlined />} onClick={() => refresh()} />
            </Space>
            <Table<CategoryRepo> rowKey="id" columns={columns} dataSource={repos} loading={loading} size="small"
                rowSelection={{ selectedRowKeys, onChange: (keys) => setSelectedRowKeys(keys as number[]) }}
                pagination={{
                    current: currentPage, pageSize, total, showSizeChanger: true,
                    showTotal: (t) => `共 ${t} 个仓库`,
                    onChange: (page, size) => { setCurrentPage(page); setPageSize(size) },
                }}
                locale={{ emptyText: <Empty description="该分类下暂无仓库"><Button type="primary" onClick={() => setAddModalOpen(true)}>添加仓库</Button></Empty> }} />
            <AddRepoModal open={addModalOpen} categoryId={selectedNode.id} categoryName={selectedNode.name}
                onCancel={() => setAddModalOpen(false)} onSuccess={handleBindSuccess} />
            {cloneWizardOpen && (
                <CloneWizardModal
                    open={cloneWizardOpen}
                    onClose={() => { setCloneWizardOpen(false); setBatchRepos([]) }}
                    selectedRepos={batchRepos as GithubRepo[]}
                    onTaskCreated={() => { setCloneWizardOpen(false); setBatchRepos([]); message.success('克隆任务已创建') }}
                />
            )}
            {downloadWizardOpen && (
                <DownloadWizardModal
                    open={downloadWizardOpen}
                    onClose={() => { setDownloadWizardOpen(false); setBatchRepos([]) }}
                    selectedRepos={batchRepos as GithubRepo[]}
                    onTaskCreated={() => { setDownloadWizardOpen(false); setBatchRepos([]); message.success('下载任务已创建') }}
                />
            )}
        </Card>
    )
}
