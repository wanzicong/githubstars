import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import CodePreviewModal from '../../src/components/repo/CodePreviewModal'

vi.mock('../../src/components/repo/CodePreviewCard', () => ({
    default: ({ fullName, eager, fill }: { fullName: string; eager?: boolean; fill?: boolean }) => (
        <div data-testid='code-preview-card' data-full-name={fullName} data-eager={String(eager)} data-fill={String(fill)} />
    ),
}))

describe('CodePreviewModal', () => {
    it('打开时应以最大化弹框展示并立即加载代码预览', () => {
        render(<CodePreviewModal fullName='openai/codex' open onClose={vi.fn()} />)

        expect(screen.getByRole('dialog')).toBeInTheDocument()
        expect(screen.getByText('代码预览')).toBeInTheDocument()
        expect(screen.getByText('openai/codex')).toBeInTheDocument()

        const preview = screen.getByTestId('code-preview-card')
        expect(preview).toHaveAttribute('data-full-name', 'openai/codex')
        expect(preview).toHaveAttribute('data-eager', 'true')
        expect(preview).toHaveAttribute('data-fill', 'true')
    })

    it('点击关闭按钮时应通知页面关闭弹框', () => {
        const onClose = vi.fn()
        const { container } = render(<CodePreviewModal fullName='openai/codex' open onClose={onClose} />)

        const closeButton = container.ownerDocument.querySelector<HTMLButtonElement>('.ant-modal-close')
        expect(closeButton).not.toBeNull()
        fireEvent.click(closeButton!)

        expect(onClose).toHaveBeenCalledOnce()
    })

    it('关闭时不应挂载代码预览内容', () => {
        render(<CodePreviewModal fullName='openai/codex' open={false} onClose={vi.fn()} />)

        expect(screen.queryByTestId('code-preview-card')).not.toBeInTheDocument()
    })
})
