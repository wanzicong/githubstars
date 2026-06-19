import { Card, Row, Col, Spin, Empty, Button, Pagination } from 'antd'
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
}: StarRepoViewProps) {
    return (
        <>
            <Spin spinning={loading}>
                {repos.length > 0 ? (
                    viewMode === 'list' ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {repos.map((repo) => (
                                <RepoRow key={repo.id} repo={repo} />
                            ))}
                        </div>
                    ) : (
                        <Row gutter={[16, 16]}>
                            {repos.map((repo) => (
                                <Col key={repo.id} xs={24} sm={12} md={8} lg={6}>
                                    <RepoCard repo={repo} />
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
