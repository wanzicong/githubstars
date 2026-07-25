import { Drawer } from 'antd'
import CodePreviewCard from './CodePreviewCard'

interface CodePreviewDrawerProps {
    /** 仓库全名 owner/repo，为 null 时抽屉关闭 */
    fullName: string | null
    onClose: () => void
}

/**
 * 代码预览抽屉 — 用于搜索/趋势列表场景
 *
 * 在右侧滑出 80% 宽度的抽屉，内嵌 CodePreviewCard 展示 github1s 代码浏览。
 * 复用详情页同一组件，保持体验一致。
 */
export default function CodePreviewDrawer({ fullName, onClose }: CodePreviewDrawerProps) {
    return (
        <Drawer
            title={fullName ? `代码预览 — ${fullName}` : '代码预览'}
            placement='right'
            width='80%'
            open={fullName !== null}
            onClose={onClose}
            destroyOnHidden
            styles={{ body: { padding: 16 } }}
        >
            {fullName && <CodePreviewCard fullName={fullName} eager height='calc(100vh - 130px)' />}
        </Drawer>
    )
}
