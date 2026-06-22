import { Button, Space, Tag, Typography, Avatar } from 'antd'
import { GithubOutlined, LinkOutlined, TranslationOutlined, ReloadOutlined } from '@ant-design/icons'
import type { GithubRepo } from '../../types'

const { Title, Text, Paragraph } = Typography

export interface RepoHeaderProps {
    repo: GithubRepo
    translatingDesc: boolean
    onTranslateDesc: () => void
    onRetranslateDesc: () => void
}

/**
 * 仓库详情页头部组件
 *
 * 展示仓库头像、名称、拥有者、Fork/归档标签、描述（中/英）以及操作按钮。
 */
export default function RepoHeader({ repo, translatingDesc, onTranslateDesc, onRetranslateDesc }: RepoHeaderProps) {
    return (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
            <Avatar src={repo.ownerAvatarUrl} alt={repo.ownerName} size={64} style={{ flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
                <Title level={4} style={{ margin: 0, marginBottom: 4, overflowWrap: 'break-word' }}>
                    {repo.fullName}
                </Title>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <Text type='secondary' style={{ fontSize: 14 }}>
                        {repo.ownerName}
                    </Text>
                    {repo.isFork && (
                        <Tag color='orange' style={{ margin: 0 }}>
                            已 Fork
                        </Tag>
                    )}
                    {repo.isArchived && (
                        <Tag color='default' style={{ margin: 0 }}>
                            已归档
                        </Tag>
                    )}
                </div>
                {/* 描述：优先显示中文翻译 */}
                {repo.descriptionCn ? (
                    <div>
                        <Paragraph style={{ marginBottom: 4, color: '#333' }}>
                            {repo.descriptionCn}
                            <Text type='secondary' style={{ fontSize: 11, marginLeft: 6 }}>
                                🇨🇳 中文
                            </Text>
                        </Paragraph>
                        {repo.description && repo.description !== repo.descriptionCn && (
                            <Paragraph type='secondary' style={{ marginBottom: 0, fontSize: 12 }}>
                                <Text type='secondary' italic>
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
                            style={{ padding: 0, marginTop: 4 }}
                        >
                            重新翻译
                        </Button>
                    </div>
                ) : repo.description ? (
                    <div>
                        <Paragraph type='secondary' style={{ marginBottom: 8 }}>
                            {repo.description}
                        </Paragraph>
                        <Button
                            size='small'
                            icon={<TranslationOutlined />}
                            loading={translatingDesc}
                            onClick={onTranslateDesc}
                        >
                            翻译描述
                        </Button>
                    </div>
                ) : (
                    <Text type='secondary' style={{ marginBottom: 8 }}>
                        暂无描述
                    </Text>
                )}
            </div>
            <Space wrap>
                <Button
                    type='primary'
                    icon={<GithubOutlined />}
                    onClick={() => window.open(repo.htmlUrl, '_blank', 'noopener,noreferrer')}
                >
                    在 GitHub 上查看
                </Button>
                {repo.homepage && (
                    <Button icon={<LinkOutlined />} onClick={() => window.open(repo.homepage!, '_blank', 'noopener,noreferrer')}>
                        访问项目主页
                    </Button>
                )}
            </Space>
        </div>
    )
}
