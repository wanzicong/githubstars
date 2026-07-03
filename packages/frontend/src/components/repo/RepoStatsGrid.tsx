import { Card, Col, Row, Statistic, Typography } from 'antd'
import { StarFilled, ForkOutlined, EyeOutlined, BugOutlined, FolderOpenOutlined } from '@ant-design/icons'
import { formatNumberCn, formatSize } from '../../utils/format'

const { Text } = Typography

export interface RepoStatsGridProps {
    starsCount: number
    forksCount: number
    watchersCount: number
    openIssuesCount: number
    repoSize?: number | null
}

/** 统计列响应式配置 */
const STAT_COL = { xs: 12 as const, sm: 12 as const, md: 6 as const }

/** 数值格式化（原始值 + 中文计数） */
function formatStatValue(value: number | string) {
    const num = typeof value === 'string' ? Number(value) : value
    if (isNaN(num)) return <span>-</span>
    return (
        <span>
            {num}{' '}
            <Text type='secondary' style={{ fontSize: 12 }}>
                {formatNumberCn(num)}
            </Text>
        </span>
    )
}

/**
 * 仓库详情页统计卡片网格
 *
 * 展示 Stars / Forks / Watchers / Open Issues 四项核心指标。
 */
export default function RepoStatsGrid({ starsCount, forksCount, watchersCount, openIssuesCount, repoSize }: RepoStatsGridProps) {
    const repoSizeFormatted = repoSize != null && repoSize > 0 ? formatSize(repoSize * 1024) : null
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
                        title='仓库大小'
                        value={repoSize ?? 0}
                        prefix={<FolderOpenOutlined style={{ color: '#722ed1' }} />}
                        formatter={() => <span>{repoSizeFormatted ?? '-'}</span>}
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
