import { Button, Tag, Typography } from 'antd'
import { ClearOutlined, DownloadOutlined, CopyOutlined } from '@ant-design/icons'

const { Text } = Typography

export interface StarActionBarProps {
    keyword: string
    languageStr: string
    timeFilterSummary: string
    categoryLabel: string | null
    hasActiveFilters: boolean
    selectedCount: number
    loadingRepos: boolean
    exportingMd: boolean
    exportingUrls: boolean
    onClearFilters: () => void
    onRemoveFilter: (key: string) => void
    onOpenCloneWizard: () => void
    onOpenDownloadWizard: () => void
    onExportMd: () => void
    onExportUrls: () => void
}

/** 筛选摘要行（有筛选时出现）+ 批量操作工具行（有选中时出现） */
export default function StarActionBar({
    keyword,
    languageStr,
    timeFilterSummary,
    categoryLabel,
    hasActiveFilters,
    selectedCount,
    loadingRepos,
    exportingMd,
    exportingUrls,
    onClearFilters,
    onRemoveFilter,
    onOpenCloneWizard,
    onOpenDownloadWizard,
    onExportMd,
    onExportUrls,
}: StarActionBarProps) {
    return (
        <>
            {/* 激活的筛选条件摘要（含分类），仅在有筛选时渲染 */}
            {hasActiveFilters && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginTop: 12 }}>
                    <Text type='secondary' style={{ fontSize: 12 }}>当前筛选：</Text>
                    {keyword && (
                        <Tag closable onClose={() => onRemoveFilter('keyword')} color='blue'>
                            关键词: {keyword}
                        </Tag>
                    )}
                    {languageStr && (
                        <Tag closable onClose={() => onRemoveFilter('languages')} color='green'>
                            语言: {languageStr}
                        </Tag>
                    )}
                    {timeFilterSummary && (
                        <Tag closable onClose={() => onRemoveFilter('time')} color='purple'>
                            时间: {timeFilterSummary}
                        </Tag>
                    )}
                    {categoryLabel && (
                        <Tag closable onClose={() => onRemoveFilter('categoryId')} color='orange'>
                            分类: {categoryLabel}
                        </Tag>
                    )}
                    <Button size='small' icon={<ClearOutlined />} onClick={onClearFilters} type='link' style={{ padding: '0 4px' }}>
                        清除全部
                    </Button>
                </div>
            )}

            {/* 批量操作工具行：仅在选中仓库时出现；导出降级为普通按钮右对齐 */}
            {selectedCount > 0 && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 16 }}>
                    <Text type='secondary' style={{ fontSize: 13 }}>
                        已选 <Text strong style={{ fontSize: 13 }}>{selectedCount}</Text> 项
                    </Text>
                    <Button type='primary' icon={<CopyOutlined />} onClick={onOpenCloneWizard} loading={loadingRepos}>
                        批量克隆 ({selectedCount})
                    </Button>
                    <Button icon={<DownloadOutlined />} onClick={onOpenDownloadWizard} loading={loadingRepos}>
                        批量下载 ({selectedCount})
                    </Button>
                    <div style={{ flex: 1 }} />
                    <Button icon={<DownloadOutlined />} onClick={onExportMd} loading={exportingMd}>
                        导出MD
                    </Button>
                    <Button icon={<DownloadOutlined />} onClick={onExportUrls} loading={exportingUrls}>
                        导出链接
                    </Button>
                </div>
            )}
        </>
    )
}
