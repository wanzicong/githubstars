import { Button, Tag, Typography, Avatar, Badge, theme } from 'antd'
import { GithubOutlined, LinkOutlined, TranslationOutlined, ReloadOutlined, CheckCircleOutlined, BugOutlined } from '@ant-design/icons'
import type { GithubRepo } from '../../types'

const { Title, Text, Paragraph } = Typography
const { useToken } = theme

export interface RepoHeaderProps {
    repo: GithubRepo
    translatingDesc: boolean
    onTranslateDesc: () => void
    onRetranslateDesc: () => void
}

/**
 * 仓库详情页头部组件
 *
 * 设计要点：
 * - 头像 + 仓库名构成视觉锚点，全平台响应式
 * - 描述区展示中文翻译（优先）或原文，翻译状态用标签清晰标注
 * - 操作按钮（GitHub / 主页）与翻译动作用视觉分隔区分
 * - 全部颜色从 Ant Design 主题 token 获取，自动适应亮/暗模式
 */
export default function RepoHeader({ repo, translatingDesc, onTranslateDesc, onRetranslateDesc }: RepoHeaderProps) {
    const { token } = useToken()
    const hasTranslation = Boolean(repo.descriptionCn)
    const hasOriginal = Boolean(repo.description)

    /** 渲染描述区域的 JSX（已翻译 / 未翻译 / 无描述三个阶段） */
    const renderDescription = () => {
        const textStyle: React.CSSProperties = {
            width: '100%',
            overflow: 'hidden',
            wordBreak: 'break-word',
            lineHeight: 1.7,
        }
        if (hasTranslation) {
            return (
                <div>
                    <Paragraph style={{ marginBottom: 4, color: token.colorText, ...textStyle }}>
                        {repo.descriptionCn}
                        <Tag
                            bordered={false}
                            color='purple'
                            style={{ marginLeft: 8, fontSize: 11, lineHeight: '18px', verticalAlign: 'middle' }}
                        >
                            <CheckCircleOutlined style={{ fontSize: 10, marginRight: 2 }} />
                            已翻译
                        </Tag>
                    </Paragraph>
                    {hasOriginal && repo.description !== repo.descriptionCn && (
                        <Paragraph
                            type='secondary'
                            ellipsis={{ rows: 2 }}
                            style={{
                                marginBottom: 0,
                                fontSize: 12,
                                lineHeight: 1.6,
                                paddingTop: 4,
                                borderTop: `1px dashed ${token.colorBorderSecondary}`,
                                color: token.colorTextTertiary,
                                ...textStyle,
                            }}
                        >
                            <Text italic style={{ color: token.colorTextQuaternary, marginRight: 4 }}>
                                原文：
                            </Text>
                            {repo.description}
                        </Paragraph>
                    )}
                    <Button
                        size='small'
                        type='link'
                        icon={<ReloadOutlined />}
                        loading={translatingDesc}
                        onClick={onRetranslateDesc}
                        style={{ padding: 0, marginTop: 4, height: 20, fontSize: 12 }}
                    >
                        重新翻译
                    </Button>
                </div>
            )
        }
        if (hasOriginal) {
            return (
                <div>
                    <Paragraph type='secondary' style={{ marginBottom: 8, color: token.colorTextSecondary, ...textStyle }}>
                        {repo.description}
                    </Paragraph>
                    <Button
                        size='small'
                        icon={<TranslationOutlined />}
                        loading={translatingDesc}
                        onClick={onTranslateDesc}
                        type='primary'
                        ghost
                    >
                        翻译描述
                    </Button>
                </div>
            )
        }
        return (
            <Text type='secondary' style={{ marginBottom: 8, display: 'inline-block', color: token.colorTextQuaternary }}>
                暂无描述
            </Text>
        )
    }

    return (
        <div
            style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 16,
                flexWrap: 'wrap',
                padding: 20,
                borderRadius: token.borderRadiusLG,
                border: `1px solid ${token.colorBorderSecondary}`,
                background: token.colorBgElevated,
            }}
        >
            {/* 头像区 */}
            <Avatar
                src={repo.ownerAvatarUrl}
                alt={repo.ownerName}
                size={64}
                style={{
                    flexShrink: 0,
                    border: `2px solid ${token.colorBorderSecondary}`,
                    borderRadius: token.borderRadiusLG,
                }}
            />

            {/* 主信息区 */}
            <div style={{ flex: 1, minWidth: 0 }}>
                {/* 仓库名 */}
                <Title level={4} style={{ margin: 0, marginBottom: 4, overflowWrap: 'break-word', lineHeight: 1.4 }}>
                    <span style={{ color: token.colorText }}>{repo.fullName}</span>
                </Title>

                {/* 所有者 + 状态标签 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
                    <Text type='secondary' style={{ fontSize: 14 }}>
                        {repo.ownerName}
                    </Text>
                    {repo.isFork && (
                        <Tag color='processing' bordered={false} style={{ margin: 0, fontSize: 12, borderRadius: 4 }}>
                            已 Fork
                        </Tag>
                    )}
                    {repo.isArchived && (
                        <Tag bordered={false} style={{ margin: 0, fontSize: 12, borderRadius: 4, color: token.colorTextTertiary }}>
                            已归档
                        </Tag>
                    )}
                </div>

                {/* 描述区域 */}
                {renderDescription()}
            </div>

            {/* 操作按钮区 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flexShrink: 0, minWidth: 150, paddingLeft: 8 }}>
                <Button
                    type='primary'
                    icon={<GithubOutlined />}
                    onClick={() => window.open(repo.htmlUrl, '_blank', 'noopener,noreferrer')}
                    block
                    size='small'
                >
                    在 GitHub 上查看
                </Button>
                <Button
                    icon={<BugOutlined />}
                    onClick={() => window.open(`${repo.htmlUrl}/issues`, '_blank', 'noopener,noreferrer')}
                    block
                    size='small'
                >
                    Issues
                    {repo.openIssuesCount > 0 && (
                        <Badge
                            count={repo.openIssuesCount}
                            size='small'
                            style={{ marginLeft: 6, fontSize: 10, lineHeight: '14px', minWidth: 16, height: 16 }}
                            offset={[2, -2]}
                        />
                    )}
                </Button>
                {repo.homepage && (
                    <Button
                        icon={<LinkOutlined />}
                        onClick={() => window.open(repo.homepage!, '_blank', 'noopener,noreferrer')}
                        block
                        size='small'
                    >
                        访问项目主页
                    </Button>
                )}
            </div>
        </div>
    )
}
