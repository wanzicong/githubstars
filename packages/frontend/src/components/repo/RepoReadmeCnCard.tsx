import { Button, Empty, Space, Typography } from 'antd'
import { FileTextOutlined, TranslationOutlined } from '@ant-design/icons'
import type { GithubRepo } from '../../types'
import MarkdownRenderer from '../common/MarkdownRenderer'

const { Text } = Typography

export interface RepoReadmeCnCardProps {
    repo: GithubRepo
    translatingReadme: boolean
    onTranslateReadme: () => void
}

/**
 * 仓库详情页 — 中文 README Tab
 *
 * 只展示中文翻译版本：
 * - 已有 readmeCn → 渲染 Markdown
 * - 未翻译 → 空态引导翻译
 */
export default function RepoReadmeCnCard({ repo, translatingReadme, onTranslateReadme }: RepoReadmeCnCardProps) {
    if (repo.readmeCn) {
        return <MarkdownRenderer content={repo.readmeCn} style={{ padding: '8px 16px' }} />
    }

    return (
        <div
            style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: 320,
                padding: '32px 16px',
            }}
        >
            <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                styles={{ image: { height: 72 } }}
                description={
                    <Space orientation='vertical' size={8}>
                        <FileTextOutlined style={{ fontSize: 36, color: '#bfbfbf' }} />
                        <div>
                            <Text strong style={{ fontSize: 15 }}>
                                暂无中文 README
                            </Text>
                        </div>
                        <Text type='secondary' style={{ fontSize: 13 }}>
                            该仓库的 README 尚未翻译成中文
                        </Text>
                    </Space>
                }
            >
                <Button
                    type='primary'
                    icon={<TranslationOutlined />}
                    loading={translatingReadme}
                    onClick={onTranslateReadme}
                >
                    翻译 README
                </Button>
            </Empty>
        </div>
    )
}
