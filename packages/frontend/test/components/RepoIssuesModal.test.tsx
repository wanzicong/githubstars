import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import RepoIssuesModal from '../../src/components/repo/RepoIssuesModal'
import { fetchRepoIssueDetail, fetchRepoIssues } from '../../src/api'
import type { GithubIssueDetail, GithubIssueListResult } from '../../src/types'

vi.mock('../../src/api', () => ({
    fetchRepoIssueDetail: vi.fn(),
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
            labels: [{ name: 'bug', color: 'd73a4a', description: 'Something is broken' }],
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

const issueDetail: GithubIssueDetail = {
    ...issueResult.items[0],
    body: 'Issue body with **important details**.',
    authorAssociation: 'MEMBER',
    activeLockReason: null,
    reactions: {
        totalCount: 3,
        plusOne: 2,
        minusOne: 0,
        laugh: 0,
        hooray: 0,
        confused: 0,
        heart: 1,
        rocket: 0,
        eyes: 0,
    },
    commentItems: [
        {
            id: 201,
            body: 'Thanks for the detailed report.',
            htmlUrl: 'https://github.com/openai/codex/issues/42#issuecomment-201',
            user: {
                login: 'maintainer',
                avatarUrl: 'https://example.com/maintainer.png',
                htmlUrl: 'https://github.com/maintainer',
            },
            authorAssociation: 'MEMBER',
            reactions: {
                totalCount: 0,
                plusOne: 0,
                minusOne: 0,
                laugh: 0,
                hooray: 0,
                confused: 0,
                heart: 0,
                rocket: 0,
                eyes: 0,
            },
            createdAt: '2026-07-03T00:00:00Z',
            updatedAt: '2026-07-03T00:00:00Z',
        },
    ],
    commentsTruncated: true,
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
        expect(await screen.findByRole('button', { name: '查看 Issue #42 详情' })).toBeInTheDocument()
        expect(screen.getByText('bug')).toBeInTheDocument()
        expect(screen.getByLabelText('3 条评论')).toBeInTheDocument()
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

    it('点击列表项应进入站内详情并可返回原列表', async () => {
        vi.mocked(fetchRepoIssues).mockResolvedValue(issueResult)
        vi.mocked(fetchRepoIssueDetail).mockResolvedValue(issueDetail)
        render(<RepoIssuesModal {...defaultProps} />)

        fireEvent.click(await screen.findByRole('button', { name: '查看 Issue #42 详情' }))

        expect(await screen.findByText('important details')).toBeInTheDocument()
        expect(screen.getByText('Thanks for the detailed report.')).toBeInTheDocument()
        expect(screen.getByText('站内展示前 1 条评论')).toBeInTheDocument()
        expect(fetchRepoIssueDetail).toHaveBeenCalledWith({ repoId: 332, issueNumber: 42 })

        fireEvent.click(screen.getByRole('button', { name: /返回列表/ }))
        expect(screen.getByRole('button', { name: '查看 Issue #42 详情' })).toBeInTheDocument()
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
            expect(fetchRepoIssues).toHaveBeenLastCalledWith(expect.objectContaining({ query: 'startup crash', page: 1 }))
        })

        fireEvent.click(screen.getByText('已关闭'))
        await waitFor(() => {
            expect(fetchRepoIssues).toHaveBeenLastCalledWith(expect.objectContaining({ state: 'closed', page: 1 }))
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
