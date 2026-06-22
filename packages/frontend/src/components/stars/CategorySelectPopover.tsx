import { useState, useCallback, useEffect, useMemo } from 'react'
import { Popover, Tree, Button, Spin, Typography, App } from 'antd'
import { FolderOutlined } from '@ant-design/icons'
import type { DataNode } from 'antd/es/tree'
import type { CategoryNode } from '../../types'
import { fetchCategoryTree, bindCategoryRepos, unbindCategoryRepos } from '../../api'

const { Text } = Typography

interface CategorySelectPopoverProps {
    repoId: number
    categoryIds?: number[]
    onChange?: () => void
    children: React.ReactNode
}

function toTreeData(nodes: CategoryNode[]): DataNode[] {
    return nodes.map((n) => ({
        key: n.id,
        title: n.name,
        icon: <FolderOutlined />,
        children: n.children?.length ? toTreeData(n.children) : undefined,
    }))
}

export default function CategorySelectPopover({ repoId, categoryIds = [], onChange, children }: CategorySelectPopoverProps) {
    const { message } = App.useApp()
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [treeData, setTreeData] = useState<CategoryNode[]>([])
    const [checkedKeys, setCheckedKeys] = useState<number[]>(categoryIds)
    const [submitting, setSubmitting] = useState(false)

    useEffect(() => {
        if (open && treeData.length === 0) {
            setLoading(true)
            fetchCategoryTree()
                .then(setTreeData)
                .catch(() => message.error('加载分类树失败'))
                .finally(() => setLoading(false))
        }
    }, [open, treeData.length, message])

    useEffect(() => { setCheckedKeys(categoryIds) }, [categoryIds])

    const treeNodes: DataNode[] = useMemo(() => toTreeData(treeData), [treeData])

    const handleConfirm = useCallback(async () => {
        const added = checkedKeys.filter((k) => !categoryIds.includes(k))
        const removed = categoryIds.filter((k) => !checkedKeys.includes(k))
        if (added.length === 0 && removed.length === 0) { setOpen(false); return }
        setSubmitting(true)
        try {
            const tasks: Promise<void>[] = []
            for (const catId of added) tasks.push(bindCategoryRepos(catId, [repoId]))
            for (const catId of removed) tasks.push(unbindCategoryRepos(catId, [repoId]))
            await Promise.all(tasks)
            message.success('分类已更新')
            setOpen(false)
            onChange?.()
        } catch {
            message.error('更新分类失败')
        } finally {
            setSubmitting(false)
        }
    }, [checkedKeys, categoryIds, repoId, message, onChange])

    return (
        <Popover open={open} onOpenChange={(visible) => { setOpen(visible); if (!visible) setTimeout(() => (document.activeElement as HTMLElement)?.blur(), 0) }} trigger="click" destroyTooltipOnHide
            title={
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>选择分类</span>
                    <Button type="primary" size="small" loading={submitting} onClick={handleConfirm}>确认</Button>
                </div>
            }
            content={
                <div style={{ width: 280, maxHeight: 320, overflow: 'auto' }}>
                    <Spin spinning={loading}>
                        {treeData.length === 0 && !loading ? (
                            <Text type="secondary">暂无分类</Text>
                        ) : (
                            <Tree checkable treeData={treeNodes} checkedKeys={checkedKeys}
                                onCheck={(keys) => setCheckedKeys(keys as number[])}
                                defaultExpandAll style={{ background: 'transparent' }} />
                        )}
                    </Spin>
                </div>
            }>
            {children}
        </Popover>
    )
}
