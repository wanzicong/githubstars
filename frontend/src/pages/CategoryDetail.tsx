import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import {
    Card,
    Button,
    Input,
    Select,
    Breadcrumb,
    Descriptions,
    Empty,
    Spin,
    Typography,
    App,
    Row,
    Col,
    Space,
    Pagination,
    Segmented,
} from 'antd'
import {
    ArrowLeftOutlined,
    ThunderboltOutlined,
    FolderOutlined,
    ClearOutlined,
    AppstoreOutlined,
    UnorderedListOutlined,
} from '@ant-design/icons'
import * as categoriesApi from '../api/categories'
import * as statsApi from '../api/stats'
import RepoCard from '../components/RepoCard'
import RepoRow from '../components/RepoRow'
import type { Category, GithubRepo, PageResult, LanguageStatsDTO } from '../types'
import dayjs from 'dayjs'

const { Title, Paragraph, Text } = Typography

const SORT_BY_OPTIONS = [
    { label: 'Star 时间', value: 'starred_at' },
    { label: 'Star 数量', value: 'stars_count' },
    { label: 'Fork 数量', value: 'forks_count' },
    { label: '最近更新', value: 'repo_updated_at' },
    { label: '创建时间', value: 'repo_created_at' },
    { label: '推送时间', value: 'repo_pushed_at' },
]

const SORT_ORDER_OPTIONS = [
    { label: '降序', value: 'desc' },
    { label: '升序', value: 'asc' },
]

const PAGE_SIZE_OPTIONS = [12, 24, 48]

function formatDateTime(value: string | null): string {
    if (!value) return '-'
    return dayjs(value).format('YYYY-MM-DD HH:mm:ss')
}

export default function CategoryDetail() {
    const { id } = useParams<{ id: string }>()
    const { message, modal } = App.useApp()
    const navigate = useNavigate()
    const [searchParams, setSearchParams] = useSearchParams()

    // 从 URL 参数读取筛选条件
    const keyword = searchParams.get('keyword') || ''
    const selectedLanguages = searchParams.get('languages') ? searchParams.get('languages')!.split(',') : []
    const sortBy = searchParams.get('sortBy') || 'starred_at'
    const sortOrder = searchParams.get('sortOrder') || 'desc'
    const currentPage = parseInt(searchParams.get('page') || '1', 10)
    const pageSize = parseInt(searchParams.get('size') || '12', 10)

    const [category, setCategory] = useState<Category | null>(null)
    const [languageOptions, setLanguageOptions] = useState<LanguageStatsDTO[]>([])
    const [reclassifying, setReclassifying] = useState(false)
    const [loading, setLoading] = useState(false)
    const [reposLoading, setReposLoading] = useState(false)
    const viewMode = (searchParams.get('view') || 'list') as 'grid' | 'list'

    // 分页数据
    const [pageResult, setPageResult] = useState<PageResult<GithubRepo>>({
        records: [],
        total: 0,
        size: 12,
        current: 1,
        pages: 0,
    })

    const setUrlParam = useCallback(
        (key: string, value: string | null) => {
            setSearchParams((prev) => {
                const next = new URLSearchParams(prev)
                if (!value) next.delete(key)
                else next.set(key, value)
                if (key !== 'page') next.delete('page')
                return next
            })
        },
        [setSearchParams],
    )

    const fetchData = async () => {
        setLoading(true)
        try {
            const data = await categoriesApi.fetchAllCategories()
            // 递归搜索树形结构(L1+children), 匹配任意层级的分类
            const findInTree = (cats: typeof data): (typeof data)[0] | undefined => {
                for (const cat of cats) {
                    if (cat.id === Number(id)) return cat
                    if (cat.children?.length > 0) {
                        const found = findInTree(cat.children)
                        if (found) return found
                    }
                }
                return undefined
            }
            const current = findInTree(data)
            if (current) setCategory(current)
        } catch {
            message.error('获取分类信息失败')
        } finally {
            setLoading(false)
        }
    }

    const fetchRepos = async () => {
        if (!id) return
        setReposLoading(true)
        try {
            const result = await categoriesApi.fetchReposByCategoryIdPaged(Number(id), {
                page: currentPage,
                size: pageSize,
                keyword: keyword || undefined,
                language: selectedLanguages.length > 0 ? selectedLanguages.join(',') : undefined,
                sortBy,
                sortOrder,
            })
            setPageResult(result)
        } catch {
            message.error('获取仓库列表失败')
        } finally {
            setReposLoading(false)
        }
    }

    useEffect(() => {
        if (id) fetchData()
        // 加载语言选项（用于筛选下拉框）
        statsApi
            .fetchLanguageStats()
            .then(setLanguageOptions)
            .catch(() => {})
    }, [id])

    useEffect(() => {
        if (id) fetchRepos()
    }, [id, currentPage, pageSize, keyword, selectedLanguages.join(','), sortBy, sortOrder])

    const handleClearFilters = () => {
        const next = new URLSearchParams()
        next.set('sortBy', 'starred_at')
        next.set('sortOrder', 'desc')
        setSearchParams(next)
    }

    const handleReclassify = () => {
        if (!category) return
        modal.confirm({
            title: 'AI 重分类',
            content: `将对分类「${category.name}」下的仓库使用 AI 重新进行分类，可能需要一些时间。是否继续？`,
            okText: '开始重分类',
            cancelText: '取消',
            onOk: async () => {
                setReclassifying(true)
                try {
                    const res = await categoriesApi.reclassifyCategory(category.id, 8)
                    if (res.success) {
                        message.success('AI 重分类任务已触发，请稍后刷新查看结果')
                        fetchData()
                        fetchRepos()
                    } else {
                        message.error(res.message || 'AI 重分类失败')
                    }
                } catch {
                    message.error('AI 重分类请求失败，请稍后重试')
                } finally {
                    setReclassifying(false)
                }
            },
        })
    }

    const hasActiveFilters = keyword !== '' || selectedLanguages.length > 0

    const { records: repos } = pageResult

    if (loading && !category) {
        return (
            <div style={{ textAlign: 'center', paddingTop: 100 }}>
                <Spin size='large' />
            </div>
        )
    }

    if (!loading && !category) {
        return (
            <div>
                <Breadcrumb
                    items={[{ title: <a onClick={() => navigate('/categories')}>分类管理</a> }, { title: '未找到' }]}
                    style={{ marginBottom: 24 }}
                />
                <Empty description='分类不存在或已被删除' />
                <div style={{ textAlign: 'center', marginTop: 16 }}>
                    <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/categories')}>
                        返回分类列表
                    </Button>
                </div>
            </div>
        )
    }

    return (
        <div>
            <Breadcrumb
                items={[{ title: <a onClick={() => navigate('/categories')}>分类管理</a> }, { title: category?.name }]}
                style={{ marginBottom: 24 }}
            />

            <Spin spinning={loading}>
                {/* 分类信息头部 */}
                <Card style={{ marginBottom: 24 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                        <div>
                            <Title level={4} style={{ marginBottom: 4 }}>
                                <FolderOutlined style={{ marginRight: 8 }} />
                                {category?.name}
                            </Title>
                            {category?.description && (
                                <Paragraph type='secondary' style={{ marginBottom: 12, maxWidth: 600 }}>
                                    {category.description}
                                </Paragraph>
                            )}
                            <Descriptions size='small' column={3}>
                                <Descriptions.Item label='仓库数量'>{pageResult.total || (category?.repoCount ?? 0)}</Descriptions.Item>
                                <Descriptions.Item label='排序'>{category?.sortOrder ?? 0}</Descriptions.Item>
                                <Descriptions.Item label='创建时间'>{formatDateTime(category?.createdAt ?? null)}</Descriptions.Item>
                                <Descriptions.Item label='更新时间'>{formatDateTime(category?.updatedAt ?? null)}</Descriptions.Item>
                            </Descriptions>
                        </div>
                        <Button type='primary' icon={<ThunderboltOutlined />} onClick={handleReclassify} loading={reclassifying}>
                            AI 重分类
                        </Button>
                    </div>
                </Card>

                {/* 搜索筛选栏 */}
                <Card style={{ marginBottom: 20 }}>
                    <Space direction='vertical' size='middle' style={{ width: '100%' }}>
                        <Row gutter={[8, 12]} align='middle' style={{ flexWrap: 'wrap' }}>
                            <Col xs={24} sm={12} md={8} lg={6}>
                                <Input.Search
                                    placeholder='搜索仓库名、描述...'
                                    defaultValue={keyword}
                                    onSearch={(val) => setUrlParam('keyword', val || null)}
                                    onChange={(e) => {
                                        if (!e.target.value) setUrlParam('keyword', null)
                                    }}
                                    allowClear
                                />
                            </Col>
                            <Col xs={24} sm={12} md={10} lg={7}>
                                <Select
                                    mode='multiple'
                                    placeholder='筛选语言'
                                    value={selectedLanguages}
                                    onChange={(vals) => setUrlParam('languages', vals.length > 0 ? vals.join(',') : null)}
                                    allowClear
                                    showSearch
                                    maxTagCount={3}
                                    style={{ width: '100%' }}
                                    options={languageOptions.map((lang) => ({
                                        label: `${lang.language} (${lang.count})`,
                                        value: lang.language,
                                    }))}
                                    filterOption={(input, option) => (option?.label as string)?.toLowerCase().includes(input.toLowerCase())}
                                />
                            </Col>
                            <Col xs={12} sm={8} md={6} lg={4}>
                                <Select
                                    value={sortBy}
                                    onChange={(val) => setUrlParam('sortBy', val)}
                                    options={SORT_BY_OPTIONS}
                                    style={{ width: '100%' }}
                                />
                            </Col>
                            <Col xs={12} sm={8} md={6} lg={3}>
                                <Select
                                    value={sortOrder}
                                    onChange={(val) => setUrlParam('sortOrder', val)}
                                    options={SORT_ORDER_OPTIONS}
                                    style={{ width: '100%' }}
                                />
                            </Col>
                            <Col xs={24} sm={24} md={24} lg={4} style={{ display: 'flex', gap: 8 }}>
                                {hasActiveFilters && (
                                    <Button icon={<ClearOutlined />} onClick={handleClearFilters}>
                                        清除
                                    </Button>
                                )}
                                <Segmented
                                    value={viewMode}
                                    onChange={(val) => setUrlParam('view', val === 'list' ? null : (val as string))}
                                    options={[
                                        { value: 'grid', icon: <AppstoreOutlined /> },
                                        { value: 'list', icon: <UnorderedListOutlined /> },
                                    ]}
                                />
                                <Text type='secondary' style={{ lineHeight: '32px' }}>
                                    共 {pageResult.total} 个仓库
                                </Text>
                            </Col>
                        </Row>
                    </Space>
                </Card>

                <Spin spinning={reposLoading}>
                    {repos.length > 0 ? (
                        <>
                            {viewMode === 'list' ? (
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
                            )}
                            {pageResult.total > pageSize && (
                                <div style={{ marginTop: 20, display: 'flex', justifyContent: 'center' }}>
                                    <Pagination
                                        current={currentPage}
                                        pageSize={pageSize}
                                        total={pageResult.total}
                                        showSizeChanger
                                        pageSizeOptions={PAGE_SIZE_OPTIONS.map(String)}
                                        showQuickJumper
                                        showTotal={(total) => `共 ${total} 条 / ${pageResult.pages} 页`}
                                        onChange={(page, size) => {
                                            setUrlParam('page', String(page))
                                            if (size !== pageSize) setUrlParam('size', String(size))
                                        }}
                                    />
                                </div>
                            )}
                        </>
                    ) : (
                        !reposLoading && (
                            <Card>
                                <Empty description={hasActiveFilters ? '筛选无结果，请尝试调整筛选条件' : '该分类下暂无仓库'}>
                                    {hasActiveFilters && (
                                        <Button type='primary' onClick={handleClearFilters}>
                                            清除所有筛选
                                        </Button>
                                    )}
                                </Empty>
                            </Card>
                        )
                    )}
                </Spin>

                <div style={{ marginTop: 16, textAlign: 'center' }}>
                    <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/categories')}>
                        返回分类列表
                    </Button>
                </div>
            </Spin>
        </div>
    )
}
