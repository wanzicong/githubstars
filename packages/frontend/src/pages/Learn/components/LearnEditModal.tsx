import { useEffect, useState } from 'react'
import { Modal, Form, Select, Input, App } from 'antd'
import type { LearnPriority, LearnRecord, LearnStatus, LearnTag } from '../../../types'
import { updateLearnRecord, fetchLearnTags } from '../../../api'

const STATUS_OPTIONS: { value: LearnStatus; label: string }[] = [
    { value: 'WANT', label: '想学' },
    { value: 'LEARNING', label: '在学' },
    { value: 'DONE', label: '已学完' },
    { value: 'SHELVED', label: '搁置' },
]

const PRIORITY_OPTIONS: { value: LearnPriority; label: string }[] = [
    { value: 'HIGH', label: '高' },
    { value: 'MEDIUM', label: '中' },
    { value: 'LOW', label: '低' },
]

interface LearnEditModalProps {
    record: LearnRecord | null
    open: boolean
    onClose: () => void
    onSaved: () => void
}

interface FormValues {
    status: LearnStatus
    priority: LearnPriority
    notes: string | null
    tagIds: number[]
}

/**
 * 学习记录编辑弹窗
 *
 * 状态/优先级/笔记/标签的全量编辑。
 */
export default function LearnEditModal({ record, open, onClose, onSaved }: LearnEditModalProps) {
    const { message } = App.useApp()
    const [form] = Form.useForm<FormValues>()
    const [tags, setTags] = useState<LearnTag[]>([])
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        if (!open) return
        let cancelled = false
        const load = async () => {
            try {
                const list = await fetchLearnTags()
                if (!cancelled) setTags(list)
            } catch {
                /* 标签加载失败不阻塞编辑 */
            }
        }
        load()
        return () => {
            cancelled = true
        }
    }, [open])

    useEffect(() => {
        if (open && record) {
            form.setFieldsValue({
                status: record.status,
                priority: record.priority,
                notes: record.notes,
                tagIds: record.tags.map((t) => t.id),
            })
        }
    }, [open, record, form])

    const handleSubmit = async () => {
        if (!record) return
        try {
            const values = await form.validateFields()
            setSaving(true)
            await updateLearnRecord({
                id: record.id,
                status: values.status,
                priority: values.priority,
                notes: values.notes ?? null,
                tagIds: values.tagIds ?? [],
            })
            message.success('已保存')
            onSaved()
            onClose()
        } catch (e) {
            if (e && typeof e === 'object' && 'errorFields' in e) return
            message.error(e instanceof Error ? e.message : '保存失败')
        } finally {
            setSaving(false)
        }
    }

    return (
        <Modal
            title={`编辑学习记录 — ${record?.repo.repoName ?? ''}`}
            open={open}
            onCancel={onClose}
            onOk={handleSubmit}
            confirmLoading={saving}
            okText='保存'
            cancelText='取消'
            destroyOnHidden
            width={520}
        >
            <Form form={form} layout='vertical' style={{ marginTop: 16 }}>
                <Form.Item name='status' label='学习状态' rules={[{ required: true }]}>
                    <Select options={STATUS_OPTIONS} />
                </Form.Item>
                <Form.Item name='priority' label='优先级' rules={[{ required: true }]}>
                    <Select options={PRIORITY_OPTIONS} />
                </Form.Item>
                <Form.Item name='tagIds' label='标签'>
                    <Select
                        mode='multiple'
                        placeholder='选择标签'
                        options={tags.map((t) => ({ value: t.id, label: t.name }))}
                        allowClear
                        showSearch
                        optionFilterProp='label'
                    />
                </Form.Item>
                <Form.Item name='notes' label='个人笔记'>
                    <Input.TextArea rows={4} maxLength={5000} showCount placeholder='记录学习心得、踩坑点、关键收获...' />
                </Form.Item>
            </Form>
        </Modal>
    )
}
