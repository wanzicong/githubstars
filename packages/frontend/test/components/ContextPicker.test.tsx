/**
 * ContextPicker 单元测试 —— 一体化输入框版
 * 覆盖：chip 展示/折叠/删除、弹层仓库列表勾选与对齐结构、已选行清空、分类树勾选
 */
import React from 'react'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App as AntApp, ConfigProvider } from 'antd'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ContextPicker, { type ChatContextItem } from '../../src/pages/AgentChat/ContextPicker'

const { fetchStarList, fetchCategoryTree } = vi.hoisted(() => ({
    fetchStarList: vi.fn(),
    fetchCategoryTree: vi.fn(),
}))

vi.mock('@/api', () => ({ fetchStarList, fetchCategoryTree }))

const REPO = (id: number, fullName: string, starsCount = 1000) => ({
    id,
    repoName: fullName.split('/')[1],
    fullName,
    description: null,
    descriptionCn: null,
    readmeCn: null,
    readmeOriginal: null,
    readmeFetched: false,
    language: null,
    ownerName: fullName.split('/')[0],
    ownerAvatarUrl: '',
    htmlUrl: '',
    homepage: null,
    starsCount,
    forksCount: 0,
    watchersCount: 0,
    openIssuesCount: 0,
    topics: null,
    licenseName: null,
    isFork: false,
    isArchived: false,
    repoSize: null,
    defaultBranch: null,
    visibility: null,
    repoCreatedAt: null,
    repoUpdatedAt: null,
    repoPushedAt: null,
    starredAt: null,
})

function renderPicker(value: ChatContextItem[] = [], onChange = vi.fn()) {
    render(
        <ConfigProvider>
            <AntApp>
                <ContextPicker value={value} onChange={onChange} />
            </AntApp>
        </ConfigProvider>,
    )
    return onChange
}

describe('ContextPicker', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        fetchStarList.mockResolvedValue({ records: [REPO(1, 'facebook/react', 234000), REPO(2, 'vuejs/core', 48000)] })
        fetchCategoryTree.mockResolvedValue([{ id: 10, name: '前端框架', repoCount: 12, children: [] }])
    })

    it('未选上下文时只渲染「＋」按钮，无 chip 区', () => {
        renderPicker([])
        expect(screen.getByRole('button', { name: '添加上下文' })).toBeInTheDocument()
        expect(screen.queryByText('＋')).toBeNull()
    })

    it('选中 3 个以内 chip 全部展示', () => {
        const items: ChatContextItem[] = [
            { type: 'repo', id: 1, label: 'facebook/react' },
            { type: 'repo', id: 2, label: 'vuejs/core' },
            { type: 'category', id: 10, label: '前端框架' },
        ]
        renderPicker(items)
        expect(screen.getByText('facebook/react')).toBeInTheDocument()
        expect(screen.getByText('vuejs/core')).toBeInTheDocument()
        expect(screen.getByText('前端框架')).toBeInTheDocument()
        expect(screen.queryByText(/^\+\d+$/)).toBeNull()
    })

    it('选中超过 3 个时折叠为 3 个 + +N', () => {
        const items: ChatContextItem[] = [
            { type: 'repo', id: 1, label: 'a/one' },
            { type: 'repo', id: 2, label: 'b/two' },
            { type: 'repo', id: 3, label: 'c/three' },
            { type: 'repo', id: 4, label: 'd/four' },
            { type: 'repo', id: 5, label: 'e/five' },
        ]
        renderPicker(items)
        expect(screen.getByText('a/one')).toBeInTheDocument()
        expect(screen.getByText('c/three')).toBeInTheDocument()
        expect(screen.queryByText('d/four')).toBeNull()
        expect(screen.getByText('+2')).toBeInTheDocument()
    })

    it('chip 删除调用 onChange 移除该项', async () => {
        const items: ChatContextItem[] = [{ type: 'repo', id: 1, label: 'facebook/react' }]
        const onChange = renderPicker(items)
        await userEvent.click(screen.getByRole('button', { name: /close/i }))
        expect(onChange).toHaveBeenCalledWith([])
    })

    it('打开弹层展示仓库列表并可选中', async () => {
        const onChange = renderPicker([])
        await userEvent.click(screen.getByRole('button', { name: '添加上下文' }))
        const row = await screen.findByText('facebook/react')
        await userEvent.click(row)
        expect(onChange).toHaveBeenCalledWith([{ type: 'repo', id: 1, label: 'facebook/react' }])
    })

    it('弹层显示 star 数（formatNumberShort 格式）', async () => {
        renderPicker([])
        await userEvent.click(screen.getByRole('button', { name: '添加上下文' }))
        await screen.findByText('facebook/react')
        expect(screen.getByText('234.0K')).toBeInTheDocument()
    })

    it('已有选中项时弹层显示「已选 n 项」，清空按钮移除全部', async () => {
        const items: ChatContextItem[] = [{ type: 'repo', id: 1, label: 'facebook/react' }]
        const onChange = renderPicker(items)
        await userEvent.click(screen.getByRole('button', { name: '添加上下文' }))
        expect(await screen.findByText('已选 1 项')).toBeInTheDocument()
        await userEvent.click(screen.getByText('清空'))
        expect(onChange).toHaveBeenCalledWith([])
    })

    it('分类 Tab 勾选分类', async () => {
        const onChange = renderPicker([])
        await userEvent.click(screen.getByRole('button', { name: '添加上下文' }))
        await userEvent.click(await screen.findByRole('tab', { name: '分类' }))
        const tree = await screen.findByRole('tree')
        await userEvent.click(within(tree).getByText(/前端框架/))
        await waitFor(() => {
            expect(onChange).toHaveBeenCalledWith([{ type: 'category', id: 10, label: '前端框架' }])
        })
    })
})
