import { Card, Col, Row, Statistic, Spin, Tag } from 'antd'
import { GithubOutlined, StarFilled, ForkOutlined } from '@ant-design/icons'
import type { OverviewStatsDTO } from '../../types'

export interface StarStatsBarProps {
    overview: OverviewStatsDTO | null
    loading?: boolean
}

/**
 * Star 列表页顶部统计卡片栏
 *
 * 展示总仓库数、总 Star 数、总 Fork 数、语言种类数四个概览指标。
 */
export default function StarStatsBar({ overview, loading = false }: StarStatsBarProps) {
    return (
        <Spin spinning={loading}>
            <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
                <Col xs={12} sm={6}>
                    <Card size='small'>
                        <Statistic
                            title='总仓库数'
                            value={overview?.totalRepos ?? 0}
                            prefix={<GithubOutlined style={{ color: '#1677ff' }} />}
                        />
                    </Card>
                </Col>
                <Col xs={12} sm={6}>
                    <Card size='small'>
                        <Statistic
                            title='总 Star 数'
                            value={overview?.totalStars ?? 0}
                            prefix={<StarFilled style={{ color: '#faad14' }} />}
                        />
                    </Card>
                </Col>
                <Col xs={12} sm={6}>
                    <Card size='small'>
                        <Statistic
                            title='总 Fork 数'
                            value={overview?.totalForks ?? 0}
                            prefix={<ForkOutlined style={{ color: '#52c41a' }} />}
                        />
                    </Card>
                </Col>
                <Col xs={12} sm={6}>
                    <Card size='small'>
                        <Statistic
                            title='语言种类'
                            value={overview?.totalLanguages ?? 0}
                            prefix={
                                <Tag color='purple' style={{ marginRight: 0 }}>
                                    #
                                </Tag>
                            }
                        />
                    </Card>
                </Col>
            </Row>
        </Spin>
    )
}
