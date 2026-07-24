import { useState, useCallback, useMemo } from 'react'
import { Card, Tree, Button, Dropdown, Empty, Spin, Input } from 'antd'
import {
    PlusOutlined,
    EditOutlined,
    DeleteOutlined,
    MoreOutlined,
    HolderOutlined,
    FolderOutlined,
    SearchOutlined,
} from '@ant-design/icons'
import type { MenuProps, TreeProps } from 'antd'
import type { DataNode } from 'antd/es/tree'
import type { CategoryNode } from '../../../types'
import type { UseCategoryTreeReturn } from '../hooks/useCategoryTree'
import CategoryFormModal from './CategoryFormModal'

interface CategoryTreePanelProps {
    tree: UseCategoryTreeReturn
}

/** 在树中查找节点 */
function findNode(nodes: CategoryNode[], id: number): CategoryNode | null {
    for (const n of nodes) {
        if (n.id === id) return n
        if (n.children?.length) {
            const found = findNode(n.children, id)
            if (found) return found
        }
    }
    return null
}

/** 收集匹配节点的所有父级 key（用于自动展开） */
function collectExpandedKeys(nodes: CategoryNode[], keyword: string): number[] {
    if (!keyword) return []
    const keys: number[] = []
    const walk = (list: CategoryNode[], ancestors: number[]): boolean => {
        let anyMatch = false
        for (const n of list) {
            const selfMatch = n.name.toLowerCase().includes(keyword.toLowerCase())
            const childMatch = n.children?.length ? walk(n.children, [...ancestors, n.id]) : false
            if (selfMatch || childMatch) {
                anyMatch = true
                keys.push(...ancestors)
            }
        }
        return anyMatch
    }
    walk(nodes, [])
    return Array.from(new Set(keys))
}

/** 过滤树：保留匹配节点及其祖先 */
function filterTree(nodes: CategoryNode[], keyword: string): CategoryNode[] {
    if (!keyword) return nodes
    const lower = keyword.toLowerCase()
    const walk = (list: CategoryNode[]): CategoryNode[] => {
        const result: CategoryNode[] = []
        for (const n of list) {
            const childFiltered = n.children?.length ? walk(n.children) : []
            const selfMatch = n.name.toLowerCase().includes(lower)
            if (selfMatch || childFiltered.length > 0) {
                result.push({ ...n, children: childFiltered })
            }
        }
        return result
    }
    return walk(nodes)
}

export default function CategoryTreePanel({ tree }: CategoryTreePanelProps) {
    const [formOpen, setFormOpen] = useState(false)
    const [formMode, setFormMode] = useState<'create' | 'edit'>('create')
    const [formParentId, setFormParentId] = useState<number | null>(null)
    const [editingId, setEditingId] = useState<number | null>(null)
    const [editingName, setEditingName] = useState('')
    const [searchKeyword, setSearchKeyword] = useState('')

    const { rawTree, expandedKeys, selectedKey, loading, setSelectedKey, setExpandedKeys,
        handleCreateCategory, handleUpdateCategory, handleDeleteCategory, handleDrop } = tree

    const filteredTree = useMemo(() => filterTree(rawTree, searchKeyword), [rawTree, searchKeyword])
    const autoExpandKeys = useMemo(() => collectExpandedKeys(rawTree, searchKeyword), [rawTree, searchKeyword])

    // 搜索时强制展开匹配父级，否则用用户控制的展开状态
    const effectiveExpandedKeys = searchKeyword ? autoExpandKeys : expandedKeys

    const handleFormSubmit = useCallback(async (values: { name: string }) => {
        if (formMode === 'create') {
            await handleCreateCategory(values.name, formParentId)
        } else if (formMode === 'edit' && editingId) {
            await handleUpdateCategory(editingId, values.name)
        }
        setFormOpen(false)
    }, [formMode, formParentId, editingId, handleCreateCategory, handleUpdateCategory])

    const openCreateModal = useCallback((parentId: number | null) => {
        setFormMode('create')
        setFormParentId(parentId)
        setFormOpen(true)
    }, [])

    const openEditModal = useCallback((nodeId: number) => {
        const node = findNode(rawTree, nodeId)
        setFormMode('edit')
        setEditingId(nodeId)
        setEditingName(node?.name ?? '')
        setFormOpen(true)
    }, [rawTree])

    const handleMenuClick = useCallback((nodeId: number) => (info: { key: string; domEvent: React.SyntheticEvent }) => {
        info.domEvent.stopPropagation()
        if (info.key === 'add-child') openCreateModal(nodeId)
        else if (info.key === 'rename') openEditModal(nodeId)
        else if (info.key === 'delete') handleDeleteCategory(nodeId)
    }, [openCreateModal, openEditModal, handleDeleteCategory])

    const onDrop: TreeProps['onDrop'] = useCallback((info) => {
        const dragKey = Number(info.dragNode.key)
        const dropKey = Number(info.node.key)
        const dropPos = info.node.pos.split('-').map(Number)
        const dropPosition = info.dropPosition - dropPos[dropPos.length - 1]
        handleDrop(dragKey, dropKey, dropPosition)
    }, [handleDrop])

    const buildMenuItems = useCallback((): MenuProps['items'] => [
        { key: 'add-child', label: '新建子分类', icon: <PlusOutlined /> },
        { key: 'rename', label: '重命名', icon: <EditOutlined /> },
        { type: 'divider' },
        { key: 'delete', label: '删除', icon: <DeleteOutlined />, danger: true },
    ], [])

    /** 自定义节点 title 渲染：图标 + 名称 + 数量 + hover ⋯ */
    const renderTitle = useCallback((node: DataNode): React.ReactNode => {
        const nodeId = Number(node.key)
        const rawNode = findNode(rawTree, nodeId)
        if (!rawNode) return null

        const name = rawNode.name
        const keyword = searchKeyword.toLowerCase()
        // 高亮匹配文本
        let titleNode: React.ReactNode = name
        if (keyword) {
            const idx = name.toLowerCase().indexOf(keyword)
            if (idx >= 0) {
                titleNode = (
                    <>
                        {name.slice(0, idx)}
                        <span style={{ color: '#f5222d', fontWeight: 600 }}>{name.slice(idx, idx + keyword.length)}</span>
                        {name.slice(idx + keyword.length)}
                    </>
                )
            }
        }

        return (
            <div className="category-tree-node" style={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 0, paddingRight: 4 }}>
                <FolderOutlined style={{ marginRight: 6, color: '#faad14', flexShrink: 0 }} />
                <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {titleNode}
                </span>
                <span style={{ color: '#999', fontSize: 12, marginLeft: 6, flexShrink: 0 }}>({rawNode.repoCount})</span>
                <Dropdown
                    menu={{ items: buildMenuItems(), onClick: handleMenuClick(nodeId) }}
                    trigger={['click']}
                    placement="bottomRight"
                >
                    <Button
                        type="text"
                        size="small"
                        icon={<MoreOutlined />}
                        className="category-node-action"
                        onClick={(e) => e.stopPropagation()}
                        style={{ marginLeft: 4, flexShrink: 0, opacity: 0 }}
                    />
                </Dropdown>
            </div>
        )
    }, [rawTree, searchKeyword, buildMenuItems, handleMenuClick])

    /** 把 CategoryNode 转为 DataNode */
    const treeData = useMemo<DataNode[]>(() => {
        const walk = (list: CategoryNode[]): DataNode[] =>
            list.map((n) => ({
                key: n.id,
                title: n.name,
                children: n.children?.length ? walk(n.children) : undefined,
            }))
        return walk(filteredTree)
    }, [filteredTree])

    return (
        <Card
            title="分类目录"
            size="small"
            styles={{ body: { padding: 0, minHeight: 400 } }}
            extra={
                <Button type="text" size="small" icon={<PlusOutlined />} onClick={() => openCreateModal(null)}>
                    新建
                </Button>
            }
        >
            <div style={{ padding: '8px 12px', borderBottom: '1px solid #f0f0f0' }}>
                <Input
                    placeholder="搜索分类..."
                    allowClear
                    size="small"
                    prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
                    value={searchKeyword}
                    onChange={(e) => setSearchKeyword(e.target.value)}
                />
            </div>
            <Spin spinning={loading}>
                {treeData.length === 0 && !loading ? (
                    <Empty
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                        description={searchKeyword ? `未找到匹配「${searchKeyword}」的分类` : '暂无分类'}
                        style={{ padding: '40px 0' }}
                    >
                        {!searchKeyword && (
                            <Button type="primary" icon={<PlusOutlined />} onClick={() => openCreateModal(null)}>
                                创建第一个分类
                            </Button>
                        )}
                    </Empty>
                ) : (
                    <div className="category-tree-wrapper" style={{ padding: '8px 0' }}>
                        <Tree
                            treeData={treeData}
                            expandedKeys={effectiveExpandedKeys}
                            selectedKeys={selectedKey ? [selectedKey] : []}
                            onSelect={(keys) => setSelectedKey(keys.length ? Number(keys[0]) : null)}
                            onExpand={(keys) => setExpandedKeys(keys.map(Number))}
                            draggable={{ icon: <HolderOutlined />, nodeDraggable: () => true }}
                            onDrop={onDrop}
                            blockNode
                            titleRender={renderTitle}
                            style={{ background: 'transparent' }}
                        />
                    </div>
                )}
            </Spin>
            <CategoryFormModal
                open={formOpen}
                mode={formMode}
                initialName={formMode === 'edit' ? editingName : ''}
                onCancel={() => setFormOpen(false)}
                onSubmit={handleFormSubmit}
            />
        </Card>
    )
}
