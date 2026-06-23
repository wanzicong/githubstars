import { useState, useEffect } from 'react'
import { Input, Tag, Space, Typography } from 'antd'
import { FolderOpenOutlined, HistoryOutlined } from '@ant-design/icons'
import { getRecentCloneDirectories } from '@/api/clone'

const { Text } = Typography

interface DirectoryPickerProps {
    value?: string
    onChange?: (value: string) => void
    placeholder?: string
}

/**
 * 目录选择器组件
 *
 * 提供目录输入框 + 历史目录快捷选择。
 * 从后端获取历史任务中使用过的目录，用户可点击快速填入。
 */
export default function DirectoryPicker({ value, onChange, placeholder }: DirectoryPickerProps) {
    const [recentDirs, setRecentDirs] = useState<string[]>([])
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        loadRecentDirs()
    }, [])

    const loadRecentDirs = async () => {
        setLoading(true)
        try {
            const res = await getRecentCloneDirectories()
            if (res.success) {
                setRecentDirs(res.directories)
            }
        } catch {
            // 静默失败，不影响主流程
        } finally {
            setLoading(false)
        }
    }

    const handleSelectRecent = (dir: string) => {
        onChange?.(dir)
    }

    return (
        <div>
            <Input
                placeholder={placeholder || '请输入本地目录路径（如 D:\\repos\\stars）'}
                value={value}
                onChange={(e) => onChange?.(e.target.value)}
                size="large"
                prefix={<FolderOpenOutlined />}
            />

            {recentDirs.length > 0 && (
                <div style={{ marginTop: 8 }}>
                    <Space size={[0, 4]} wrap>
                        <Text type="secondary" style={{ fontSize: 12, marginRight: 4 }}>
                            <HistoryOutlined /> 常用目录：
                        </Text>
                        {recentDirs.map((dir) => (
                            <Tag
                                key={dir}
                                style={{ cursor: 'pointer', fontSize: 12 }}
                                onClick={() => handleSelectRecent(dir)}
                                color={value === dir ? 'blue' : undefined}
                            >
                                {dir}
                            </Tag>
                        ))}
                    </Space>
                </div>
            )}

            <Text type="secondary" style={{ fontSize: 12, marginTop: 4, display: 'block' }}>
                仓库将克隆到 {'{'}目标目录{'}'}/{'{'}作者{'}'}/{'{'}仓库名{'}'} 子目录
            </Text>
        </div>
    )
}
