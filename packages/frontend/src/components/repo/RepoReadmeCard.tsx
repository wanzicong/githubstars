import { useState } from 'react'
import { Card, Button, Space, Typography, Modal } from 'antd'
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
 * 仓库详情页 README 翻译卡片
 *
 * 展示 README 中文翻译，支持翻译/重新翻译/全屏查看。
 */
export default function RepoReadmeCard({ repo, translatingReadme, onTranslateReadme, onRetranslateReadme }: RepoReadmeCardProps) {
    const [fullscreenVisible, setFullscreenVisible] = useState(false)

    return (
        <>
            <Card
                title={
                    <Space>
                        <ReadOutlined />
                        <span>README 中文翻译</span>
                    </Space>
                }
                extra={
                    !repo.readmeFetched ? (
                        <Button
                            type='primary'
                            size='small'
                            icon={<TranslationOutlined />}
                            loading={translatingReadme}
                            onClick={onTranslateReadme}
                        >
                            翻译 README
                        </Button>
                    ) : (
                        <Space>
                            {repo.readmeCn && (
                                <Button size='small' icon={<ExpandOutlined />} onClick={() => setFullscreenVisible(true)}>
                                    放大查看
                                </Button>
                            )}
                            <Button
                                size='small'
                                icon={<ReloadOutlined />}
                                loading={translatingReadme}
                                onClick={onRetranslateReadme}
                            >
                                {repo.readmeCn ? '重新翻译' : '重新获取'}
                            </Button>
                        </Space>
                    )
                }
            >
                {repo.readmeFetched && repo.readmeCn ? (
                    <MarkdownRenderer
                        content={repo.readmeCn}
                        style={{ overflow: 'auto', maxHeight: 600, padding: '8px 16px' }}
                    />
                ) : repo.readmeFetched && !repo.readmeCn ? (
                    <div style={{ textAlign: 'center', padding: 24 }}>
                        <ReadOutlined style={{ fontSize: 32, color: '#d9d9d9', marginBottom: 8 }} />
                        <br />
                        <Text type='secondary'>该仓库没有 README</Text>
                    </div>
                ) : (
                    <div style={{ textAlign: 'center', padding: 24 }}>
                        <ReadOutlined style={{ fontSize: 32, color: '#d9d9d9', marginBottom: 8 }} />
                        <br />
                        <Text type='secondary'>README 尚未翻译</Text>
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
                )}
            </Card>

            {/* README 全屏查看弹窗 */}
            <Modal
                title={
                    <Space>
                        <ExpandOutlined />
                        <span>README 中文翻译 - 全屏查看</span>
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
                <MarkdownRenderer content={repo?.readmeCn || ''} style={{ padding: '8px 16px' }} />
            </Modal>
        </>
    )
}
