import { useState, useCallback, useEffect } from 'react'
import { App } from 'antd'
import type { DataNode } from 'antd/es/tree'
import type { CategoryNode, CategorySortItem } from '../../../types'
import { fetchCategoryTree, createCategory, updateCategory, deleteCategory, sortCategories } from '../../../api'

/** 将后端 CategoryNode 树转换为 antd Tree DataNode 格式 */
function toTreeData(nodes: CategoryNode[]): DataNode[] {
    return nodes.map((node) => ({
        key: node.id,
        title: node.name,
        children: node.children?.length ? toTreeData(node.children) : undefined,
    }))
}

/** 扁平化树获取所有节点 key */
function flattenKeys(nodes: CategoryNode[]): number[] {
    const keys: number[] = []
    const walk = (list: CategoryNode[]) => {
        for (const n of list) {
            keys.push(n.id)
            if (n.children?.length) walk(n.children)
        }
    }
    walk(nodes)
    return keys
}

/** 在树中查找节点 */
function findNodeByKey(nodes: CategoryNode[], key: number | null): CategoryNode | null {
    if (key === null) return null
    for (const n of nodes) {
        if (n.id === key) return n
        if (n.children?.length) {
            const found = findNodeByKey(n.children, key)
            if (found) return found
        }
    }
    return null
}

/** 查找某节点的同级节点 */
function findSiblings(nodes: CategoryNode[], targetId: number): CategoryNode[] {
    if (nodes.some((n) => n.id === targetId)) return nodes
    for (const n of nodes) {
        if (n.children?.length) {
            const found = findSiblings(n.children, targetId)
            if (found.length) return found
        }
    }
    return []
}

export interface UseCategoryTreeReturn {
    treeData: DataNode[]
    rawTree: CategoryNode[]
    expandedKeys: number[]
    selectedKey: number | null
    selectedNode: CategoryNode | null
    loading: boolean
    setSelectedKey: (key: number | null) => void
    setExpandedKeys: (keys: number[]) => void
    expandAll: () => void
    collapseAll: () => void
    refresh: () => Promise<void>
    handleCreateCategory: (name: string, parentId?: number | null) => Promise<void>
    handleUpdateCategory: (id: number, name: string) => Promise<void>
    handleDeleteCategory: (id: number) => Promise<void>
    handleDrop: (dragId: number, dropId: number, dropPosition: number) => Promise<void>
}

export function useCategoryTree(): UseCategoryTreeReturn {
    const { message, modal } = App.useApp()
    const [rawTree, setRawTree] = useState<CategoryNode[]>([])
    const [expandedKeys, setExpandedKeys] = useState<number[]>([])
    const [selectedKey, setSelectedKey] = useState<number | null>(null)
    const [loading, setLoading] = useState(false)

    const selectedNode = findNodeByKey(rawTree, selectedKey)

    const refresh = useCallback(async () => {
        setLoading(true)
        try {
            const data = await fetchCategoryTree()
            setRawTree(data)
        } catch {
            message.error('加载分类树失败')
        } finally {
            setLoading(false)
        }
    }, [message])

    useEffect(() => {
        refresh()
    }, [refresh])

    const expandAll = useCallback(() => setExpandedKeys(flattenKeys(rawTree)), [rawTree])
    const collapseAll = useCallback(() => setExpandedKeys([]), [])

    const handleCreateCategory = useCallback(async (name: string, parentId?: number | null) => {
        try {
            await createCategory({ name, parentId: parentId ?? null })
            message.success('分类创建成功')
            await refresh()
        } catch {
            message.error('创建分类失败')
        }
    }, [message, refresh])

    const handleUpdateCategory = useCallback(async (id: number, name: string) => {
        try {
            await updateCategory({ id, name })
            message.success('分类已更新')
            await refresh()
        } catch {
            message.error('更新分类失败')
        }
    }, [message, refresh])

    const handleDeleteCategory = useCallback(async (id: number) => {
        const node = findNodeByKey(rawTree, id)
        modal.confirm({
            title: '确认删除',
            content: `确定要删除分类「${node?.name ?? ''}」吗？该分类下的仓库不会被删除。`,
            okText: '删除',
            okType: 'danger',
            onOk: async () => {
                try {
                    await deleteCategory(id)
                    message.success('分类已删除')
                    if (selectedKey === id) setSelectedKey(null)
                    await refresh()
                } catch {
                    message.error('删除分类失败')
                }
            },
        })
    }, [rawTree, selectedKey, message, modal, refresh])

    const handleDrop = useCallback(async (dragId: number, dropId: number, dropPosition: number) => {
        const siblings = findSiblings(rawTree, dropId)
        const items: CategorySortItem[] = siblings
            .filter((s) => s.id !== dragId)
            .map((s, idx) => ({ id: s.id, sortOrder: idx }))
        const dropIdx = items.findIndex((i) => i.id === dropId)
        const insertIdx = dropPosition === -1 ? dropIdx : dropIdx + 1
        items.splice(insertIdx, 0, { id: dragId, sortOrder: insertIdx })
        const sorted = items.map((item, idx) => ({ ...item, sortOrder: idx }))
        try {
            await sortCategories(sorted)
            await refresh()
        } catch {
            message.error('排序保存失败')
        }
    }, [rawTree, message, refresh])

    return {
        treeData: toTreeData(rawTree),
        rawTree,
        expandedKeys,
        selectedKey,
        selectedNode,
        loading,
        setSelectedKey,
        setExpandedKeys,
        expandAll,
        collapseAll,
        refresh,
        handleCreateCategory,
        handleUpdateCategory,
        handleDeleteCategory,
        handleDrop,
    }
}
