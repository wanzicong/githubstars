import { useState, useCallback } from 'react'
import { Card, Table, Input, Select, Button, Space, Tag, Avatar, Typography, Tooltip, Empty, App, Dropdown } from 'antd'
import {
    SearchOutlined,
    PlusOutlined,
    DeleteOutlined,
    StarFilled,
    ReloadOutlined,
    CloudDownloadOutlined,
    DownloadOutlined,
    MoreOutlined,
    FolderOutlined,
    FolderOpenOutlined,
    LinkOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import type { MenuProps } from 'antd'
import type { CategoryNode, CategoryRepo, GithubRepo } from '../../../types'
import type { UseCategoryReposReturn } from '../hooks/useCategoryRepos'
import { LANGUAGE_OPTIONS } from '../../../constants'
import { fetchCategoryBatchIds } from '../../../api/category'
import AddRepoModal from './AddRepoModal'
import MoveRepoModal from './MoveRepoModal'
import ManageRepoCategoriesModal from './ManageRepoCategoriesModal'
import CloneWizardModal from '@/components/clone/CloneWizardModal'
import DownloadWizardModal from '@/components/download/DownloadWizardModal'

const { Link, Text } = Typography

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
    const [movingRepo, setMovingRepo] = useState<CategoryRepo | null>(null)
    const [managingRepo, setManagingRepo] = useState<CategoryRepo | null>(null)

    const { repos, total, loading, currentPage, pageSize, filters, setCurrentPage,
        setPageSize, setFilters, resetFilters, refresh, handleUnbind } = repoState

    const refreshAll = useCallback(async () => {
        await refresh()
        await onCategoryRefresh()
    }, [refresh, onCategoryRefresh])

    const handleBindSuccess = useCallback(async () => {
        setAddModalOpen(false)
        await refreshAll()
    }, [refreshAll])

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

    const handleRowMenuClick = useCallback((record: CategoryRepo) => (info: { key: string; domEvent: React.SyntheticEvent }) => {
        info.domEvent.stopPropagation()
        if (info.key === 'open') {
            window.open(record.htmlUrl, '_blank', 'noopener,noreferrer')
        } else if (info.key === 'move') {
            setMovingRepo(record)
        } else if (info.key === 'manage') {
            setManagingRepo(record)
        } else if (info.key === 'remove') {
            handleUnbind([record.id])
        }
    }, [handleUnbind])

    const buildRowMenu = useCallback((): MenuProps['items'] => [
        { key: 'open', label: '在 GitHub 打开', icon: <LinkOutlined /> },
        { type: 'divider' },
        { key: 'move', label: '移动到其它分类', icon: <FolderOpenOutlined /> },
        { key: 'manage', label: '管理所属分类', icon: <FolderOutlined /> },
        { type: 'divider' },
        { key: 'remove', label: '从该分类移除', icon: <DeleteOutlined />, danger: true },
    ], [])

    const batchMenu: MenuProps['items'] = [
        { key: 'clone', label: '批量克隆', icon: <CloudDownloadOutlined /> },
        { key: 'download', label: '批量下载', icon: <DownloadOutlined /> },
    ]
    const handleBatchMenuClick: MenuProps['onClick'] = ({ key }) => {
        if (key === 'clone') void handleBatchAction('clone')
        else if (key === 'download') void handleBatchAction('download')
    }

    const columns: ColumnsType<CategoryRepo> = [
        {
            title: '仓库', dataIndex: 'repoName', key: 'repoName', ellipsis: true,
            render: (_: unknown, record: CategoryRepo) => (
                <Space>
                    <Avatar src={record.ownerAvatarUrl} size="small" />
                    <div style={{ minWidth: 0 }}>
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
            title: '操作', key: 'action', width: 60,
            render: (_: unknown, record: CategoryRepo) => (
                <Dropdown menu={{ items: buildRowMenu(), onClick: handleRowMenuClick(record) }} trigger={['click']} placement="bottomRight">
                    <Button type="text" size="small" icon={<MoreOutlined />} onClick={(e) => e.stopPropagation()} />
                </Dropdown>
            ),
        },
    ]

    if (!selectedNode) {
        return (
            <Card style={{ height: '100%' }}>
                <Empty
                    description={
                        <div>
                            <div style={{ fontSize: 14, marginBottom: 4 }}>请在左侧选择一个分类</div>
                            <Text type="secondary" style={{ fontSize: 12 }}>点击分类名称查看该分类下的仓库</Text>
                        </div>
                    }
                    style={{ marginTop: 120 }}
                />
            </Card>
        )
    }

    return (
        <Card
            title={
                <Space size={8}>
                    <FolderOutlined style={{ color: '#faad14' }} />
                    <span style={{ fontWeight: 600 }}>{selectedNode.name}</span>
                    <Text type="secondary" style={{ fontSize: 13 }}>({total})</Text>
                </Space>
            }
            size="small"
            extra={
                <Space>
                    <Button type="primary" icon={<PlusOutlined />} onClick={() => setAddModalOpen(true)}>
                        添加仓库
                    </Button>
                    <Dropdown menu={{ items: batchMenu, onClick: handleBatchMenuClick }} trigger={['click']}>
                        <Button loading={batchLoading}>批量操作</Button>
                    </Dropdown>
                </Space>
            }
        >
            <Space wrap style={{ marginBottom: 12 }}>
                <Input.Search placeholder="搜索仓库名或描述" allowClear value={filters.keyword}
                    onChange={(e) => setFilters({ keyword: e.target.value })} onSearch={() => refresh()}
                    style={{ width: 260 }} prefix={<SearchOutlined />} />
                <Select placeholder="语言筛选" allowClear value={filters.language || undefined}
                    onChange={(v) => setFilters({ language: v ?? '' })} options={LANGUAGE_OPTIONS} style={{ width: 140 }} />
                {(filters.keyword || filters.language) && <Button onClick={resetFilters}>重置筛选</Button>}
                <Tooltip title="刷新">
                    <Button icon={<ReloadOutlined />} onClick={() => refresh()} />
                </Tooltip>
            </Space>

            {selectedRowKeys.length > 0 && (
                <div style={{
                    marginBottom: 12,
                    padding: '8px 12px',
                    background: '#e6f4ff',
                    border: '1px solid #91caff',
                    borderRadius: 6,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                }}>
                    <Text>已选 <Text strong>{selectedRowKeys.length}</Text> 项</Text>
                    <Space>
                        <Button size="small" danger icon={<DeleteOutlined />} onClick={handleBatchRemove}>
                            从该分类移除
                        </Button>
                        <Button size="small" type="text" onClick={() => setSelectedRowKeys([])}>取消选择</Button>
                    </Space>
                </div>
            )}

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

            <MoveRepoModal
                open={movingRepo !== null}
                repo={movingRepo}
                fromCategoryId={selectedNode.id}
                onCancel={() => setMovingRepo(null)}
                onSuccess={async () => { setMovingRepo(null); await refreshAll() }}
            />

            <ManageRepoCategoriesModal
                open={managingRepo !== null}
                repo={managingRepo}
                onCancel={() => setManagingRepo(null)}
                onSuccess={async () => { setManagingRepo(null); await refreshAll() }}
            />

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
