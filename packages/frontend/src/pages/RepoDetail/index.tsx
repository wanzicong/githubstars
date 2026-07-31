import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Button, Card, Empty, Result, Spin } from 'antd'
import { ArrowLeftOutlined } from '@ant-design/icons'
import { fetchGithubRepoDetail } from '../../api/github'
import { RepoDetailView } from '../../components/repo'
import type { RepoDetailData } from '../../types'

/**
 * 任意仓库详情页（按 owner/repo 入口）
 *
 * 通过后端代理实时从 GitHub API 获取仓库详情，与 StarDetail（本地 id 入口）
 * 共享完全相同的 RepoDetailView 组件。
 */
export default function RepoDetail() {
    const { owner, repo: repoName } = useParams<{ owner: string; repo: string }>()
    const navigate = useNavigate()

    const [repo, setRepo] = useState<RepoDetailData | null>(null)
    const [loading, setLoading] = useState(true)
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const [reloadKey, setReloadKey] = useState(0)

    useEffect(() => {
        if (!owner || !repoName) {
            // eslint-disable-next-line react-hooks/set-state-in-effect -- URL 参数非法时的同步兜底，无级联渲染
            setErrorMessage('仓库地址无效')
            setLoading(false)
            return
        }
        let cancelled = false
        void (async () => {
            try {
                const detail = await fetchGithubRepoDetail(owner, repoName)
                if (!cancelled && detail) {
                    setRepo(detail as RepoDetailData)
                    setErrorMessage(null)
                }
            } catch (e: unknown) {
                if (cancelled) return
                // 优先使用 request.ts 拦截器附加的本地化 userMessage，与 Issues 弹窗的错误处理模式一致
                const readable = e as { userMessage?: string; message?: string }
                setErrorMessage(readable.userMessage || readable.message || '获取仓库详情失败')
            } finally {
                if (!cancelled) setLoading(false)
            }
        })()
        return () => { cancelled = true }
    }, [owner, repoName, reloadKey])

    const handleBack = () => {
        if (window.history.length > 1) {
            navigate(-1)
        } else {
            navigate('/')
        }
    }

    /** 重试：重置状态并递增 reloadKey 触发 useEffect 重新拉取 */
    const handleRetry = () => {
        setErrorMessage(null)
        setLoading(true)
        setReloadKey((k) => k + 1)
    }

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
                <Spin size='large' tip='加载中...' />
            </div>
        )
    }

    if (errorMessage || !repo) {
        const is404 = errorMessage?.includes('不存在') || errorMessage?.includes('404')
        return (
            <div>
                <Button icon={<ArrowLeftOutlined />} onClick={handleBack} style={{ marginBottom: 24 }}>
                    返回
                </Button>
                <Card>
                    {is404 ? (
                        <Empty description='未找到该仓库或无法访问'>
                            <Button type='primary' onClick={() => navigate('/')}>
                                返回首页
                            </Button>
                        </Empty>
                    ) : (
                        <Result
                            status='error'
                            title='获取仓库详情失败'
                            subTitle={errorMessage || '未知错误'}
                            extra={
                                <Button type='primary' onClick={handleRetry}>
                                    重试
                                </Button>
                            }
                        />
                    )}
                </Card>
            </div>
        )
    }

    return <RepoDetailView repo={repo} />
}
