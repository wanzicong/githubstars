import { useState, useEffect, useCallback } from 'react'
import { Popover, Input, Tabs, Tag, List, Tree, Spin, Empty, Button, theme } from 'antd'
import { PlusOutlined, StarOutlined, BranchesOutlined, CloseOutlined } from '@ant-design/icons'
import { fetchStarList, fetchCategoryTree } from '@/api'
import type { GithubRepo, CategoryNode } from '@/types'

/** 选中的上下文项（仓库或分类） */
export interface ChatContextItem {
    type: 'repo' | 'category'
    id: number
    /** 展示名（仓库 fullName / 分类 name） */
    label: string
}

interface Props {
    /** 当前已选中的上下文项 */
    value: ChatContextItem[]
    onChange: (items: ChatContextItem[]) => void
}

/** 把分类树拍平为一二级选项（含每级名称） */
function flattenCategories(nodes: CategoryNode[]): CategoryNode[] {
    const result: CategoryNode[] = []
    const walk = (list: CategoryNode[]) => {
        for (const node of list) {
            result.push(node)
            if (node.children && node.children.length > 0) walk(node.children)
        }
    }
    walk(nodes)
    return result
}

/**
 * 对话上下文选择器 —— 「+ 上下文」按钮 + 搜索选择弹层。
 * 支持搜索添加多个仓库 / 从分类树勾选多个分类，已选项以 Tag 展示可单独删除。
 * 选中项仅作为元信息注入 Agent 上下文，帮助 Agent 聚焦回答。
 */
export default function ContextPicker({ value, onChange }: Props) {
    const { token } = theme.useToken()
    const [open, setOpen] = useState(false)
    const [repoKeyword, setRepoKeyword] = useState('')
    const [repoOptions, setRepoOptions] = useState<GithubRepo[]>([])
    const [repoLoading, setRepoLoading] = useState(false)
    const [categories, setCategories] = useState<CategoryNode[]>([])
    const [catLoading, setCatLoading] = useState(false)

    // 弹层打开时加载分类树（一次性）
    useEffect(() => {
        if (!open || categories.length > 0) return
        const load = async () => {
            setCatLoading(true)
            try {
                const tree = await fetchCategoryTree()
                setCategories(tree)
            } catch {
                // 分类加载失败不阻断仓库搜索
            } finally {
                setCatLoading(false)
            }
        }
        void load()
    }, [open, categories.length])

    // 仓库搜索（防抖）
    useEffect(() => {
        const keyword = repoKeyword.trim()
        const timer = setTimeout(async () => {
            setRepoLoading(true)
            try {
                const result = await fetchStarList({ page: 1, size: 20, keyword: keyword || undefined })
                setRepoOptions(result.records)
            } catch {
                setRepoOptions([])
            } finally {
                setRepoLoading(false)
            }
        }, 300)
        return () => clearTimeout(timer)
    }, [repoKeyword])

    const isSelected = useCallback(
        (type: ChatContextItem['type'], id: number) => value.some((item) => item.type === type && item.id === id),
        [value],
    )

    const toggleItem = useCallback(
        (item: ChatContextItem) => {
            if (isSelected(item.type, item.id)) {
                onChange(value.filter((v) => !(v.type === item.type && v.id === item.id)))
            } else {
                onChange([...value, item])
            }
        },
        [value, onChange, isSelected],
    )

    const removeItem = useCallback(
        (item: ChatContextItem) => {
            onChange(value.filter((v) => !(v.type === item.type && v.id === item.id)))
        },
        [value, onChange],
    )

    // 分类树数据（勾选联动选中）
    const treeData = categories.map((node) => ({
        title: `${node.name}（${node.repoCount}）`,
        key: node.id,
        children: node.children?.map((child) => ({
            title: `${child.name}（${child.repoCount}）`,
            key: child.id,
        })),
    }))
    const checkedCatKeys = value.filter((v) => v.type === 'category').map((v) => v.id)

    const handleCheckCategory = (keys: React.Key[]) => {
        const flat = flattenCategories(categories)
        const selectedCats: ChatContextItem[] = []
        for (const key of keys) {
            const node = flat.find((n) => n.id === Number(key))
            if (node) selectedCats.push({ type: 'category', id: node.id, label: node.name })
        }
        // 保留仓库项，替换分类项
        onChange([...value.filter((v) => v.type === 'repo'), ...selectedCats])
    }

    const popoverContent = (
        <div style={{ width: 360, maxHeight: 420, overflowY: 'auto' }}>
            <Tabs
                size='small'
                items={[
                    {
                        key: 'repo',
                        label: '仓库',
                        children: (
                            <div>
                                <Input.Search
                                    size='small'
                                    placeholder='搜索仓库名/描述…'
                                    value={repoKeyword}
                                    onChange={(e) => setRepoKeyword(e.target.value)}
                                    style={{ marginBottom: 8 }}
                                    allowClear
                                />
                                <Spin spinning={repoLoading}>
                                    {repoOptions.length === 0 ? (
                                        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description='无匹配仓库' style={{ margin: '16px 0' }} />
                                    ) : (
                                        <List
                                            size='small'
                                            dataSource={repoOptions}
                                            renderItem={(repo) => {
                                                const selected = isSelected('repo', repo.id)
                                                return (
                                                    <List.Item
                                                        onClick={() => toggleItem({ type: 'repo', id: repo.id, label: repo.fullName })}
                                                        style={{
                                                            cursor: 'pointer',
                                                            padding: '6px 8px',
                                                            background: selected ? token.colorPrimaryBg : 'transparent',
                                                            borderRadius: 4,
                                                        }}
                                                    >
                                                        <StarOutlined style={{ color: selected ? token.colorPrimary : token.colorTextTertiary, marginRight: 6 }} />
                                                        <span style={{ fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                            {repo.fullName}
                                                        </span>
                                                    </List.Item>
                                                )
                                            }}
                                        />
                                    )}
                                </Spin>
                            </div>
                        ),
                    },
                    {
                        key: 'category',
                        label: '分类',
                        children: (
                            <Spin spinning={catLoading}>
                                {treeData.length === 0 ? (
                                    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description='暂无分类' style={{ margin: '16px 0' }} />
                                ) : (
                                    <Tree
                                        checkable
                                        defaultExpandAll
                                        treeData={treeData}
                                        checkedKeys={checkedCatKeys}
                                        onCheck={(keys) => handleCheckCategory(keys as React.Key[])}
                                    />
                                )}
                            </Spin>
                        ),
                    },
                ]}
            />
        </div>
    )

    return (
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
            <Popover
                content={popoverContent}
                trigger='click'
                open={open}
                onOpenChange={setOpen}
                placement='topLeft'
            >
                <Button size='small' type='text' icon={<PlusOutlined />} style={{ color: token.colorTextSecondary }}>
                    上下文
                </Button>
            </Popover>
            {value.map((item) => (
                <Tag
                    key={`${item.type}-${item.id}`}
                    icon={item.type === 'repo' ? <StarOutlined /> : <BranchesOutlined />}
                    closeIcon={<CloseOutlined />}
                    onClose={() => removeItem(item)}
                    color={item.type === 'repo' ? 'gold' : 'blue'}
                    style={{ margin: 0, fontSize: 12 }}
                >
                    {item.label}
                </Tag>
            ))}
        </div>
    )
}
