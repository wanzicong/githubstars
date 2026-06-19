import { Card, Col, Row, Statistic, Typography } from 'antd'
import { StarFilled, ForkOutlined, EyeOutlined, BugOutlined } from '@ant-design/icons'
import { formatNumberCn } from '../../utils/format'

const { Text } = Typography

export interface RepoStatsGridProps {
    starsCount: number
    forksCount: number
    watchersCount: number
    openIssuesCount: number
}

/** 统计列响应式配置 */
const STAT_COL = { xs: 12 as const, sm: 12 as const, md: 6 as const }

/** 数值格式化（原始值 + 中文计数） */
function formatStatValue(value: number) {
    return (
        <span>
            {value}{' '}
            <Text type='secondary' style={{ fontSize: 12 }}>
                {formatNumberCn(value)}
            </Text>
        </span>
    )
}

/**
 * 仓库详情页统计卡片网格
 *
 * 展示 Stars / Forks / Watchers / Open Issues 四项核心指标。
 */
export default function RepoStatsGrid({ starsCount, forksCount, watchersCount, openIssuesCount }: RepoStatsGridProps) {
    return (
        <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
            <Col {...STAT_COL}>
                <Card size='small'>
                    <Statistic
                        title='Stars'
                        value={starsCount}
                        prefix={<StarFilled style={{ color: '#faad14' }} />}
                        formatter={formatStatValue}
                    />
                </Card>
            </Col>
            <Col {...STAT_COL}>
                <Card size='small'>
                    <Statistic
                        title='Forks'
                        value={forksCount}
                        prefix={<ForkOutlined style={{ color: '#52c41a' }} />}
                        formatter={formatStatValue}
                    />
                </Card>
            </Col>
            <Col {...STAT_COL}>
                <Card size='small'>
                    <Statistic
                        title='Watchers'
                        value={watchersCount}
                        prefix={<EyeOutlined style={{ color: '#1677ff' }} />}
                        formatter={formatStatValue}
                    />
                </Card>
            </Col>
            <Col {...STAT_COL}>
                <Card size='small'>
                    <Statistic
                        title='Open Issues'
                        value={openIssuesCount}
                        prefix={<BugOutlined style={{ color: '#ff4d4f' }} />}
                        formatter={formatStatValue}
                    />
                </Card>
            </Col>
        </Row>
    )
}
