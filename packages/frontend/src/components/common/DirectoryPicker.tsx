import { useState, useEffect } from 'react'
import { Input, Tag, Space, Typography, Button } from 'antd'
import { FolderOpenOutlined, HistoryOutlined, FolderOutlined } from '@ant-design/icons'
import { getRecentCloneDirectories } from '@/api/clone'
import { useDirectoryPicker } from '@/hooks/useElectron'

const { Text } = Typography

interface DirectoryPickerProps {
    value?: string
    onChange?: (value: string) => void
    placeholder?: string
}

/**
 * 目录选择器组件
 *
 * 提供目录输入框 + 历史目录快捷选择 + 本地文件夹选择（Electron 环境）。
 * 从后端获取历史任务中使用过的目录，用户可点击快速填入。
 */
export default function DirectoryPicker({ value, onChange, placeholder }: DirectoryPickerProps) {
    const [recentDirs, setRecentDirs] = useState<string[]>([])
    const { pickDirectory, isSupported: isElectronEnv } = useDirectoryPicker()

    useEffect(() => {
        const loadRecentDirs = async () => {
            try {
                const res = await getRecentCloneDirectories()
                if (res.success) setRecentDirs(res.directories)
            } catch { /* 静默失败 */ }
        }
        void loadRecentDirs()
    }, [])

    const handleSelectRecent = (dir: string) => {
        onChange?.(dir)
    }

    const handlePickDirectory = async () => {
        const dir = await pickDirectory({
            title: '选择克隆目标目录',
            defaultPath: value || undefined,
        })
        if (dir) {
            onChange?.(dir)
        }
    }

    return (
        <div>
            <Space.Compact style={{ width: '100%' }}>
                <Input
                    placeholder={placeholder || '请输入本地目录路径（如 D:\\repos\\stars）'}
                    value={value}
                    onChange={(e) => onChange?.(e.target.value)}
                    size="large"
                    prefix={<FolderOpenOutlined />}
                    style={{ flex: 1 }}
                />
                {isElectronEnv && (
                    <Button
                        size="large"
                        icon={<FolderOutlined />}
                        onClick={handlePickDirectory}
                    >
                        选择
                    </Button>
                )}
            </Space.Compact>

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
