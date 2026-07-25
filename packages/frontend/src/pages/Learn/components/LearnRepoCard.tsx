import { Card, Tag, Avatar, Typography, Tooltip, Space, Button } from 'antd'
import {
    StarFilled,
    ForkOutlined,
    EditOutlined,
    DeleteOutlined,
    FireOutlined,
    CheckCircleOutlined,
    PauseCircleOutlined,
    BookOutlined,
} from '@ant-design/icons'
import type { LearnPriority, LearnRecord, LearnStatus } from '../../../types'

const { Text, Paragraph, Link: AntLink } = Typography

const STATUS_META: Record<LearnStatus, { label: string; color: string; icon: React.ReactNode }> = {
    WANT: { label: '想学', color: 'blue', icon: <BookOutlined /> },
    LEARNING: { label: '在学', color: 'processing', icon: <FireOutlined /> },
    DONE: { label: '已学', color: 'success', icon: <CheckCircleOutlined /> },
    SHELVED: { label: '搁置', color: 'default', icon: <PauseCircleOutlined /> },
}

const PRIORITY_META: Record<LearnPriority, { label: string; color: string }> = {
    HIGH: { label: '高', color: 'red' },
    MEDIUM: { label: '中', color: 'orange' },
    LOW: { label: '低', color: 'default' },
}

interface LearnRepoCardProps {
    record: LearnRecord
    onEdit: (record: LearnRecord) => void
    onDelete: (record: LearnRecord) => void
}

/**
 * 学习卡片
 *
 * 与 StarRepoCard 风格一致，但强化了学习维度：
 * - 状态徽章（左上角）
 * - 优先级彩色标签（右上角）
 * - 标签列表（卡片底部）
 * - 笔记预览（如果有）
 */
export default function LearnRepoCard({ record, onEdit, onDelete }: LearnRepoCardProps) {
    const status = STATUS_META[record.status]
    const priority = PRIORITY_META[record.priority]

    return (
        <Card
            size='small'
            hoverable
            className='hoverable-card'
            style={{ height: '100%' }}
            styles={{ body: { display: 'flex', flexDirection: 'column', gap: 8 } }}
            title={
                <Space size={8} style={{ width: '100%', minWidth: 0 }}>
                    <Avatar src={record.repo.ownerAvatarUrl ?? undefined} size={20} />
                    <AntLink
                        href={record.repo.htmlUrl ?? '#'}
                        target='_blank'
                        rel='noreferrer'
                        ellipsis
                        style={{ flex: 1, fontWeight: 600, maxWidth: '100%' }}
                    >
                        {record.repo.repoName ?? record.repo.fullName}
                    </AntLink>
                </Space>
            }
            extra={
                <Space size={4}>
                    <Tooltip title={`优先级：${priority.label}`}>
                        <Tag color={priority.color} style={{ marginInlineEnd: 0 }}>
                            {priority.label}
                        </Tag>
                    </Tooltip>
                </Space>
            }
        >
            <Space size={4} wrap>
                <Tag icon={status.icon} color={status.color}>
                    {status.label}
                </Tag>
                {record.repo.language && <Tag>{record.repo.language}</Tag>}
            </Space>

            <Paragraph
                type='secondary'
                ellipsis={{ rows: 2, expandable: false }}
                style={{ marginBottom: 0, fontSize: 13, minHeight: 40 }}
            >
                {record.repo.descriptionCn ?? record.repo.description ?? '暂无描述'}
            </Paragraph>

            {record.tags.length > 0 && (
                <Space size={4} wrap>
                    {record.tags.map((t) => (
                        <Tag key={t.id} color={t.color ?? undefined} style={{ marginInlineEnd: 0 }}>
                            {t.name}
                        </Tag>
                    ))}
                </Space>
            )}

            {record.notes && (
                <Paragraph
                    type='secondary'
                    italic
                    ellipsis={{ rows: 2 }}
                    style={{
                        marginBottom: 0,
                        fontSize: 12,
                        background: 'var(--content-bg)',
                        padding: '4px 8px',
                        borderRadius: 4,
                        borderLeft: '2px solid var(--primary-color)',
                    }}
                >
                    {record.notes}
                </Paragraph>
            )}

            <Space size={12} style={{ marginTop: 'auto', fontSize: 12, color: 'var(--ant-color-text-secondary, #999)' }}>
                <Tooltip title={`Star ${record.repo.starsCount}`}>
                    <span>
                        <StarFilled style={{ color: '#faad14', marginRight: 4 }} />
                        {formatCount(record.repo.starsCount)}
                    </span>
                </Tooltip>
                <Tooltip title={`Fork ${record.repo.forksCount}`}>
                    <span>
                        <ForkOutlined style={{ marginRight: 4 }} />
                        {formatCount(record.repo.forksCount)}
                    </span>
                </Tooltip>
                <span style={{ flex: 1 }} />
                <Button size='small' type='text' icon={<EditOutlined />} onClick={() => onEdit(record)}>
                    编辑
                </Button>
                <Button size='small' type='text' danger icon={<DeleteOutlined />} onClick={() => onDelete(record)} />
            </Space>

            <Text type='secondary' style={{ fontSize: 11 }}>
                {record.repo.ownerName && `@${record.repo.ownerName}`}
                {record.startedAt && ` · 开始于 ${formatDate(record.startedAt)}`}
                {record.finishedAt && ` · 完成于 ${formatDate(record.finishedAt)}`}
            </Text>
        </Card>
    )
}

function formatCount(n: number): string {
    if (n >= 10000) return `${(n / 10000).toFixed(1)}万`
    if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
    return String(n)
}

function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })
}
