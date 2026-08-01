import { useState, useEffect, useCallback } from 'react'
import { Popover, Input, Tabs, Tag, Tree, Spin, Empty, Button, Checkbox, Tooltip, theme } from 'antd'
import { PlusOutlined, StarOutlined, BranchesOutlined, CloseOutlined } from '@ant-design/icons'
import { fetchStarList, fetchCategoryTree } from '@/api'
import { formatNumberShort } from '@/utils/format'
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

/** chip 区最多完整展示的个数，超出折叠为 +N */
const MAX_VISIBLE_CHIPS = 3

/** 仓库行 CSS 类名：未选中时依赖 :hover 背景 */
const REPO_ROW_CLASS = 'ctx-picker-repo-row'

/**
 * 生成仓库行 hover CSS 文本。
 * 注意：仓库行渲染在 Popover portal（挂在 body 下），与组件根 div 不同子树，
 * CSS 变量沿 DOM 继承解析不到，必须把颜色值直接内联进 CSS 文本。
 */
const repoRowHoverCss = (color: string) => `.${REPO_ROW_CLASS}:hover { background: ${color}; }`

/**
 * 分类树节点标题：名称 + 弱化计数（计数用三级文本色）
 * antd v6 Tree 无 titleRender API，须在 treeData.title 直接传 ReactNode
 */
const renderCatTitle = (name: string, count: number, tertiaryColor: string) => (
    <span style={{ fontSize: 13 }}>
        {name}
        <span style={{ color: tertiaryColor, marginLeft: 4, fontSize: 12 }}>（{count}）</span>
    </span>
)

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
 * 对话上下文选择器 —— 「＋」按钮 + 弹层 + 已选 chip 收纳区。
 * chip 区仅在有选中项时渲染，最多展示 MAX_VISIBLE_CHIPS 个，超出折叠为 +N；
 * 弹层内仓库列表为紧凑单行四列网格（复选框/星标/名称/star数），保证名称列左边缘严格对齐。
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

    // 仓库搜索（防抖 300ms）
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

    // 分类树数据（勾选联动选中）；标题计数用三级文本色弱化
    const treeData = categories.map((node) => ({
        title: renderCatTitle(node.name, node.repoCount, token.colorTextTertiary),
        key: node.id,
        children: node.children?.map((child) => ({
            title: renderCatTitle(child.name, child.repoCount, token.colorTextTertiary),
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
        onChange([...value.filter((v) => v.type === 'repo'), ...selectedCats])
    }

    // ── 仓库紧凑单行列表：复选框列(16px) + 星标列(16px) + 名称列(flex:1) + star数列(48px) ──
    const renderRepoRow = (repo: GithubRepo) => {
        const selected = isSelected('repo', repo.id)
        return (
            <div
                key={repo.id}
                className={REPO_ROW_CLASS}
                onClick={() => toggleItem({ type: 'repo', id: repo.id, label: repo.fullName })}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    height: 32,
                    padding: '0 10px',
                    cursor: 'pointer',
                    borderBottom: `1px solid ${token.colorBorderSecondary}`,
                    // 选中行固定选中底色（inline style 优先级高于 :hover 类样式）；未选中行由 CSS 类提供 hover 背景
                    ...(selected ? { background: token.colorPrimaryBg } : {}),
                }}
            >
                <span style={{ width: 16, flexShrink: 0, display: 'inline-flex', justifyContent: 'center' }}>
                    <Checkbox checked={selected} style={{ pointerEvents: 'none' }} />
                </span>
                <span style={{ width: 16, flexShrink: 0, display: 'inline-flex', justifyContent: 'center' }}>
                    <StarOutlined style={{ color: '#faad14', fontSize: 12 }} />
                </span>
                <Tooltip title={repo.fullName} placement='topLeft'>
                    <span style={{ flex: 1, minWidth: 0, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {repo.fullName}
                    </span>
                </Tooltip>
                <span style={{ width: 48, flexShrink: 0, textAlign: 'right', fontSize: 11, color: token.colorTextTertiary }}>
                    {formatNumberShort(repo.starsCount)}
                </span>
            </div>
        )
    }

    const repoTab = (
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
                    <div style={{ maxHeight: 320, overflowY: 'auto' }}>{repoOptions.map(renderRepoRow)}</div>
                )}
            </Spin>
        </div>
    )

    const categoryTab = (
        <Spin spinning={catLoading}>
            {treeData.length === 0 ? (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description='暂无分类' style={{ margin: '16px 0' }} />
            ) : (
                <div style={{ maxHeight: 320, overflowY: 'auto' }}>
                    <Tree
                        checkable
                        selectable={false}
                        defaultExpandAll
                        treeData={treeData}
                        checkedKeys={checkedCatKeys}
                        onCheck={(keys) => handleCheckCategory(keys as React.Key[])}
                    />
                </div>
            )}
        </Spin>
    )

    const popoverContent = (
        <div style={{ width: 360 }}>
            {value.length > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontSize: 12, color: token.colorTextSecondary }}>已选 {value.length} 项</span>
                    <Button type='link' size='small' style={{ padding: 0, fontSize: 12 }} onClick={() => onChange([])}>
                        清空
                    </Button>
                </div>
            )}
            <Tabs
                size='small'
                items={[
                    { key: 'repo', label: '仓库', children: repoTab },
                    { key: 'category', label: '分类', children: categoryTab },
                ]}
            />
        </div>
    )

    // ── chip 收纳区：仅选中时渲染，最多 MAX_VISIBLE_CHIPS 个，超出折叠 +N ──
    const visibleChips = value.slice(0, MAX_VISIBLE_CHIPS)
    const hiddenCount = value.length - visibleChips.length

    return (
        <div
            style={{
                display: 'flex',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 6,
            }}
        >
            {/* 仓库行渲染在 Popover portal（body 子树），CSS 变量无法继承，颜色必须内联进 CSS 文本 */}
            <style>{repoRowHoverCss(token.colorFillTertiary)}</style>
            <Popover
                content={popoverContent}
                trigger='click'
                open={open}
                onOpenChange={setOpen}
                placement='topRight'
                arrow={false}
            >
                <Tooltip title='添加上下文'>
                    <Button size='small' type='text' aria-label='添加上下文' icon={<PlusOutlined />} style={{ color: token.colorTextSecondary }} />
                </Tooltip>
            </Popover>
            {visibleChips.map((item) => (
                <Tag
                    key={`${item.type}-${item.id}`}
                    icon={item.type === 'repo' ? <StarOutlined /> : <BranchesOutlined />}
                    closeIcon={<CloseOutlined />}
                    onClose={() => removeItem(item)}
                    color={item.type === 'repo' ? 'gold' : 'blue'}
                    style={{ margin: 0, fontSize: 12, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis' }}
                >
                    {item.label}
                </Tag>
            ))}
            {hiddenCount > 0 && (
                <Button
                    type='text'
                    size='small'
                    style={{ fontSize: 12, color: token.colorTextSecondary, padding: '0 4px' }}
                    onClick={() => setOpen(true)}
                >
                    +{hiddenCount}
                </Button>
            )}
        </div>
    )
}
