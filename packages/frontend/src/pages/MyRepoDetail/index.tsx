import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Button, Card, Empty, Spin, Tag, Space } from 'antd'
import { ArrowLeftOutlined, LockOutlined } from '@ant-design/icons'
import { fetchMyRepoDetail } from '../../api/my-repos'
import { RepoDetailView } from '../../components/repo'
import type { MyRepo } from '../../types'

/**
 * 我的仓库详情页（按本地 ID 入口）
 *
 * 从 my_repo 表按 ID 查询并展示，复用共享 RepoDetailView 组件。
 * 与星标仓库详情差异：
 * - 数据源为 /api/my-repos/detail
 * - 头部额外展示私有标记与所属分类
 * - 返回时回到 /my-repos 列表
 */
export default function MyRepoDetail() {
    const { id } = useParams<{ id: string }>()
    const navigate = useNavigate()

    const [repo, setRepo] = useState<MyRepo | null>(null)
    const [loading, setLoading] = useState(true)
    const [notFound, setNotFound] = useState(false)

    useEffect(() => {
        let cancelled = false
        const fetchRepo = async () => {
            const numericId = Number(id)
            if (!numericId) {
                setNotFound(true)
                setLoading(false)
                return
            }
            try {
                const detail = await fetchMyRepoDetail(numericId)
                if (cancelled) return
                if (detail?.id) {
                    setRepo(detail)
                } else {
                    setNotFound(true)
                }
            } catch {
                if (!cancelled) setNotFound(true)
            } finally {
                if (!cancelled) setLoading(false)
            }
        }
        void fetchRepo()
        return () => { cancelled = true }
    }, [id])

    const handleBack = () => {
        if (window.history.length > 1) {
            navigate(-1)
        } else {
            navigate('/my-repos')
        }
    }

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
                <Spin size='large' tip='加载中...' />
            </div>
        )
    }

    if (notFound || !repo) {
        return (
            <div>
                <Button icon={<ArrowLeftOutlined />} onClick={handleBack} style={{ marginBottom: 24 }}>
                    返回
                </Button>
                <Card>
                    <Empty description='未找到该仓库数据'>
                        <Button type='primary' onClick={() => navigate('/my-repos')}>
                            返回我的仓库列表
                        </Button>
                    </Empty>
                </Card>
            </div>
        )
    }

    return (
        <div>
            {/* 我的仓库专属头部：私有标记 + 分类标签 */}
            <Space style={{ marginBottom: 12 }} wrap>
                {repo.isPrivate && (
                    <Tag icon={<LockOutlined />} color='warning'>
                        私有仓库
                    </Tag>
                )}
                {(repo.categories ?? []).map((c) => (
                    <Tag key={c.id} color='blue'>
                        {c.name}
                    </Tag>
                ))}
            </Space>
            <RepoDetailView repo={repo} />
        </div>
    )
}
