import { useState, type ReactNode } from 'react'

interface PersistentRouteViewProps {
    active: boolean
    children: ReactNode
}

/**
 * 路由常驻容器。
 *
 * 首次激活后不再卸载子树，离开路由时仅隐藏页面。适用于持有长连接、
 * 流式请求或大量本地交互状态的页面，避免普通路由切换中断正在进行的任务。
 */
export default function PersistentRouteView({ active, children }: PersistentRouteViewProps) {
    const [visited, setVisited] = useState(active)

    // active 本身已经触发本轮渲染，可在首次激活时直接派生“已访问”状态。
    if (active && !visited) setVisited(true)

    if (!active && !visited) return null

    return (
        <div aria-hidden={active ? undefined : true} className='page-enter' style={{ display: active ? 'block' : 'none' }}>
            {children}
        </div>
    )
}
