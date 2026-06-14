/**
 * 相似项目推荐缓存管理页面
 *
 * 展示 Agent 相似项目搜索的缓存结果，支持：
 * - 分页浏览所有缓存的相似推荐
 * - 查看缓存的 Markdown 内容（Modal 渲染）
 * - 逐条删除缓存
 * - 清空全部缓存
 *
 * @callers App.tsx（路由 /similar-cache）
 * @depends
 *   - fetchSimilarCacheList — 分页获取缓存列表
 *   - deleteSimilarCache — 删除单条缓存
 *   - deleteAllSimilarCache — 清空全部缓存
 *   - MarkdownRenderer — 渲染 Markdown 内容
 * @see agent-similar.ts — API 层
 */

import { useState, useEffect, useCallback } from 'react'
import {
    Table, Button, Modal, Typography, Space, Popconfirm,
    message, Tag, Card,
} from 'antd'
import {
    DeleteOutlined, ClearOutlined, EyeOutlined, ApartmentOutlined,
    ReloadOutlined,
} from '@ant-design/icons'
import {
    fetchSimilarCacheList, deleteSimilarCache, deleteAllSimilarCache,
    type SimilarCacheItem,
} from '../api/agent-similar'
import MarkdownRenderer from '../components/MarkdownRenderer'
import dayjs from '../setupDayjs'

const { Title, Text } = Typography

export default function SimilarCacheList() {
    const [records, setRecords] = useState<SimilarCacheItem[]>([])
    const [total, setTotal] = useState(0)
    const [page, setPage] = useState(1)
    const [pageSize, setPageSize] = useState(20)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    // 查看弹窗
    const [viewModalOpen, setViewModalOpen] = useState(false)
    const [viewRepo, setViewRepo] = useState('')
    const [viewContent, setViewContent] = useState('')

    // 操作 loading
    const [deletingId, setDeletingId] = useState<number | null>(null)
    const [clearingAll, setClearingAll] = useState(false)

    /** 加载数据 */
    const load = useCallback(async (p: number, ps: number) => {
        setLoading(true)
        setError('')
        try {
            const res = await fetchSimilarCacheList(p, ps)
            setRecords(res.records || [])
            setTotal(res.total || 0)
        } catch {
            setError('加载相似推荐缓存失败，请检查后端服务')
            message.error('加载失败')
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        load(page, pageSize)
    }, [page, pageSize, load])

    /** 查看缓存内容 */
    const handleView = (item: SimilarCacheItem) => {
        setViewRepo(item.repoFullName)
        setViewContent(item.content)
        setViewModalOpen(true)
    }

    /** 删除单条缓存 */
    const handleDelete = async (item: SimilarCacheItem) => {
        setDeletingId(item.id)
        try {
            const res = await deleteSimilarCache(item.id)
            if (res.success) {
                message.success(`已删除「${item.repoFullName}」的缓存`)
                // 如果删除后当前页无数据且非第一页，则回到上一页
                if (records.length === 1 && page > 1) {
                    setPage(page - 1)
                } else {
                    load(page, pageSize)
                }
            } else {
                message.error(res.message || '删除失败')
            }
        } catch {
            message.error('删除失败')
        } finally {
            setDeletingId(null)
        }
    }

    /** 清空全部缓存 */
    const handleClearAll = async () => {
        setClearingAll(true)
        try {
            const res = await deleteAllSimilarCache()
            if (res.success) {
                message.success(res.message || '已清空全部相似推荐缓存')
                setPage(1)
                load(1, pageSize)
            } else {
                message.error(res.message || '清空失败')
            }
        } catch {
            message.error('清空失败')
        } finally {
            setClearingAll(false)
        }
    }

    /** 格式化时间 */
    const formatTime = (t: string) => {
        if (!t) return '-'
        return dayjs(t).format('YYYY-MM-DD HH:mm')
    }

    const columns = [
        {
            title: '源仓库',
            dataIndex: 'repoFullName',
            key: 'repoFullName',
            width: 320,
            render: (_: string, r: SimilarCacheItem) => (
                <Space direction='vertical' size={2}>
                    <Text strong style={{ fontSize: 14 }}>{r.repoFullName}</Text>
                    <Space size={4}>
                        {r.repoLanguage && (
                            <Tag color='blue' style={{ fontSize: 11, margin: 0 }}>
                                {r.repoLanguage}
                            </Tag>
                        )}
                        <Tag color='orange' style={{ fontSize: 11, margin: 0 }}>
                            ★ {r.repoStars?.toLocaleString() || 0}
                        </Tag>
                    </Space>
                </Space>
            ),
        },
        {
            title: '推荐数量',
            dataIndex: 'similarCount',
            key: 'similarCount',
            width: 100,
            align: 'center' as const,
            render: (count: number) => (
                <Tag
                    color={count > 5 ? 'green' : count > 2 ? 'blue' : 'default'}
                    style={{ fontSize: 13, fontWeight: 500 }}
                >
                    {count || 0} 个
                </Tag>
            ),
        },
        {
            title: '更新时间',
            dataIndex: 'updatedAt',
            key: 'updatedAt',
            width: 160,
            render: (t: string) => (
                <Text type='secondary' style={{ fontSize: 13 }}>
                    {formatTime(t)}
                </Text>
            ),
        },
        {
            title: '操作',
            key: 'actions',
            width: 140,
            align: 'center' as const,
            render: (_: unknown, r: SimilarCacheItem) => (
                <Space size='small'>
                    <Button
                        type='link'
                        size='small'
                        icon={<EyeOutlined />}
                        onClick={() => handleView(r)}
                    >
                        查看
                    </Button>
                    <Popconfirm
                        title={`删除「${r.repoFullName}」的缓存？`}
                        description='删除后该仓库的相似推荐将丢失'
                        onConfirm={() => handleDelete(r)}
                        okText='删除'
                        okType='danger'
                        cancelText='取消'
                    >
                        <Button
                            type='link'
                            size='small'
                            danger
                            icon={<DeleteOutlined />}
                            loading={deletingId === r.id}
                        >
                            删除
                        </Button>
                    </Popconfirm>
                </Space>
            ),
        },
    ]

    // 渲染内容
    let content: React.ReactNode

    if (error) {
        content = (
            <Card>
                <div style={{ textAlign: 'center', padding: '40px 0', color: '#ff4d4f' }}>
                    <Text type='danger'>{error}</Text>
                    <br />
                    <Button
                        type='primary'
                        style={{ marginTop: 12 }}
                        onClick={() => load(page, pageSize)}
                    >
                        重试
                    </Button>
                </div>
            </Card>
        )
    } else if (!loading && records.length === 0) {
        content = (
            <Card>
                <div style={{ textAlign: 'center', padding: '60px 0' }}>
                    <ApartmentOutlined style={{ fontSize: 48, color: '#d9d9d9', marginBottom: 16 }} />
                    <div>
                        <Text type='secondary' style={{ fontSize: 15 }}>
                            暂无相似推荐缓存数据
                        </Text>
                    </div>
                    <div style={{ marginTop: 8 }}>
                        <Text type='secondary' style={{ fontSize: 13 }}>
                            在 Star 详情页使用 Agent 相似推荐功能后，结果将缓存在此
                        </Text>
                    </div>
                </div>
            </Card>
        )
    } else {
        content = (
            <Table
                rowKey='id'
                dataSource={records}
                columns={columns}
                loading={loading}
                pagination={{
                    current: page,
                    pageSize,
                    total,
                    showSizeChanger: true,
                    pageSizeOptions: ['10', '20', '50'],
                    showTotal: (t) => `共 ${t} 条缓存`,
                    onChange: (p, ps) => {
                        setPage(p)
                        setPageSize(ps)
                    },
                }}
                style={{ background: '#fff' }}
            />
        )
    }

    return (
        <div>
            {/* ── 顶部操作栏 ── */}
            <div
                style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 24,
                    flexWrap: 'wrap',
                    gap: 12,
                }}
            >
                <Title level={3} style={{ margin: 0 }}>
                    <ApartmentOutlined style={{ marginRight: 8 }} />
                    相似项目推荐
                </Title>
                <Space wrap>
                    <Popconfirm
                        title='确认清空'
                        description='将删除全部相似推荐缓存数据，确定清空？'
                        onConfirm={handleClearAll}
                        okText='确认清空'
                        okType='danger'
                        cancelText='取消'
                    >
                        <Button
                            icon={<ClearOutlined />}
                            danger
                            loading={clearingAll}
                            disabled={total === 0}
                        >
                            清空全部
                        </Button>
                    </Popconfirm>
                    <Button
                        icon={<ReloadOutlined />}
                        onClick={() => load(page, pageSize)}
                        loading={loading}
                    >
                        刷新
                    </Button>
                </Space>
            </div>

            {/* ── 表格区域 ── */}
            {content}

            {/* ── 查看内容弹窗 ── */}
            <Modal
                title={
                    <Space>
                        <EyeOutlined />
                        <span>相似推荐 — {viewRepo}</span>
                    </Space>
                }
                open={viewModalOpen}
                onCancel={() => setViewModalOpen(false)}
                footer={
                    <Button onClick={() => setViewModalOpen(false)}>关闭</Button>
                }
                width={800}
                style={{ top: 20 }}
            >
                <div
                    style={{
                        maxHeight: '60vh',
                        overflow: 'auto',
                        padding: '8px 0',
                    }}
                >
                    {viewContent ? (
                        <MarkdownRenderer content={viewContent} />
                    ) : (
                        <Text type='secondary'>暂无内容</Text>
                    )}
                </div>
            </Modal>
        </div>
    )
}
