import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Button, Card, Empty, Spin } from 'antd'
import { ArrowLeftOutlined } from '@ant-design/icons'
import * as api from '../../api'
import { RepoDetailView } from '../../components/repo'
import type { GithubRepo } from '../../types'

/**
 * 星标仓库详情页（按本地 ID 入口）
 *
 * 从数据库中按 ID 查询已入库的仓库并展示，与 RepoDetail（owner/repo 入口）
 * 共享完全相同的 RepoDetailView 组件。
 */
export default function StarDetail() {
    const { id } = useParams<{ id: string }>()
    const navigate = useNavigate()

    const [repo, setRepo] = useState<GithubRepo | null>(null)
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
                const detail = await api.fetchRepoDetail(numericId)
                if (cancelled) return
                if (detail && detail.id) {
                    setRepo(detail)
                    setNotFound(false)
                    return
                }

                // 详情 API 未返回数据，从 top-starred/recent-active 降级查找
                const [topRes, recentRes] = await Promise.allSettled([
                    api.fetchTopStarredRepos(100),
                    api.fetchRecentActiveRepos(100),
                ])
                if (cancelled) return

                let found: GithubRepo | undefined
                if (topRes.status === 'fulfilled') {
                    found = topRes.value.find((r) => r.id === numericId)
                }
                if (!found && recentRes.status === 'fulfilled') {
                    found = recentRes.value.find((r) => r.id === numericId)
                }

                if (found) {
                    setRepo(found)
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
            navigate('/')
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
                        <Button type='primary' onClick={() => navigate('/')}>
                            返回列表
                        </Button>
                    </Empty>
                </Card>
            </div>
        )
    }

    return <RepoDetailView repo={repo} />
}
