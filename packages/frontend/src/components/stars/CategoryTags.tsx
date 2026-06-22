import { Space, Tag } from 'antd'
import { PlusOutlined, FolderOutlined } from '@ant-design/icons'
import type { CategoryNode } from '../../types'
import CategorySelectPopover from './CategorySelectPopover'

interface CategoryTagsProps {
    repoId: number
    categories?: Pick<CategoryNode, 'id' | 'name'>[]
    onChange?: () => void
}

/**
 * 仓库卡片/行上展示的分类标签
 *
 * 功能：
 * 1. 展示该仓库已归属的分类标签
 * 2. "+分类" 按钮 → 打开分类选择器 Popover
 */
export default function CategoryTags({ repoId, categories = [], onChange }: CategoryTagsProps) {
    /** 阻止事件冒泡，避免触发父级卡片的 onClick 导航 */
    const stopPropagation = (e: React.MouseEvent) => e.stopPropagation()

    if (categories.length === 0) {
        return (
            <CategorySelectPopover repoId={repoId} categoryIds={[]} onChange={onChange}>
                <span style={{ cursor: 'pointer' }} onClick={stopPropagation}>
                    <Tag style={{ borderStyle: 'dashed' }} icon={<PlusOutlined />}>分类</Tag>
                </span>
            </CategorySelectPopover>
        )
    }

    return (
        <Space size={4} wrap onClick={stopPropagation}>
            {categories.map((cat) => (
                <CategorySelectPopover key={cat.id} repoId={repoId}
                    categoryIds={categories.map((c) => c.id)} onChange={onChange}>
                    <Tag color="processing" icon={<FolderOutlined />} style={{ cursor: 'pointer' }}>{cat.name}</Tag>
                </CategorySelectPopover>
            ))}
            <CategorySelectPopover repoId={repoId}
                categoryIds={categories.map((c) => c.id)} onChange={onChange}>
                <span style={{ cursor: 'pointer' }}>
                    <Tag style={{ borderStyle: 'dashed' }} icon={<PlusOutlined />} />
                </span>
            </CategorySelectPopover>
        </Space>
    )
}
