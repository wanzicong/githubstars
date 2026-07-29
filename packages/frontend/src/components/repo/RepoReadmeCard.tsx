import { useState, type ReactNode } from 'react'
import { Card, Button, Space, Typography, Modal } from 'antd'
import { ReadOutlined, ExpandOutlined } from '@ant-design/icons'
import type { GithubRepo } from '../../types'
import MarkdownRenderer from '../common/MarkdownRenderer'

const { Text } = Typography

export interface RepoReadmeCardProps {
    repo: GithubRepo
}

/**
 * 仓库详情页 README 卡片
 *
 * 优先展示已有中文 README，缺失时回退 GitHub 原文：
 * - 有中文或原文 → 渲染对应 Markdown
 * - 已获取但无内容 → 展示“该仓库没有 README”
 * - 未获取 → 展示“README 尚未获取”
 */
export default function RepoReadmeCard({ repo }: RepoReadmeCardProps) {
    const [fullscreenVisible, setFullscreenVisible] = useState(false)

    const displayReadme = repo.readmeCn || repo.readmeOriginal || ''
    const hasReadme = Boolean(displayReadme)
    const showingChinese = Boolean(repo.readmeCn)
    const readmeLabel = showingChinese ? 'README 中文' : 'README 原文'

    const cardTitle = (
        <Space>
            <ReadOutlined />
            <span>{hasReadme ? readmeLabel : 'README'}</span>
        </Space>
    )

    // —————— 卡片主体内容 ——————
    let readmeContent: ReactNode
    if (hasReadme) {
        readmeContent = (
            <MarkdownRenderer
                content={displayReadme}
                style={{ padding: '8px 16px' }}
            />
        )
    } else if (repo.readmeFetched) {
        readmeContent = (
            <div style={{ textAlign: 'center', padding: 24 }}>
                <ReadOutlined style={{ fontSize: 32, color: '#d9d9d9', marginBottom: 8 }} />
                <br />
                <Text type='secondary'>该仓库没有 README</Text>
            </div>
        )
    } else {
        readmeContent = (
            <div style={{ textAlign: 'center', padding: 24 }}>
                <ReadOutlined style={{ fontSize: 32, color: '#d9d9d9', marginBottom: 8 }} />
                <br />
                <Text type='secondary'>README 尚未获取</Text>
            </div>
        )
    }

    const extraContent = hasReadme ? (
        <Button size='small' icon={<ExpandOutlined />} onClick={() => setFullscreenVisible(true)}>
            放大查看
        </Button>
    ) : undefined

    return (
        <>
            <Card className='star-detail-readme-shell' title={cardTitle} extra={extraContent}>
                {readmeContent}
            </Card>

            {/* README 全屏查看弹窗 */}
            <Modal
                title={
                    <Space>
                        <ExpandOutlined />
                        <span>{readmeLabel} - 全屏查看</span>
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
                <MarkdownRenderer content={displayReadme} style={{ padding: '8px 16px' }} />
            </Modal>
        </>
    )
}
