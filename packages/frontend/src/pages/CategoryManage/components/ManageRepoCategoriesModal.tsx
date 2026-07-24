import { useEffect, useState, useCallback } from 'react'
import { Modal, Checkbox, Spin, Empty, App, Space, Typography } from 'antd'
import { FolderOutlined } from '@ant-design/icons'
import type { CategoryNode, CategoryRepo } from '../../../types'
import { fetchCategoryTree, fetchRepoCategories, bindCategoryRepos, unbindCategoryRepos } from '../../../api'

const { Text } = Typography

interface ManageRepoCategoriesModalProps {
    open: boolean
    repo: CategoryRepo | null
    onCancel: () => void
    onSuccess: () => void
}

/** 拍平分类树用于 checkbox 渲染（一级分类在前，子分类缩进） */
function flattenTree(nodes: CategoryNode[]): Array<{ node: CategoryNode; depth: number }> {
    const result: Array<{ node: CategoryNode; depth: number }> = []
    const walk = (list: CategoryNode[], depth: number) => {
        for (const n of list) {
            result.push({ node: n, depth })
            if (n.children?.length) walk(n.children, depth + 1)
        }
    }
    walk(nodes, 0)
    return result
}

export default function ManageRepoCategoriesModal({ open, repo, onCancel, onSuccess }: ManageRepoCategoriesModalProps) {
    const { message } = App.useApp()
    const [loading, setLoading] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [tree, setTree] = useState<CategoryNode[]>([])
    const [initialChecked, setInitialChecked] = useState<Set<number>>(new Set())
    const [checked, setChecked] = useState<Set<number>>(new Set())

    useEffect(() => {
        if (!open || !repo) return
        const load = async () => {
            setLoading(true)
            try {
                const [treeData, checkedIds] = await Promise.all([
                    fetchCategoryTree(),
                    fetchRepoCategories(repo.id),
                ])
                setTree(treeData)
                const checkedSet = new Set(checkedIds)
                setInitialChecked(checkedSet)
                setChecked(new Set(checkedSet))
            } catch {
                message.error('加载分类失败')
            } finally {
                setLoading(false)
            }
        }
        void load()
    }, [open, repo, message])

    const toggle = useCallback((id: number) => {
        setChecked((prev) => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }, [])

    const handleSubmit = useCallback(async () => {
        if (!repo) return
        setSubmitting(true)
        try {
            const added = [...checked].filter((id) => !initialChecked.has(id))
            const removed = [...initialChecked].filter((id) => !checked.has(id))
            const tasks: Promise<unknown>[] = []
            for (const id of added) tasks.push(bindCategoryRepos(id, [repo.id]))
            for (const id of removed) tasks.push(unbindCategoryRepos(id, [repo.id]))
            await Promise.all(tasks)
            message.success('分类已更新')
            onSuccess()
        } catch {
            message.error('更新分类失败')
        } finally {
            setSubmitting(false)
        }
    }, [repo, checked, initialChecked, message, onSuccess])

    const flat = flattenTree(tree)

    return (
        <Modal
            title={repo ? `管理「${repo.fullName}」的分类` : '管理分类'}
            open={open}
            onCancel={onCancel}
            onOk={handleSubmit}
            okText="保存"
            okButtonProps={{ loading: submitting }}
            width={480}
            destroyOnClose
        >
            <Spin spinning={loading}>
                {flat.length === 0 && !loading ? (
                    <Empty description="还没有分类，请先在左侧创建" />
                ) : (
                    <div style={{ maxHeight: 400, overflowY: 'auto', padding: '8px 0' }}>
                        {flat.map(({ node, depth }) => (
                            <div
                                key={node.id}
                                onClick={() => toggle(node.id)}
                                style={{
                                    padding: '6px 8px',
                                    paddingLeft: 8 + depth * 24,
                                    cursor: 'pointer',
                                    borderRadius: 4,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 8,
                                }}
                                onMouseEnter={(e) => { e.currentTarget.style.background = '#f5f5f5' }}
                                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                            >
                                <Checkbox checked={checked.has(node.id)} onClick={(e) => e.stopPropagation()} onChange={() => toggle(node.id)} />
                                <FolderOutlined style={{ color: '#faad14' }} />
                                <Text>{node.name}</Text>
                                <Text type="secondary" style={{ fontSize: 12 }}>({node.repoCount})</Text>
                            </div>
                        ))}
                    </div>
                )}
            </Spin>
            <Space style={{ marginTop: 12 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                    已选 {checked.size} 个分类
                </Text>
            </Space>
        </Modal>
    )
}
