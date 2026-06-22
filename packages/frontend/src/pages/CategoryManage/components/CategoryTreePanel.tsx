import { useState, useCallback } from 'react'
import { Card, Tree, Button, Space, Dropdown, Empty, Spin, Typography } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, ExpandOutlined, CompressOutlined } from '@ant-design/icons'
import type { MenuInfo } from 'rc-menu/lib/interface'
import type { TreeProps } from 'antd'
import type { UseCategoryTreeReturn } from '../hooks/useCategoryTree'
import CategoryFormModal from './CategoryFormModal'

const { Text } = Typography

interface CategoryTreePanelProps {
    tree: UseCategoryTreeReturn
}

export default function CategoryTreePanel({ tree }: CategoryTreePanelProps) {
    const [formOpen, setFormOpen] = useState(false)
    const [formMode, setFormMode] = useState<'create' | 'edit'>('create')
    const [formParentId, setFormParentId] = useState<number | null>(null)
    const [editingId, setEditingId] = useState<number | null>(null)
    const [editingName, setEditingName] = useState('')
    const [contextMenuNodeId, setContextMenuNodeId] = useState<number | null>(null)

    const { treeData, expandedKeys, selectedKey, loading, setSelectedKey, setExpandedKeys,
        expandAll, collapseAll, handleCreateCategory, handleUpdateCategory, handleDeleteCategory, handleDrop } = tree

    const handleFormSubmit = useCallback(async (values: { name: string }) => {
        if (formMode === 'create') {
            await handleCreateCategory(values.name, formParentId)
        } else if (formMode === 'edit' && editingId) {
            await handleUpdateCategory(editingId, values.name)
        }
        setFormOpen(false)
    }, [formMode, formParentId, editingId, handleCreateCategory, handleUpdateCategory])

    const handleMenuClick = useCallback((info: MenuInfo) => {
        const nodeId = contextMenuNodeId!
        switch (info.key) {
            case 'add-child':
                setFormMode('create')
                setFormParentId(nodeId)
                setFormOpen(true)
                break
            case 'rename': {
                const node = tree.rawTree.find(n => n.id === nodeId) ?? tree.rawTree.flatMap(n => n.children || []).find(c => c.id === nodeId)
                setFormMode('edit')
                setEditingId(nodeId)
                setEditingName(node?.name ?? '')
                setFormOpen(true)
                break
            }
            case 'delete':
                handleDeleteCategory(nodeId)
                break
        }
        setContextMenuNodeId(null)
    }, [contextMenuNodeId, tree.rawTree, handleDeleteCategory])

    const onDrop: TreeProps['onDrop'] = useCallback((info) => {
        const dragKey = Number(info.dragNode.key)
        const dropKey = Number(info.node.key)
        const dropPos = info.node.pos.split('-').map(Number)
        const dropPosition = info.dropPosition - dropPos[dropPos.length - 1]
        handleDrop(dragKey, dropKey, dropPosition)
    }, [handleDrop])

    const contextMenuItems = [
        { key: 'add-child', label: '新建子分类', icon: <PlusOutlined /> },
        { key: 'rename', label: '重命名', icon: <EditOutlined /> },
        { type: 'divider' as const },
        { key: 'delete', label: '删除', icon: <DeleteOutlined />, danger: true },
    ]

    return (
        <Card title="分类目录" size="small" styles={{ body: { padding: 0, minHeight: 400 } }}
            extra={
                <Space size="small">
                    <Button type="text" size="small" icon={<PlusOutlined />}
                        onClick={() => { setFormMode('create'); setFormParentId(null); setFormOpen(true) }}>
                        新建
                    </Button>
                    <Button type="text" size="small" icon={<ExpandOutlined />} onClick={expandAll} />
                    <Button type="text" size="small" icon={<CompressOutlined />} onClick={collapseAll} />
                </Space>
            }>
            <Spin spinning={loading}>
                {treeData.length === 0 && !loading ? (
                    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无分类" style={{ padding: '40px 0' }}>
                        <Button type="primary" icon={<PlusOutlined />}
                            onClick={() => { setFormMode('create'); setFormParentId(null); setFormOpen(true) }}>
                            创建第一个分类
                        </Button>
                    </Empty>
                ) : (
                    <Dropdown menu={{ items: contextMenuItems, onClick: handleMenuClick }} trigger={['contextMenu']}
                        open={contextMenuNodeId !== null} onOpenChange={(open) => { if (!open) setContextMenuNodeId(null) }}>
                        <div style={{ padding: '8px 0' }}>
                            <Tree treeData={treeData} expandedKeys={expandedKeys}
                                selectedKeys={selectedKey ? [selectedKey] : []}
                                onSelect={(keys) => setSelectedKey(keys.length ? Number(keys[0]) : null)}
                                onExpand={(keys) => setExpandedKeys(keys.map(Number))}
                                onRightClick={({ event, node }) => { event.preventDefault(); setContextMenuNodeId(Number(node.key)) }}
                                draggable onDrop={onDrop} blockNode showIcon style={{ background: 'transparent' }} />
                        </div>
                    </Dropdown>
                )}
            </Spin>
            <CategoryFormModal open={formOpen} mode={formMode}
                initialName={formMode === 'edit' ? editingName : ''}
                onCancel={() => setFormOpen(false)} onSubmit={handleFormSubmit} />
        </Card>
    )
}
