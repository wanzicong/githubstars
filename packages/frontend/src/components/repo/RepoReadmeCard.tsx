import { useState, type ReactNode } from 'react'
import { Card, Button, Space, Typography, Modal, Alert } from 'antd'
import { ReadOutlined, TranslationOutlined, ReloadOutlined, ExpandOutlined } from '@ant-design/icons'
import type { GithubRepo } from '../../types'
import MarkdownRenderer from '../common/MarkdownRenderer'

const { Text } = Typography

export interface RepoReadmeCardProps {
    repo: GithubRepo
    translatingReadme: boolean
    onTranslateReadme: () => void
    onRetranslateReadme: () => void
}

/**
 * 仓库详情页 README 卡片
 *
 * 展示 README 内容，按优先级展示中文翻译 > 原文 > 无 README 提示：
 * - 有翻译（readmeCn）→ 展示中文翻译
 * - 已获取但未翻译且有原文 → 展示原文 + "尚未翻译"提示
 * - 已获取但无原文 → 展示"该仓库没有 README"
 * - 未获取 → 展示"尚未获取"引导翻译
 */
export default function RepoReadmeCard({ repo, translatingReadme, onTranslateReadme, onRetranslateReadme }: RepoReadmeCardProps) {
    const [fullscreenVisible, setFullscreenVisible] = useState(false)

    const hasReadmeTranslation = !!repo.readmeCn
    const hasReadmeOriginal = !!repo.readmeOriginal

    // —————— 卡片标题 ——————
    const cardTitle = (() => {
        if (hasReadmeTranslation) {
            return (
                <Space>
                    <ReadOutlined />
                    <span>README 中文翻译</span>
                </Space>
            )
        }
        if (hasReadmeOriginal) {
            return (
                <Space>
                    <ReadOutlined />
                    <span>README 原文</span>
                </Space>
            )
        }
        return (
            <Space>
                <ReadOutlined />
                <span>README</span>
            </Space>
        )
    })()

    // —————— 卡片主体内容 ——————
    let readmeContent: ReactNode
    if (hasReadmeTranslation) {
        // 场景1：有中文翻译 → 渲染翻译结果（内容自然展开，随页面滚动）
        readmeContent = (
            <MarkdownRenderer
                content={repo.readmeCn ?? ''}
                style={{ padding: '8px 16px' }}
            />
        )
    } else if (repo.readmeFetched && hasReadmeOriginal) {
        // 场景2：已获取但未翻译，但有原文 → 展示原文 + 翻译引导
        readmeContent = (
            <div>
                <Alert
                    type='info'
                    showIcon
                    description={
                        <span>
                            该仓库尚未翻译，当前展示<Text strong>原文</Text>。
                            {repo.descriptionCn && (
                                <Text type='secondary' style={{ marginLeft: 4 }}>
                                    （描述已翻译，README 翻译需单独触发）
                                </Text>
                            )}
                        </span>
                    }
                    style={{ marginBottom: 16 }}
                    action={
                        <Button
                            size='small'
                            type='primary'
                            icon={<TranslationOutlined />}
                            loading={translatingReadme}
                            onClick={onTranslateReadme}
                        >
                            翻译 README
                        </Button>
                    }
                />
                <MarkdownRenderer
                    content={repo.readmeOriginal ?? ''}
                    style={{ padding: '8px 16px' }}
                />
            </div>
        )
    } else if (repo.readmeFetched && !hasReadmeOriginal) {
        // 场景3：已获取但无原文 → 仓库确实没有 README
        readmeContent = (
            <div style={{ textAlign: 'center', padding: 24 }}>
                <ReadOutlined style={{ fontSize: 32, color: '#d9d9d9', marginBottom: 8 }} />
                <br />
                <Text type='secondary'>该仓库没有 README</Text>
            </div>
        )
    } else {
        // 场景4：未获取 → 引导翻译
        readmeContent = (
            <div style={{ textAlign: 'center', padding: 24 }}>
                <ReadOutlined style={{ fontSize: 32, color: '#d9d9d9', marginBottom: 8 }} />
                <br />
                <Text type='secondary'>README 尚未获取</Text>
                <br />
                <Button
                    type='primary'
                    icon={<TranslationOutlined />}
                    loading={translatingReadme}
                    onClick={onTranslateReadme}
                    style={{ marginTop: 8 }}
                >
                    翻译 README
                </Button>
            </div>
        )
    }

    // —————— 卡片右上角按钮 ——————
    let extraContent: ReactNode
    if (hasReadmeTranslation) {
        // 已翻译 → 显示 "放大查看" + "重新翻译"
        extraContent = (
            <Space>
                <Button size='small' icon={<ExpandOutlined />} onClick={() => setFullscreenVisible(true)}>
                    放大查看
                </Button>
                <Button
                    size='small'
                    icon={<ReloadOutlined />}
                    loading={translatingReadme}
                    onClick={onRetranslateReadme}
                >
                    重新翻译
                </Button>
            </Space>
        )
    } else if (repo.readmeFetched && !hasReadmeOriginal) {
        // 已获取但无 README → 显示 "重新获取"
        extraContent = (
            <Button
                size='small'
                icon={<ReloadOutlined />}
                loading={translatingReadme}
                onClick={onRetranslateReadme}
            >
                重新获取
            </Button>
        )
    } else {
        // 有原文但未翻译 / 未获取 → 显示 "翻译 README"
        extraContent = (
            <Button
                type='primary'
                size='small'
                icon={<TranslationOutlined />}
                loading={translatingReadme}
                onClick={onTranslateReadme}
            >
                翻译 README
            </Button>
        )
    }

    // —————— 全屏查看弹窗内容 ——————
    const fullscreenContent = hasReadmeTranslation ? (repo.readmeCn ?? '') : (repo.readmeOriginal ?? '')
    const fullscreenTitle = hasReadmeTranslation ? 'README 中文翻译 - 全屏查看' : 'README 原文 - 全屏查看'

    return (
        <>
            <Card title={cardTitle} extra={extraContent}>
                {readmeContent}
            </Card>

            {/* README 全屏查看弹窗 */}
            <Modal
                title={
                    <Space>
                        <ExpandOutlined />
                        <span>{fullscreenTitle}</span>
                    </Space>
                }
                open={fullscreenVisible}
                onCancel={() => setFullscreenVisible(false)}
                footer={
                    <Button type='primary' onClick={() => setFullscreenVisible(false)}>
                        关闭
                    </Button>
                }
                width='95%'
                style={{ top: 20, paddingBottom: 0 }}
                styles={{ body: { maxHeight: 'calc(100vh - 160px)', overflow: 'auto', padding: '16px 24px' } }}
            >
                <MarkdownRenderer content={fullscreenContent} style={{ padding: '8px 16px' }} />
            </Modal>
        </>
    )
}
