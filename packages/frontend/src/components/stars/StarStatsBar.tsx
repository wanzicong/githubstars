import { Card, Col, Row, Statistic, Skeleton, Tag } from 'antd'
import { GithubOutlined, StarFilled, ForkOutlined } from '@ant-design/icons'
import type { OverviewStatsDTO } from '../../types'

export interface StarStatsBarProps {
    overview: OverviewStatsDTO | null
    loading?: boolean
}

const STAT_ITEMS = [
    { key: 'repos', title: '总仓库数', icon: <GithubOutlined style={{ color: '#1677ff' }} /> },
    { key: 'stars', title: '总 Star 数', icon: <StarFilled style={{ color: '#faad14' }} /> },
    { key: 'forks', title: '总 Fork 数', icon: <ForkOutlined style={{ color: '#52c41a' }} /> },
    { key: 'langs', title: '语言种类', icon: <Tag color='purple' style={{ marginRight: 0 }}>#</Tag> },
] as const

/** Star 列表页顶部统计卡片栏（加载时显示骨架屏） */
export default function StarStatsBar({ overview, loading = false }: StarStatsBarProps) {
    const values = [
        overview?.totalRepos ?? 0,
        overview?.totalStars ?? 0,
        overview?.totalForks ?? 0,
        overview?.totalLanguages ?? 0,
    ]

    return (
        <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
            {STAT_ITEMS.map((item, i) => (
                <Col xs={12} sm={6} key={item.key}>
                    <Card size='small'>
                        {loading ? (
                            <Skeleton active title={{ width: '50%' }} paragraph={{ rows: 1, width: '70%' }} />
                        ) : (
                            <Statistic
                                title={item.title}
                                value={values[i]}
                                prefix={item.icon}
                            />
                        )}
                    </Card>
                </Col>
            ))}
        </Row>
    )
}
