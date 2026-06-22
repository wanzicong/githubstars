import { Card, Row, Col, Spin, Empty, Button, Pagination, Checkbox } from 'antd'
import type { GithubRepo, PageResult } from '../../types'
import RepoCard from './RepoCard'
import RepoRow from './RepoRow'
import { PAGE_SIZE_OPTIONS_SMALL } from '../../constants'

export interface StarRepoViewProps {
    repos: GithubRepo[]
    pageResult: PageResult<GithubRepo>
    viewMode: 'grid' | 'list'
    loading: boolean
    hasActiveFilters: boolean
    currentPage: number
    pageSize: number
    onClearFilters: () => void
    onPageChange: (page: number, size: number) => void
    /** 多选模式：选中的仓库 ID 列表 */
    selectedIds?: number[]
    /** 多选模式：选中变更回调 */
    onSelectionChange?: (ids: number[]) => void
    /** 分类变更回调（刷新列表） */
    onCategoryChange?: () => void
}

/**
 * Star 仓库列表视图（网格/列表模式）+ 分页
 *
 * 根据 viewMode 渲染 RepoCard 或 RepoRow，底部带分页器。
 */
export default function StarRepoView({
    repos,
    pageResult,
    viewMode,
    loading,
    hasActiveFilters,
    currentPage,
    pageSize,
    onClearFilters,
    onPageChange,
    selectedIds,
    onSelectionChange,
    onCategoryChange,
}: StarRepoViewProps) {
    const selectionEnabled = !!onSelectionChange

    const toggleSelect = (id: number) => {
        if (!onSelectionChange || !selectedIds) return
        if (selectedIds.includes(id)) {
            onSelectionChange(selectedIds.filter((i) => i !== id))
        } else {
            onSelectionChange([...selectedIds, id])
        }
    }

    const allPageIds = repos.map((r) => r.id)
    const allSelected = selectionEnabled && allPageIds.length > 0 && allPageIds.every((id) => selectedIds?.includes(id))

    const toggleSelectAll = () => {
        if (!onSelectionChange || !selectedIds) return
        if (allSelected) {
            onSelectionChange(selectedIds.filter((id) => !allPageIds.includes(id)))
        } else {
            const newIds = [...new Set([...selectedIds, ...allPageIds])]
            onSelectionChange(newIds)
        }
    }
    return (
        <>
            <Spin spinning={loading}>
                {selectionEnabled && repos.length > 0 && (
                    <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Checkbox checked={allSelected} onChange={toggleSelectAll}>
                            全选当页
                        </Checkbox>
                        {selectedIds && selectedIds.length > 0 && (
                            <span style={{ color: '#1677ff', fontSize: 13 }}>已选 {selectedIds.length} 个</span>
                        )}
                    </div>
                )}
                {repos.length > 0 ? (
                    viewMode === 'list' ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {repos.map((repo) => (
                                <div key={repo.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                                    {selectionEnabled && (
                                        <Checkbox
                                            checked={selectedIds?.includes(repo.id)}
                                            onChange={() => toggleSelect(repo.id)}
                                            style={{ marginTop: 12 }}
                                        />
                                    )}
                                    <div style={{ flex: 1 }}>
                                        <RepoRow repo={repo} onCategoryChange={onCategoryChange} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <Row gutter={[16, 16]}>
                            {repos.map((repo) => (
                                <Col key={repo.id} xs={24} sm={12} md={8} lg={6}>
                                    <div style={{ position: 'relative' }}>
                                        {selectionEnabled && (
                                            <Checkbox
                                                checked={selectedIds?.includes(repo.id)}
                                                onChange={() => toggleSelect(repo.id)}
                                                style={{ position: 'absolute', top: 8, left: 8, zIndex: 1 }}
                                            />
                                        )}
                                        <RepoCard repo={repo} onCategoryChange={onCategoryChange} />
                                    </div>
                                </Col>
                            ))}
                        </Row>
                    )
                ) : (
                    <Card>
                        <Empty
                            description={
                                loading
                                    ? '加载中...'
                                    : pageResult.total === 0
                                      ? '暂无仓库数据，请先同步'
                                      : '筛选无结果，请尝试调整筛选条件'
                            }
                        >
                            {hasActiveFilters && (
                                <Button type='primary' onClick={onClearFilters}>
                                    清除所有筛选
                                </Button>
                            )}
                        </Empty>
                    </Card>
                )}

                {pageResult.total > pageSize && (
                    <div style={{ marginTop: 20, display: 'flex', justifyContent: 'center' }}>
                        <Pagination
                            current={currentPage}
                            pageSize={pageSize}
                            total={pageResult.total}
                            showSizeChanger
                            pageSizeOptions={PAGE_SIZE_OPTIONS_SMALL.map(String)}
                            showQuickJumper
                            showTotal={(total) => `共 ${total} 条 / ${pageResult.pages} 页`}
                            onChange={onPageChange}
                        />
                    </div>
                )}
            </Spin>
        </>
    )
}
