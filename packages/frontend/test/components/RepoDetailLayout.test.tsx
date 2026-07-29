import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import RepoHeader from '../../src/components/repo/RepoHeader'
import RepoReadmeCard from '../../src/components/repo/RepoReadmeCard'
import type { GithubRepo } from '../../src/types'
import indexCss from '../../src/index.css?raw'

vi.mock('../../src/components/common/MarkdownRenderer', () => ({
    default: ({ content }: { content: string }) => <div data-testid='markdown-renderer'>{content}</div>,
}))

const repo = {
    id: 332,
    fullName: 'sindresorhus/awesome',
    ownerName: 'sindresorhus',
    ownerAvatarUrl: 'https://example.com/avatar.png',
    description: 'Awesome lists about all kinds of interesting topics',
    descriptionCn: '精选的有趣主题资源列表',
    htmlUrl: 'https://github.com/sindresorhus/awesome',
    homepage: null,
    openIssuesCount: 97,
    isFork: false,
    isArchived: false,
    readmeFetched: true,
    readmeOriginal: '# Awesome',
    readmeCn: '# 中文版 Awesome',
} as GithubRepo

describe('仓库详情响应式布局', () => {
    it('仓库头部应保持响应式布局并优先展示已有中文描述', () => {
        const { container } = render(
            <RepoHeader repo={repo} />,
        )

        expect(container.querySelector('.repo-header')).not.toBeNull()
        expect(container.querySelector('.repo-header-info')).not.toBeNull()
        expect(container.querySelector('.repo-header-actions')).not.toBeNull()
        expect(indexCss).toContain('@media (max-width: 575.98px)')
        expect(indexCss).toContain('.repo-header-actions')
        expect(indexCss).toContain('flex-direction: column')
        expect(screen.getByText(repo.descriptionCn!)).toBeInTheDocument()
        expect(screen.queryByText(repo.description!)).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: /翻译/ })).not.toBeInTheDocument()
    })

    it('README 卡片应优先展示已有中文内容和查看入口', () => {
        render(<RepoReadmeCard repo={repo} />)

        expect(screen.getByText('README 中文')).toBeInTheDocument()
        expect(screen.getByTestId('markdown-renderer')).toHaveTextContent(repo.readmeCn!)
        expect(screen.getByRole('button', { name: /放大查看/ })).toBeInTheDocument()
        expect(screen.queryByText(repo.readmeOriginal!)).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: /翻译/ })).not.toBeInTheDocument()
    })

    it('中文内容缺失时应回退展示 GitHub 原文', () => {
        const repoWithoutChinese = { ...repo, descriptionCn: null, readmeCn: null }

        render(
            <>
                <RepoHeader repo={repoWithoutChinese} />
                <RepoReadmeCard repo={repoWithoutChinese} />
            </>,
        )

        expect(screen.getByText(repo.description!)).toBeInTheDocument()
        expect(screen.getByText('README 原文')).toBeInTheDocument()
        expect(screen.getByTestId('markdown-renderer')).toHaveTextContent(repo.readmeOriginal!)
        expect(screen.queryByRole('button', { name: /翻译/ })).not.toBeInTheDocument()
    })
})
