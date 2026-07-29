import { Button, Switch, Row, Col, Tag, Typography } from 'antd'
import { ClearOutlined, DownloadOutlined, CopyOutlined } from '@ant-design/icons'

const { Text } = Typography

export interface StarActionBarProps {
    keyword: string
    languageStr: string
    timeFilterSummary: string
    untranslatedOnly: boolean
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
    onToggleUntranslated: (checked: boolean) => void
}

/** Star 列表操作栏：筛选摘要 Tag + 批量操作按钮 */
export default function StarActionBar({
    keyword,
    languageStr,
    timeFilterSummary,
    untranslatedOnly,
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
    onToggleUntranslated,
}: StarActionBarProps) {
    return (
        <>
            {/* 激活的筛选条件摘要 */}
            {hasActiveFilters && (
                <Row style={{ marginTop: 4 }}>
                    <Col span={24}>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
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
                            {untranslatedOnly && (
                                <Tag closable onClose={() => onRemoveFilter('untranslatedOnly')} color='orange'>
                                    仅未翻译
                                </Tag>
                            )}
                            <Button size='small' icon={<ClearOutlined />} onClick={onClearFilters} type='link' style={{ padding: '0 4px' }}>
                                清除全部
                            </Button>
                        </div>
                    </Col>
                </Row>
            )}
            <Row gutter={[8, 8]} style={{ marginTop: hasActiveFilters ? 4 : 8 }}>
                <Col span={24}>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                        {hasActiveFilters && (
                            <Button icon={<ClearOutlined />} onClick={onClearFilters}>
                                清除
                            </Button>
                        )}
                        <Button
                            icon={<CopyOutlined />}
                            onClick={onOpenCloneWizard}
                            disabled={selectedCount === 0}
                            loading={loadingRepos}
                        >
                            批量克隆 {selectedCount > 0 ? `(${selectedCount})` : ''}
                        </Button>
                        <Button
                            icon={<DownloadOutlined />}
                            onClick={onOpenDownloadWizard}
                            disabled={selectedCount === 0}
                            loading={loadingRepos}
                        >
                            批量下载 {selectedCount > 0 ? `(${selectedCount})` : ''}
                        </Button>
                        <Button icon={<DownloadOutlined />} onClick={onExportMd} loading={exportingMd}>
                            导出MD
                        </Button>
                        <Button type='primary' icon={<DownloadOutlined />} onClick={onExportUrls} loading={exportingUrls}>
                            导出链接
                        </Button>
                        <Switch
                            checked={untranslatedOnly}
                            onChange={onToggleUntranslated}
                            checkedChildren='仅未翻译'
                            unCheckedChildren='全部'
                        />
                    </div>
                </Col>
            </Row>
        </>
    )
}
