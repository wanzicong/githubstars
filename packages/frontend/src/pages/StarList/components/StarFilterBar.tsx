import { useEffect, useState } from 'react'
import { Input, Select, TreeSelect, Row, Col } from 'antd'
import type { LanguageStatsDTO, CategoryNode } from '../../../types'
import { fetchCategoryTree } from '../../../api'

const SORT_BY_OPTIONS = [
    { label: 'Star 数量', value: 'stars_count' },
    { label: 'Star 时间', value: 'starred_at' },
    { label: 'Fork 数量', value: 'forks_count' },
    { label: '仓库大小', value: 'repo_size' },
    { label: '最近更新', value: 'repo_updated_at' },
    { label: '创建时间', value: 'repo_created_at' },
    { label: '推送时间', value: 'repo_pushed_at' },
]

const SORT_ORDER_OPTIONS = [
    { label: '降序', value: 'desc' },
    { label: '升序', value: 'asc' },
]

/** 把 CategoryNode 树转为 TreeSelect 的 treeData（含仓库数徽标） */
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

export interface StarFilterBarProps {
    keyword: string
    selectedLanguages: string[]
    sortBy: string
    sortOrder: string
    categoryId: number | null
    languageOptions: LanguageStatsDTO[]
    onParamChange: (key: string, value: string | null) => void
}

/** Star 列表顶部筛选栏：关键词 + 语言 + 分类 + 排序 */
export default function StarFilterBar({
    keyword,
    selectedLanguages,
    sortBy,
    sortOrder,
    categoryId,
    languageOptions,
    onParamChange,
}: StarFilterBarProps) {
    const [categoryTree, setCategoryTree] = useState<CategoryTreeOption[]>([])

    // 加载分类树（仅在挂载时一次，分类变化频率低）
    useEffect(() => {
        let cancelled = false
        const load = async () => {
            try {
                const tree = await fetchCategoryTree()
                if (!cancelled) setCategoryTree(toTreeSelectData(tree))
            } catch {
                /* 分类加载失败不阻塞其他筛选 */
            }
        }
        load()
        return () => { cancelled = true }
    }, [])

    const languageSelectOptions = (languageOptions || []).map((lang) => ({
        label: `${lang.language} (${lang.count})`,
        value: lang.language,
    }))

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
            <Col xs={24} sm={12} md={8} lg={5}>
                <Select
                    mode='multiple'
                    placeholder='筛选语言'
                    value={selectedLanguages}
                    onChange={(vals) => onParamChange('languages', vals.length > 0 ? vals.join(',') : null)}
                    options={languageSelectOptions}
                    allowClear
                    showSearch
                    maxTagCount={2}
                    filterOption={(input, option) => (option?.label as string)?.toLowerCase().includes(input.toLowerCase())}
                    style={{ width: '100%' }}
                />
            </Col>
            <Col xs={24} sm={12} md={8} lg={5}>
                <TreeSelect
                    placeholder='筛选分类（含子分类）'
                    value={categoryId ?? undefined}
                    onChange={(val) => onParamChange('categoryId', val ? String(val) : null)}
                    treeData={categoryTree}
                    allowClear
                    showSearch
                    treeDefaultExpandAll={false}
                    treeNodeFilterProp='title'
                    style={{ width: '100%' }}
                />
            </Col>
            <Col xs={12} sm={8} md={6} lg={5}>
                <Select
                    placeholder='排序字段'
                    value={sortBy}
                    onChange={(val) => onParamChange('sortBy', val || null)}
                    options={SORT_BY_OPTIONS}
                    style={{ width: '100%' }}
                />
            </Col>
            <Col xs={12} sm={8} md={6} lg={4}>
                <Select
                    placeholder='排序方向'
                    value={sortOrder}
                    onChange={(val) => onParamChange('sortOrder', val || null)}
                    options={SORT_ORDER_OPTIONS}
                    style={{ width: '100%' }}
                />
            </Col>
        </Row>
    )
}
