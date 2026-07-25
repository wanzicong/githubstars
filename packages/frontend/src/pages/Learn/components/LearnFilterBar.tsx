import { useEffect, useState } from 'react'
import { Input, Select, TreeSelect, Row, Col } from 'antd'
import type { CategoryNode, LearnPriority, LearnTag } from '../../../types'
import { fetchCategoryTree, fetchLearnTags } from '../../../api'

const PRIORITY_OPTIONS = [
    { label: '高优先级', value: 'HIGH' },
    { label: '中优先级', value: 'MEDIUM' },
    { label: '低优先级', value: 'LOW' },
]

const SORT_BY_OPTIONS = [
    { label: '加入时间', value: 'createdAt' },
    { label: '最近更新', value: 'updatedAt' },
    { label: '优先级', value: 'priority' },
    { label: 'Star 数量', value: 'starsCount' },
    { label: 'Star 时间', value: 'starredAt' },
]

const SORT_ORDER_OPTIONS = [
    { label: '降序', value: 'desc' },
    { label: '升序', value: 'asc' },
]

interface CategoryTreeOption {
    value: number
    title: string
    children?: CategoryTreeOption[]
}

function toTreeSelectData(nodes: CategoryNode[]): CategoryTreeOption[] {
    return nodes.map((n) => ({
        value: n.id,
        title: n.repoCount > 0 ? `${n.name} (${n.repoCount})` : n.name,
        children: n.children?.length ? toTreeSelectData(n.children) : undefined,
    }))
}

interface LearnFilterBarProps {
    keyword: string
    priority: LearnPriority | ''
    categoryId: number | null
    tagIds: number[]
    sortBy: string
    sortOrder: 'asc' | 'desc'
    onParamChange: (key: string, value: string | null) => void
}

/**
 * 学习清单筛选栏
 *
 * 关键词 + 优先级 + 分类（复用 category 树）+ 标签（learn_tag 平铺）+ 排序
 */
export default function LearnFilterBar({
    keyword,
    priority,
    categoryId,
    tagIds,
    sortBy,
    sortOrder,
    onParamChange,
}: LearnFilterBarProps) {
    const [categoryTree, setCategoryTree] = useState<CategoryTreeOption[]>([])
    const [tags, setTags] = useState<LearnTag[]>([])

    useEffect(() => {
        let cancelled = false
        const load = async () => {
            try {
                const [tree, tagList] = await Promise.all([fetchCategoryTree(), fetchLearnTags()])
                if (cancelled) return
                setCategoryTree(toTreeSelectData(tree))
                setTags(tagList)
            } catch {
                /* 失败不阻塞其他筛选 */
            }
        }
        load()
        return () => {
            cancelled = true
        }
    }, [])

    return (
        <Row gutter={[8, 12]} align='middle' style={{ flexWrap: 'wrap' }}>
            <Col xs={24} sm={12} md={8} lg={5}>
                <Input.Search
                    placeholder='搜索仓库名、描述、作者...'
                    defaultValue={keyword}
                    onSearch={(val) => onParamChange('keyword', val || null)}
                    onChange={(e) => {
                        if (!e.target.value) onParamChange('keyword', null)
                    }}
                    allowClear
                />
            </Col>
            <Col xs={12} sm={6} md={4} lg={3}>
                <Select
                    placeholder='优先级'
                    value={priority || undefined}
                    onChange={(val) => onParamChange('priority', val || null)}
                    options={PRIORITY_OPTIONS}
                    allowClear
                    style={{ width: '100%' }}
                />
            </Col>
            <Col xs={12} sm={6} md={4} lg={4}>
                <TreeSelect
                    placeholder='筛选分类（含子分类）'
                    value={categoryId ?? undefined}
                    onChange={(val) => onParamChange('categoryId', val ? String(val) : null)}
                    treeData={categoryTree}
                    allowClear
                    showSearch
                    treeNodeFilterProp='title'
                    style={{ width: '100%' }}
                />
            </Col>
            <Col xs={24} sm={12} md={8} lg={5}>
                <Select
                    mode='multiple'
                    placeholder='筛选标签'
                    value={tagIds}
                    onChange={(vals) => onParamChange('tagIds', vals.length > 0 ? vals.join(',') : null)}
                    options={tags.map((t) => ({ value: t.id, label: t.name }))}
                    allowClear
                    showSearch
                    maxTagCount={2}
                    optionFilterProp='label'
                    style={{ width: '100%' }}
                />
            </Col>
            <Col xs={12} sm={6} md={4} lg={4}>
                <Select
                    placeholder='排序字段'
                    value={sortBy}
                    onChange={(val) => onParamChange('sortBy', val || null)}
                    options={SORT_BY_OPTIONS}
                    style={{ width: '100%' }}
                />
            </Col>
            <Col xs={12} sm={6} md={4} lg={3}>
                <Select
                    placeholder='方向'
                    value={sortOrder}
                    onChange={(val) => onParamChange('sortOrder', val || null)}
                    options={SORT_ORDER_OPTIONS}
                    style={{ width: '100%' }}
                />
            </Col>
        </Row>
    )
}
