import { CodeOutlined } from '@ant-design/icons'
import { Modal, Space, Typography, theme } from 'antd'
import CodePreviewCard from './CodePreviewCard'

const { Text } = Typography

interface CodePreviewModalProps {
    fullName: string
    open: boolean
    onClose: () => void
}

/**
 * 最大化代码预览弹框。
 *
 * 弹框关闭后销毁内容，避免 github1s iframe 在后台继续占用资源；
 * 再次打开时会重新加载，以保证预览状态可用。
 */
export default function CodePreviewModal({ fullName, open, onClose }: CodePreviewModalProps) {
    const { token } = theme.useToken()

    return (
        <Modal
            title={
                <Space size={8} style={{ minWidth: 0, maxWidth: '100%' }}>
                    <CodeOutlined style={{ color: token.colorPrimary }} />
                    <span>代码预览</span>
                    <Text type='secondary' ellipsis={{ tooltip: fullName }} style={{ maxWidth: '50vw', fontWeight: 400 }}>
                        {fullName}
                    </Text>
                </Space>
            }
            open={open}
            onCancel={onClose}
            footer={null}
            width='calc(100vw - 24px)'
            centered
            destroyOnHidden
            styles={{
                container: {
                    height: 'calc(100dvh - 24px)',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    padding: 0,
                },
                header: {
                    flex: 'none',
                    margin: 0,
                    padding: '14px 52px 14px 20px',
                    borderBottom: `1px solid ${token.colorBorderSecondary}`,
                },
                body: {
                    flex: 1,
                    minHeight: 0,
                    overflow: 'hidden',
                    padding: 12,
                },
            }}
        >
            <CodePreviewCard fullName={fullName} eager fill />
        </Modal>
    )
}
