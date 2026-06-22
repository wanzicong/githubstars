import { useEffect } from 'react'
import { Modal, Form, Input } from 'antd'
import { CATEGORY_NAME_MAX_LENGTH } from '../../../constants'

interface CategoryFormModalProps {
    open: boolean
    mode: 'create' | 'edit'
    initialName?: string
    onCancel: () => void
    onSubmit: (values: { name: string }) => Promise<void>
}

export default function CategoryFormModal({ open, mode, initialName = '', onCancel, onSubmit }: CategoryFormModalProps) {
    const [form] = Form.useForm<{ name: string }>()

    useEffect(() => {
        if (open) form.setFieldsValue({ name: initialName })
    }, [open, initialName, form])

    const handleOk = async () => {
        try {
            const values = await form.validateFields()
            await onSubmit(values)
            form.resetFields()
        } catch { /* validation failed */ }
    }

    return (
        <Modal
            title={mode === 'create' ? '新建分类' : '重命名分类'}
            open={open}
            onCancel={onCancel}
            onOk={handleOk}
            okText={mode === 'create' ? '创建' : '保存'}
            destroyOnClose
        >
            <Form form={form} layout="vertical" initialValues={{ name: initialName }}>
                <Form.Item
                    name="name"
                    label="分类名称"
                    rules={[
                        { required: true, message: '请输入分类名称' },
                        { max: CATEGORY_NAME_MAX_LENGTH, message: `名称不超过 ${CATEGORY_NAME_MAX_LENGTH} 个字符` },
                    ]}
                >
                    <Input placeholder="例如：前端框架、后端工具" autoFocus onPressEnter={handleOk} />
                </Form.Item>
            </Form>
        </Modal>
    )
}
