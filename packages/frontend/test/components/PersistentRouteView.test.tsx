import React, { useEffect, useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import PersistentRouteView from '../../src/components/common/PersistentRouteView'

function StatefulChild({ onUnmount }: { onUnmount: () => void }) {
    const [count, setCount] = useState(0)

    useEffect(() => onUnmount, [onUnmount])

    return <button onClick={() => setCount((value) => value + 1)}>计数 {count}</button>
}

describe('PersistentRouteView', () => {
    it('离开并返回路由时不卸载子组件且保留状态', () => {
        const onUnmount = vi.fn()
        const { rerender } = render(
            <PersistentRouteView active>
                <StatefulChild onUnmount={onUnmount} />
            </PersistentRouteView>,
        )

        fireEvent.click(screen.getByRole('button', { name: '计数 0' }))
        expect(screen.getByRole('button', { name: '计数 1' })).toBeInTheDocument()

        rerender(
            <PersistentRouteView active={false}>
                <StatefulChild onUnmount={onUnmount} />
            </PersistentRouteView>,
        )
        expect(onUnmount).not.toHaveBeenCalled()

        rerender(
            <PersistentRouteView active>
                <StatefulChild onUnmount={onUnmount} />
            </PersistentRouteView>,
        )
        expect(screen.getByRole('button', { name: '计数 1' })).toBeInTheDocument()
        expect(onUnmount).not.toHaveBeenCalled()
    })

    it('从未访问时不提前挂载子组件', () => {
        render(
            <PersistentRouteView active={false}>
                <span>智能体页面</span>
            </PersistentRouteView>,
        )

        expect(screen.queryByText('智能体页面')).not.toBeInTheDocument()
    })
})
