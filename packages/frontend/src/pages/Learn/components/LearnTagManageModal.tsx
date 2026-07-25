import { useCallback, useState } from 'react'
import { Modal, Table, Button, Input, ColorPicker, Space, App, Popconfirm, Tag } from 'antd'
import { PlusOutlined, DeleteOutlined, EditOutlined, CheckOutlined, CloseOutlined } from '@ant-design/icons'
import type { LearnTag } from '../../../types'
import { fetchLearnTags, createLearnTag, updateLearnTag, deleteLearnTag } from '../../../api'

interface LearnTagManageModalProps {
    open: boolean
    onClose: () => void
    onChanged: () => void
}

interface EditingState {
    id: number | null
    name: string
    color: string
}

const DEFAULT_COLORS = ['#1677ff', '#52c41a', '#faad14', '#f5222d', '#722ed1', '#13c2c2', '#eb2f96']

/**
 * 标签管理弹窗
 *
 * 表格列出所有标签，支持新增/改名/改色/删除。
 */
export default function LearnTagManageModal({ open, onClose, onChanged }: LearnTagManageModalProps) {
    const { message } = App.useApp()
    const [tags, setTags] = useState<LearnTag[]>([])
    const [loading, setLoading] = useState(false)
    const [newName, setNewName] = useState('')
    const [newColor, setNewColor] = useState(DEFAULT_COLORS[0])
    const [creating, setCreating] = useState(false)
    const [editing, setEditing] = useState<EditingState | null>(null)

    const reload = useCallback(async () => {
        setLoading(true)
        try {
            const list = await fetchLearnTags()
            setTags(list)
        } catch (e) {
            message.error(e instanceof Error ? e.message : '加载标签失败')
        } finally {
            setLoading(false)
        }
    }, [message])

    // Modal 打开时（open 由 false→true）通过 afterOpenChange 触发 reload，
    // 避免在 useEffect 中同步调用 setState（react-hooks/set-state-in-effect）
    const handleOpenChange = (isOpen: boolean) => {
        if (isOpen) reload()
    }

    const handleCreate = async () => {
        const name = newName.trim()
        if (!name) {
            message.warning('请输入标签名')
            return
        }
        setCreating(true)
        try {
            await createLearnTag({ name, color: newColor })
            message.success(`已创建标签「${name}」`)
            setNewName('')
            await reload()
            onChanged()
        } catch (e) {
            message.error(e instanceof Error ? e.message : '创建失败')
        } finally {
            setCreating(false)
        }
    }

    const handleStartEdit = (tag: LearnTag) => {
        setEditing({ id: tag.id, name: tag.name, color: tag.color ?? DEFAULT_COLORS[0] })
    }

    const handleSaveEdit = async () => {
        if (!editing) return
        const name = editing.name.trim()
        if (!name) {
            message.warning('标签名不能为空')
            return
        }
        try {
            await updateLearnTag({ id: editing.id!, name, color: editing.color })
            message.success('已保存')
            setEditing(null)
            await reload()
            onChanged()
        } catch (e) {
            message.error(e instanceof Error ? e.message : '保存失败')
        }
    }

    const handleDelete = async (tag: LearnTag) => {
        try {
            await deleteLearnTag(tag.id)
            message.success(`已删除标签「${tag.name}」`)
            await reload()
            onChanged()
        } catch (e) {
            message.error(e instanceof Error ? e.message : '删除失败')
        }
    }

    const columns = [
        {
            title: '标签',
            key: 'tag',
            render: (_: unknown, record: LearnTag) => {
                if (editing?.id === record.id) {
                    return (
                        <Space>
                            <Input
                                size='small'
                                value={editing.name}
                                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                                style={{ width: 140 }}
                                maxLength={50}
                            />
                            <ColorPicker
                                size='small'
                                value={editing.color}
                                onChange={(c) => setEditing({ ...editing, color: c.toHexString() })}
                                presets={[{ label: '推荐', colors: DEFAULT_COLORS }]}
                            />
                        </Space>
                    )
                }
                return <Tag color={record.color ?? undefined}>{record.name}</Tag>
            },
        },
        {
            title: '使用次数',
            dataIndex: 'usageCount',
            key: 'usageCount',
            width: 100,
            align: 'center' as const,
        },
        {
            title: '操作',
            key: 'action',
            width: 160,
            align: 'center' as const,
            render: (_: unknown, record: LearnTag) => {
                if (editing?.id === record.id) {
                    return (
                        <Space>
                            <Button size='small' type='text' icon={<CheckOutlined />} onClick={handleSaveEdit} />
                            <Button size='small' type='text' icon={<CloseOutlined />} onClick={() => setEditing(null)} />
                        </Space>
                    )
                }
                return (
                    <Space>
                        <Button size='small' type='text' icon={<EditOutlined />} onClick={() => handleStartEdit(record)} />
                        <Popconfirm
                            title={`确认删除标签「${record.name}」？`}
                            description={record.usageCount ? `将同时从 ${record.usageCount} 条学习记录中移除` : undefined}
                            onConfirm={() => handleDelete(record)}
                            okText='删除'
                            cancelText='取消'
                            okButtonProps={{ danger: true }}
                        >
                            <Button size='small' type='text' danger icon={<DeleteOutlined />} />
                        </Popconfirm>
                    </Space>
                )
            },
        },
    ]

    return (
        <Modal title='管理学习标签' open={open} onCancel={onClose} footer={null} width={640} destroyOnHidden afterOpenChange={handleOpenChange}>
            <Space.Compact style={{ width: '100%', marginBottom: 16 }}>
                <Input
                    placeholder='新标签名'
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onPressEnter={handleCreate}
                    maxLength={50}
                    style={{ flex: 1 }}
                />
                <ColorPicker
                    value={newColor}
                    onChange={(c) => setNewColor(c.toHexString())}
                    presets={[{ label: '推荐', colors: DEFAULT_COLORS }]}
                />
                <Button type='primary' icon={<PlusOutlined />} onClick={handleCreate} loading={creating}>
                    新增
                </Button>
            </Space.Compact>

            <Table
                rowKey='id'
                size='small'
                loading={loading}
                columns={columns}
                dataSource={tags}
                pagination={false}
                locale={{ emptyText: '还没有标签，先在上方创建一个' }}
            />
        </Modal>
    )
}
