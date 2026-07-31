import type { CategoryNode } from '../../../types'

/** TreeSelect 选项节点（含仓库数徽标） */
export interface CategoryTreeOption {
    value: number
    title: string
    children?: CategoryTreeOption[]
}

/** 把 CategoryNode 树转为 TreeSelect 的 treeData */
export function toTreeSelectData(nodes: CategoryNode[]): CategoryTreeOption[] {
    return nodes.map((n) => ({
        value: n.id,
        title: n.repoCount > 0 ? `${n.name} (${n.repoCount})` : n.name,
        children: n.children?.length ? toTreeSelectData(n.children) : undefined,
    }))
}

/** 在分类树中查找指定 id 的展示名（供摘要 Tag 使用） */
export function findCategoryLabel(nodes: CategoryNode[], id: number): string | null {
    for (const n of nodes) {
        if (n.id === id) return n.repoCount > 0 ? `${n.name} (${n.repoCount})` : n.name
        const hit = findCategoryLabel(n.children ?? [], id)
        if (hit) return hit
    }
    return null
}
