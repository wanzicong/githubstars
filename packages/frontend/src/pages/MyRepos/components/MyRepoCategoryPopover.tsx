import { useState, useCallback, useEffect, useMemo } from 'react'
import { Popover, Tree, Button, Spin, Typography, App } from 'antd'
import { FolderOutlined } from '@ant-design/icons'
import type { DataNode } from 'antd/es/tree'
import type { CategoryNode } from '@/types'
import { fetchCategoryTree } from '@/api/category'
import { bindMyRepoCategories, unbindMyRepoCategories } from '@/api/my-repos'

const { Text } = Typography

interface MyRepoCategoryPopoverProps {
    repoId: number
    categoryIds?: number[]
    onChange?: () => void
    children: React.ReactNode
}

function arraysEqual(a: number[], b: number[]): boolean {
    if (a.length !== b.length) return false
    const sa = [...a].sort((x, y) => x - y)
    const sb = [...b].sort((x, y) => x - y)
    return sa.every((v, i) => v === sb[i])
}

function toTreeData(nodes: CategoryNode[]): DataNode[] {
    return nodes.map((n) => ({
        key: n.id,
        title: n.name,
        icon: <FolderOutlined />,
        children: n.children?.length ? toTreeData(n.children) : undefined,
    }))
}

/**
 * 我的仓库分类绑定 Popover
 *
 * 与星标仓库 CategorySelectPopover 交互一致，差异点：
 * 绑定/解绑调用 /api/my-repos/categories/* 端点（作用于 my_repo_category_link 表）。
 */
export default function MyRepoCategoryPopover({ repoId, categoryIds = [], onChange, children }: MyRepoCategoryPopoverProps) {
    const { message } = App.useApp()
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [treeData, setTreeData] = useState<CategoryNode[]>([])
    const [submitting, setSubmitting] = useState(false)

    // 渲染期派生：categoryIds prop 内容变化时同步 checkedKeys
    const [prevCategoryIds, setPrevCategoryIds] = useState(categoryIds)
    const [checkedKeys, setCheckedKeys] = useState<number[]>(categoryIds)
    if (!arraysEqual(prevCategoryIds, categoryIds)) {
        setPrevCategoryIds(categoryIds)
        setCheckedKeys(categoryIds)
    }

    const loadTreeData = useCallback(async () => {
        setLoading(true)
        try {
            const data = await fetchCategoryTree()
            setTreeData(data)
        } catch {
            message.error('加载分类树失败')
        } finally {
            setLoading(false)
        }
    }, [message])

    useEffect(() => {
        if (open && treeData.length === 0) {
            Promise.resolve().then(() => loadTreeData())
        }
    }, [open, treeData.length, loadTreeData])

    const treeNodes: DataNode[] = useMemo(() => toTreeData(treeData), [treeData])

    const handleConfirm = useCallback(async () => {
        const added = checkedKeys.filter((k) => !categoryIds.includes(k))
        const removed = categoryIds.filter((k) => !checkedKeys.includes(k))
        if (added.length === 0 && removed.length === 0) { setOpen(false); return }
        setSubmitting(true)
        try {
            const tasks: Promise<unknown>[] = []
            for (const catId of added) tasks.push(bindMyRepoCategories(catId, [repoId]))
            for (const catId of removed) tasks.push(unbindMyRepoCategories(catId, [repoId]))
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
