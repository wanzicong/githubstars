import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, Row, Col, Statistic, Table, Tag, Typography, Spin } from 'antd'
import { StarFilled, ForkOutlined, GithubOutlined } from '@ant-design/icons'
import { Doughnut, Bar, Line } from 'react-chartjs-2'
import {
    Chart as ChartJS,
    ArcElement,
    Tooltip,
    Legend,
    CategoryScale,
    LinearScale,
    BarElement,
    PointElement,
    LineElement,
    Filler,
} from 'chart.js'
import * as statsApi from '../../api'
import { fetchMyRepoStats } from '../../api/my-repos'
import type { OverviewStatsDTO, LanguageStatsDTO, OwnerStatsDTO, TimelineStatsDTO, GithubRepo, MyRepoStats } from '../../types'
import { formatDate, formatNumberShort } from '../../utils/format'
import { CHART_COLORS } from '../../constants'

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, PointElement, LineElement, Filler)

const { Title, Link: AntLink } = Typography

const TOP_N_OWNERS = 15
const TOP_N_REPOS = 10
const TOP_N_LANGUAGES = 15

export default function Stats() {
    const navigate = useNavigate()
    const [overview, setOverview] = useState<OverviewStatsDTO | null>(null)
    const [languages, setLanguages] = useState<LanguageStatsDTO[]>([])
    const [owners, setOwners] = useState<OwnerStatsDTO[]>([])
    const [timeline, setTimeline] = useState<TimelineStatsDTO[]>([])
    const [topRepos, setTopRepos] = useState<GithubRepo[]>([])
    const [recentRepos, setRecentRepos] = useState<GithubRepo[]>([])
    const [myRepoStats, setMyRepoStats] = useState<MyRepoStats | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchAll = async () => {
            setLoading(true)
            try {
                const [overviewRes, languagesRes, ownersRes, timelineRes, topReposRes, recentReposRes, myRepoRes] = await Promise.allSettled([
                    statsApi.fetchOverviewStats(),
                    statsApi.fetchLanguageStats(),
                    statsApi.fetchOwnerStats(TOP_N_OWNERS),
                    statsApi.fetchTimelineStats(),
                    statsApi.fetchTopStarredRepos(TOP_N_REPOS),
                    statsApi.fetchRecentActiveRepos(TOP_N_REPOS),
                    fetchMyRepoStats(),
                ])

                if (overviewRes.status === 'fulfilled') setOverview(overviewRes.value)
                if (languagesRes.status === 'fulfilled') setLanguages(languagesRes.value || [])
                if (ownersRes.status === 'fulfilled') setOwners(ownersRes.value || [])
                if (timelineRes.status === 'fulfilled') setTimeline(timelineRes.value || [])
                if (topReposRes.status === 'fulfilled') setTopRepos(topReposRes.value || [])
                if (recentReposRes.status === 'fulfilled') setRecentRepos(recentReposRes.value || [])
                if (myRepoRes.status === 'fulfilled') setMyRepoStats(myRepoRes.value)
            } finally {
                setLoading(false)
            }
        }
        fetchAll()
    }, [])

    const langTop = (languages || []).slice(0, TOP_N_LANGUAGES)
    const langOthers = (languages || []).slice(TOP_N_LANGUAGES).reduce((sum, l) => sum + l.count, 0)

    const languageDoughnutData = {
        labels: langTop.map((l) => l.language).concat(langOthers > 0 ? ['其他'] : []),
        datasets: [
            {
                data: langTop.map((l) => l.count).concat(langOthers > 0 ? [langOthers] : []),
                backgroundColor: CHART_COLORS.slice(0, langTop.length + (langOthers > 0 ? 1 : 0)),
                borderWidth: 1,
            },
        ],
    }

    const ownerBarData = {
        labels: owners.map((o) => o.ownerName),
        datasets: [
            {
                label: '仓库数量',
                data: owners.map((o) => o.count),
                backgroundColor: '#36A2EB',
                borderRadius: 4,
            },
        ],
    }

    const timelineLineData = {
        labels: timeline.map((t) => t.month),
        datasets: [
            {
                label: 'Star 数量',
                data: timeline.map((t) => t.count),
                fill: true,
                tension: 0.3,
                borderColor: '#FF6384',
                backgroundColor: 'rgba(255, 99, 132, 0.15)',
                pointRadius: 3,
                pointHoverRadius: 6,
            },
        ],
    }

    const topStarredColumns = [
        { title: '排名', dataIndex: 'rank', key: 'rank', width: 60, align: 'center' as const },
        {
            title: '仓库名',
            dataIndex: 'fullName',
            key: 'fullName',
            render: (_: string, record: GithubRepo) => (
                <AntLink onClick={() => navigate(`/stars/${record.id}`)} style={{ cursor: 'pointer' }}>
                    <GithubOutlined style={{ marginRight: 4 }} />
                    {record.fullName}
                </AntLink>
            ),
        },
        {
            title: '语言',
            dataIndex: 'language',
            key: 'language',
            width: 100,
            render: (lang: string | null) => (lang ? <Tag>{lang}</Tag> : <Tag color='default'>-</Tag>),
        },
        {
            title: 'Star数',
            dataIndex: 'starsCount',
            key: 'starsCount',
            width: 100,
            align: 'right' as const,
            render: (v: number) => formatNumberShort(v),
            sorter: (a: { starsCount: number }, b: { starsCount: number }) => a.starsCount - b.starsCount,
        },
        {
            title: 'Fork数',
            dataIndex: 'forksCount',
            key: 'forksCount',
            width: 100,
            align: 'right' as const,
            render: (v: number) => formatNumberShort(v),
        },
    ]

    const recentActiveColumns = [
        { title: '排名', dataIndex: 'rank', key: 'rank', width: 60, align: 'center' as const },
        {
            title: '仓库名',
            dataIndex: 'fullName',
            key: 'fullName',
            render: (_: string, record: GithubRepo) => (
                <AntLink onClick={() => navigate(`/stars/${record.id}`)} style={{ cursor: 'pointer' }}>
                    <GithubOutlined style={{ marginRight: 4 }} />
                    {record.fullName}
                </AntLink>
            ),
        },
        {
            title: '语言',
            dataIndex: 'language',
            key: 'language',
            width: 100,
            render: (lang: string | null) => (lang ? <Tag>{lang}</Tag> : <Tag color='default'>-</Tag>),
        },
        {
            title: 'Star数',
            dataIndex: 'starsCount',
            key: 'starsCount',
            width: 100,
            align: 'right' as const,
            render: (v: number) => formatNumberShort(v),
        },
        {
            title: '最近更新时间',
            dataIndex: 'repoUpdatedAt',
            key: 'repoUpdatedAt',
            width: 130,
            render: (v: string | null) => formatDate(v),
            sorter: (a: { repoUpdatedAt: string | null }, b: { repoUpdatedAt: string | null }) => {
                const da = a.repoUpdatedAt ?? ''
                const db = b.repoUpdatedAt ?? ''
                return da.localeCompare(db)
            },
        },
    ]

    const topStarredSource = topRepos.map((r, i) => ({ ...r, key: r.id, rank: i + 1 }))
    const recentActiveSource = recentRepos.map((r, i) => ({ ...r, key: r.id, rank: i + 1 }))

    const totalLanguageCount = languages.reduce((sum, l) => sum + l.count, 0)

    return (
        <div>
            <Title level={3} style={{ marginBottom: 24 }}>
                数据统计
            </Title>

            <Spin spinning={loading}>
                <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                    <Col xs={24} sm={12} md={4}>
                        <Card>
                            <Statistic
                                title='总仓库数'
                                value={overview?.totalRepos ?? 0}
                                prefix={<GithubOutlined style={{ color: '#1677ff' }} />}
                            />
                        </Card>
                    </Col>
                    <Col xs={24} sm={12} md={5}>
                        <Card>
                            <Statistic
                                title='总 Star 数'
                                value={overview?.totalStars ?? 0}
                                formatter={(value) => formatNumberShort(value as number)}
                                prefix={<StarFilled style={{ color: '#faad14' }} />}
                            />
                        </Card>
                    </Col>
                    <Col xs={24} sm={12} md={5}>
                        <Card>
                            <Statistic
                                title='总 Fork 数'
                                value={overview?.totalForks ?? 0}
                                formatter={(value) => formatNumberShort(value as number)}
                                prefix={<ForkOutlined style={{ color: '#52c41a' }} />}
                            />
                        </Card>
                    </Col>
                    <Col xs={24} sm={12} md={5}>
                        <Card>
                            <Statistic
                                title='语言种类数'
                                value={overview?.totalLanguages ?? 0}
                                prefix={
                                    <Tag color='purple' style={{ marginRight: 0 }}>
                                        #
                                    </Tag>
                                }
                            />
                        </Card>
                    </Col>
                    <Col xs={24} sm={12} md={5}>
                        <Card>
                            <Statistic
                                title='作者数'
                                value={overview?.totalOwners ?? 0}
                                prefix={<StarFilled style={{ color: '#eb2f96' }} />}
                            />
                        </Card>
                    </Col>
                </Row>

                {/* 我的仓库概览（用户自建仓库，仅在有数据时展示） */}
                {myRepoStats && myRepoStats.total > 0 && (
                    <Card
                        title='我的仓库'
                        style={{ marginBottom: 24 }}
                        extra={
                            <AntLink onClick={() => navigate('/my-repos')}>查看全部</AntLink>
                        }
                    >
                        <Row gutter={[16, 16]}>
                            <Col xs={12} sm={6}>
                                <Statistic title='仓库总数' value={myRepoStats.total} prefix={<GithubOutlined style={{ color: '#1677ff' }} />} />
                            </Col>
                            <Col xs={12} sm={6}>
                                <Statistic title='私有仓库' value={myRepoStats.privateCount} />
                            </Col>
                            <Col xs={12} sm={6}>
                                <Statistic
                                    title='总 Star 数'
                                    value={myRepoStats.totalStars}
                                    formatter={(value) => formatNumberShort(value as number)}
                                    prefix={<StarFilled style={{ color: '#faad14' }} />}
                                />
                            </Col>
                            <Col xs={12} sm={6}>
                                <Statistic
                                    title='总 Fork 数'
                                    value={myRepoStats.totalForks}
                                    formatter={(value) => formatNumberShort(value as number)}
                                    prefix={<ForkOutlined style={{ color: '#52c41a' }} />}
                                />
                            </Col>
                        </Row>
                        {myRepoStats.languages.length > 0 && (
                            <div style={{ marginTop: 16 }}>
                                {(myRepoStats.languages || []).slice(0, 8).map((l) => (
                                    <Tag key={l.language} style={{ marginBottom: 4 }}>
                                        {l.language} ({l.count})
                                    </Tag>
                                ))}
                            </div>
                        )}
                    </Card>
                )}

                <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                    <Col xs={24} lg={12}>
                        <Card title='语言分布' style={{ height: '100%' }}>
                            {languages.length > 0 ? (
                                <div className='chart-container' style={{ height: 400 }}>
                                    <Doughnut
                                        data={languageDoughnutData}
                                        options={{
                                            responsive: true,
                                            maintainAspectRatio: false,
                                            plugins: {
                                                legend: {
                                                    position: 'right' as const,
                                                    labels: { boxWidth: 12, padding: 8, font: { size: 11 } },
                                                },
                                                tooltip: {
                                                    callbacks: {
                                                        label: (ctx: { label: string; parsed: number }) => {
                                                            const pct =
                                                                totalLanguageCount > 0
                                                                    ? ((ctx.parsed / totalLanguageCount) * 100).toFixed(1)
                                                                    : '0'
                                                            return `${ctx.label}: ${ctx.parsed} (${pct}%)`
                                                        },
                                                    },
                                                },
                                            },
                                        }}
                                    />
                                </div>
                            ) : (
                                <div
                                    style={{ height: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999' }}
                                >
                                    暂无语言数据
                                </div>
                            )}
                        </Card>
                    </Col>
                    <Col xs={24} lg={12}>
                        <Card title='作者排行' style={{ height: '100%' }}>
                            {owners.length > 0 ? (
                                <div className='chart-container' style={{ height: 400 }}>
                                    <Bar
                                        data={ownerBarData}
                                        options={{
                                            indexAxis: 'y' as const,
                                            responsive: true,
                                            maintainAspectRatio: false,
                                            plugins: {
                                                legend: { display: false },
                                            },
                                            scales: {
                                                x: {
                                                    title: { display: true, text: '仓库数量' },
                                                },
                                            },
                                        }}
                                    />
                                </div>
                            ) : (
                                <div
                                    style={{ height: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999' }}
                                >
                                    暂无作者数据
                                </div>
                            )}
                        </Card>
                    </Col>
                </Row>

                <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                    <Col span={24}>
                        <Card title='Star 时间趋势'>
                            {timeline.length > 0 ? (
                                <div className='chart-container' style={{ height: 400 }}>
                                    <Line
                                        data={timelineLineData}
                                        options={{
                                            responsive: true,
                                            maintainAspectRatio: false,
                                            interaction: {
                                                intersect: false,
                                                mode: 'index' as const,
                                            },
                                            plugins: {
                                                legend: {
                                                    position: 'top' as const,
                                                },
                                            },
                                            scales: {
                                                y: {
                                                    title: { display: true, text: 'Star 数量' },
                                                    beginAtZero: true,
                                                },
                                                x: {
                                                    title: { display: true, text: '月份' },
                                                },
                                            },
                                        }}
                                    />
                                </div>
                            ) : (
                                <div
                                    style={{ height: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999' }}
                                >
                                    暂无时间线数据
                                </div>
                            )}
                        </Card>
                    </Col>
                </Row>

                <Row gutter={[16, 16]}>
                    <Col xs={24} lg={12}>
                        <Card title='最受欢迎仓库 Top 10'>
                            <Table
                                columns={topStarredColumns}
                                dataSource={topStarredSource}
                                pagination={false}
                                size='small'
                                scroll={{ x: 500 }}
                            />
                        </Card>
                    </Col>
                    <Col xs={24} lg={12}>
                        <Card title='最近活跃仓库 Top 10'>
                            <Table
                                columns={recentActiveColumns}
                                dataSource={recentActiveSource}
                                pagination={false}
                                size='small'
                                scroll={{ x: 520 }}
                            />
                        </Card>
                    </Col>
                </Row>
            </Spin>
        </div>
    )
}
