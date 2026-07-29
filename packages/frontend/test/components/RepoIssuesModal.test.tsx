import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import RepoIssuesModal from '../../src/components/repo/RepoIssuesModal'
import { fetchRepoIssues } from '../../src/api'
import type { GithubIssueListResult } from '../../src/types'

vi.mock('../../src/api', () => ({
    fetchRepoIssues: vi.fn(),
}))

const issueResult: GithubIssueListResult = {
    totalCount: 1,
    incompleteResults: false,
    page: 1,
    perPage: 20,
    items: [
        {
            id: 101,
            number: 42,
            state: 'open',
            stateReason: null,
            title: 'Fix startup crash',
            htmlUrl: 'https://github.com/openai/codex/issues/42',
            user: {
                login: 'octocat',
                avatarUrl: 'https://example.com/avatar.png',
                htmlUrl: 'https://github.com/octocat',
            },
            labels: [
                { name: 'bug', color: 'd73a4a', description: 'Something is broken' },
            ],
            assignees: [],
            comments: 3,
            locked: false,
            milestoneTitle: null,
            createdAt: '2026-07-01T00:00:00Z',
            updatedAt: '2026-07-02T00:00:00Z',
            closedAt: null,
        },
    ],
}

const defaultProps = {
    repoId: 332,
    fullName: 'openai/codex',
    htmlUrl: 'https://github.com/openai/codex',
    open: true,
    onClose: vi.fn(),
}

describe('RepoIssuesModal', () => {
    afterEach(() => {
        vi.clearAllMocks()
    })

    it('打开时应加载并展示 GitHub 风格 Issue 列表', async () => {
        vi.mocked(fetchRepoIssues).mockResolvedValue(issueResult)

        render(<RepoIssuesModal {...defaultProps} />)

        expect(screen.getByRole('dialog')).toBeInTheDocument()
        expect(screen.getByText('Issues')).toBeInTheDocument()
        expect(screen.getByText('openai/codex')).toBeInTheDocument()
        expect(await screen.findByRole('link', { name: 'Fix startup crash' })).toHaveAttribute(
            'href',
            'https://github.com/openai/codex/issues/42',
        )
        expect(screen.getByText('bug')).toBeInTheDocument()
        expect(screen.getByRole('link', { name: '3 条评论' })).toBeInTheDocument()
        expect(screen.getByText(/#42/)).toBeInTheDocument()
        expect(fetchRepoIssues).toHaveBeenCalledWith({
            repoId: 332,
            state: 'open',
            query: '',
            sort: 'updated',
            order: 'desc',
            page: 1,
            perPage: 20,
        })
    })

    it('应支持关键词搜索和关闭状态筛选', async () => {
        vi.mocked(fetchRepoIssues).mockResolvedValue(issueResult)
        render(<RepoIssuesModal {...defaultProps} />)
        await screen.findByText('Fix startup crash')

        fireEvent.change(screen.getByRole('searchbox', { name: '搜索 Issues' }), {
            target: { value: 'startup crash' },
        })
        fireEvent.click(screen.getByRole('button', { name: /搜\s*索/ }))

        await waitFor(() => {
            expect(fetchRepoIssues).toHaveBeenLastCalledWith(
                expect.objectContaining({ query: 'startup crash', page: 1 }),
            )
        })

        fireEvent.click(screen.getByText('已关闭'))
        await waitFor(() => {
            expect(fetchRepoIssues).toHaveBeenLastCalledWith(
                expect.objectContaining({ state: 'closed', page: 1 }),
            )
        })
    })

    it('加载失败时应展示错误并允许重试', async () => {
        vi.mocked(fetchRepoIssues).mockRejectedValue({ userMessage: '请求过于频繁，请稍后重试' })
        render(<RepoIssuesModal {...defaultProps} />)

        expect(await screen.findByText('Issues 加载失败')).toBeInTheDocument()
        expect(screen.getByText('请求过于频繁，请稍后重试')).toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: /重\s*试/ }))
        await waitFor(() => {
            expect(fetchRepoIssues).toHaveBeenCalledTimes(2)
        })
    })

    it('点击关闭按钮时应通知页面关闭弹框', async () => {
        vi.mocked(fetchRepoIssues).mockResolvedValue(issueResult)
        const onClose = vi.fn()
        const { container } = render(<RepoIssuesModal {...defaultProps} onClose={onClose} />)
        await screen.findByText('Fix startup crash')

        const closeButton = container.ownerDocument.querySelector<HTMLButtonElement>('.ant-modal-close')
        expect(closeButton).not.toBeNull()
        fireEvent.click(closeButton!)

        expect(onClose).toHaveBeenCalledOnce()
    })
})
