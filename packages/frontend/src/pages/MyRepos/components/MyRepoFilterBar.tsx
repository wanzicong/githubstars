import { Input, Select, Space, Segmented, Tooltip } from 'antd'
import { SearchOutlined, LockOutlined, GlobalOutlined } from '@ant-design/icons'
import type { LanguageStatsDTO } from '@/types'

/** 我的仓库排序字段选项（无 starred_at，默认值由后端兜底 repo_updated_at） */
const SORT_FIELD_OPTIONS = [
    { value: 'repo_updated_at', label: '按更新时间' },
    { value: 'repo_created_at', label: '按创建时间' },
    { value: 'repo_pushed_at', label: '按推送时间' },
    { value: 'stars_count', label: '按 Star 数' },
    { value: 'forks_count', label: '按 Fork 数' },
]

const SORT_ORDER_OPTIONS = [
    { value: 'desc', label: '降序' },
    { value: 'asc', label: '升序' },
]

/** 私有/公开筛选值（all 表示全部） */
export type PrivacyFilter = 'all' | 'private' | 'public'

interface MyRepoFilterBarProps {
    keyword: string
    language: string
    sortBy: string
    sortOrder: string
    privacy: PrivacyFilter
    languageOptions: LanguageStatsDTO[]
    onKeywordChange: (v: string) => void
    onLanguageChange: (v: string) => void
    onSortByChange: (v: string) => void
    onSortOrderChange: (v: string) => void
    onPrivacyChange: (v: PrivacyFilter) => void
}

/**
 * 我的仓库筛选栏 — 主行筛选（关键词/语言/排序/私有公开）。
 * 相比星标仓库筛选栏精简掉时间预设与高级筛选（我的仓库总量小，v1 不需要）。
 */
export default function MyRepoFilterBar({
    keyword, language, sortBy, sortOrder, privacy, languageOptions,
    onKeywordChange, onLanguageChange, onSortByChange, onSortOrderChange, onPrivacyChange,
}: MyRepoFilterBarProps) {
    return (
        <Space wrap size={12} style={{ width: '100%' }}>
            <Input
                allowClear
                prefix={<SearchOutlined style={{ color: '#999' }} />}
                placeholder='搜索仓库名 / 描述'
                value={keyword}
                onChange={(e) => onKeywordChange(e.target.value)}
                style={{ width: 260 }}
            />
            <Select
                allowClear
                showSearch
                placeholder='语言'
                value={language || undefined}
                onChange={(v) => onLanguageChange(v ?? '')}
                options={languageOptions.map((l) => ({ value: l.language, label: `${l.language} (${l.count})` }))}
                style={{ width: 180 }}
            />
            <Select
                value={sortBy}
                onChange={onSortByChange}
                options={SORT_FIELD_OPTIONS}
                style={{ width: 140 }}
            />
            <Select
                value={sortOrder}
                onChange={onSortOrderChange}
                options={SORT_ORDER_OPTIONS}
                style={{ width: 90 }}
            />
            <Tooltip title='筛选私有/公开仓库'>
                <Segmented
                    value={privacy}
                    onChange={(v) => onPrivacyChange(v as PrivacyFilter)}
                    options={[
                        { value: 'all', label: '全部' },
                        { value: 'private', label: '私有', icon: <LockOutlined /> },
                        { value: 'public', label: '公开', icon: <GlobalOutlined /> },
                    ]}
                />
            </Tooltip>
        </Space>
    )
}
