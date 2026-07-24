import { useEffect, useState, useCallback } from 'react'
import { Modal, Radio, Spin, Empty, App, Typography } from 'antd'
import { FolderOutlined } from '@ant-design/icons'
import type { CategoryNode, CategoryRepo } from '../../../types'
import { fetchCategoryTree, bindCategoryRepos, unbindCategoryRepos } from '../../../api'

const { Text } = Typography

interface MoveRepoModalProps {
    open: boolean
    repo: CategoryRepo | null
    /** 当前所在分类（从这个分类移出） */
    fromCategoryId: number
    onCancel: () => void
    onSuccess: () => void
}

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

export default function MoveRepoModal({ open, repo, fromCategoryId, onCancel, onSuccess }: MoveRepoModalProps) {
    const { message } = App.useApp()
    const [loading, setLoading] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [tree, setTree] = useState<CategoryNode[]>([])
    // 渲染期派生：open 变化时重置 targetId
    const [prevOpen, setPrevOpen] = useState(open)
    const [targetId, setTargetId] = useState<number | null>(null)
    if (prevOpen !== open) {
        setPrevOpen(open)
        setTargetId(null)
    }

    useEffect(() => {
        if (!open) return
        const load = async () => {
            setLoading(true)
            try {
                const data = await fetchCategoryTree()
                setTree(data)
            } catch {
                message.error('加载分类失败')
            } finally {
                setLoading(false)
            }
        }
        void load()
    }, [open, message])

    const handleSubmit = useCallback(async () => {
        if (!repo || targetId === null) {
            message.warning('请选择目标分类')
            return
        }
        setSubmitting(true)
        try {
            await bindCategoryRepos(targetId, [repo.id])
            await unbindCategoryRepos(fromCategoryId, [repo.id])
            message.success('已移动')
            onSuccess()
        } catch {
            message.error('移动失败')
        } finally {
            setSubmitting(false)
        }
    }, [repo, targetId, fromCategoryId, message, onSuccess])

    const flat = flattenTree(tree).filter(({ node }) => node.id !== fromCategoryId)

    return (
        <Modal
            title={repo ? `移动「${repo.fullName}」到...` : '移动仓库'}
            open={open}
            onCancel={onCancel}
            onOk={handleSubmit}
            okText="确认移动"
            okButtonProps={{ loading: submitting, disabled: targetId === null }}
            width={480}
            destroyOnClose
        >
            <Spin spinning={loading}>
                {flat.length === 0 && !loading ? (
                    <Empty description="暂无其它分类可移动" />
                ) : (
                    <Radio.Group
                        value={targetId}
                        onChange={(e) => setTargetId(e.target.value as number)}
                        style={{ display: 'flex', flexDirection: 'column', maxHeight: 400, overflowY: 'auto', padding: '8px 0' }}
                    >
                        {flat.map(({ node, depth }) => (
                            <Radio
                                key={node.id}
                                value={node.id}
                                style={{
                                    padding: '6px 8px',
                                    paddingLeft: 8 + depth * 24,
                                    borderRadius: 4,
                                    display: 'flex',
                                    alignItems: 'center',
                                }}
                            >
                                <FolderOutlined style={{ color: '#faad14', marginRight: 6 }} />
                                <Text>{node.name}</Text>
                                <Text type="secondary" style={{ fontSize: 12, marginLeft: 4 }}>({node.repoCount})</Text>
                            </Radio>
                        ))}
                    </Radio.Group>
                )}
            </Spin>
        </Modal>
    )
}
