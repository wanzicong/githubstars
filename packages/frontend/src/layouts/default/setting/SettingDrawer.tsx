import { Drawer, Switch, Select, Divider, Typography, Space, Button, theme } from 'antd'
import {
  SettingOutlined,
  ReloadOutlined,
} from '@ant-design/icons'
import { useAppStore, type LayoutMode } from '@/stores'
import { PRIMARY_COLORS } from '@/designs'

const { Text } = Typography

/**
 * 布局设置抽屉 —— 用户可以实时调整主题色、布局模式、UI 选项。
 *
 * 所有设置通过 appStore 持久化到 localStorage，刷新后保留。
 *
 * @callers
 *   - DefaultLayout（通过 Header 中的设置按钮触发）
 *
 * @depends
 *   - useAppStore（读写所有布局相关设置）
 */

interface SettingDrawerProps {
  open: boolean
  onClose: () => void
}

export default function SettingDrawer({ open, onClose }: SettingDrawerProps) {
  const { token } = theme.useToken()

  const darkMode = useAppStore((s) => s.darkMode)
  const primaryColor = useAppStore((s) => s.primaryColor)
  const layoutMode = useAppStore((s) => s.layoutMode)
  const showTabs = useAppStore((s) => s.showTabs)
  const showBreadcrumb = useAppStore((s) => s.showBreadcrumb)
  const contentWidth = useAppStore((s) => s.contentWidth)

  const setDarkMode = useAppStore((s) => s.setDarkMode)
  const setPrimaryColor = useAppStore((s) => s.setPrimaryColor)
  const setLayoutMode = useAppStore((s) => s.setLayoutMode)
  const setShowTabs = useAppStore((s) => s.setShowTabs)
  const setShowBreadcrumb = useAppStore((s) => s.setShowBreadcrumb)
  const setContentWidth = useAppStore((s) => s.setContentWidth)

  const handleReset = () => {
    setDarkMode(false)
    setPrimaryColor('#1a1a2e')
    setLayoutMode('side')
    setShowTabs(true)
    setShowBreadcrumb(true)
    setContentWidth('fixed')
  }

  return (
    <Drawer
      title={
        <Space>
          <SettingOutlined />
          <span>布局设置</span>
        </Space>
      }
      open={open}
      onClose={onClose}
      width={300}
      extra={
        <Button
          type='text'
          icon={<ReloadOutlined />}
          onClick={handleReset}
          title='恢复默认设置'
          aria-label='恢复默认设置'
        />
      }
      styles={{ body: { padding: '16px' } }}
    >
      {/* ── 主题模式 ── */}
      <div style={{ marginBottom: 24 }}>
        <Text strong style={{ display: 'block', marginBottom: 12, fontSize: 14 }}>
          主题模式
        </Text>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text type='secondary'>深色模式</Text>
          <Switch
            checked={darkMode}
            onChange={setDarkMode}
            checkedChildren='🌙'
            unCheckedChildren='☀️'
          />
        </div>
      </div>

      <Divider style={{ margin: '16px 0' }} />

      {/* ── 主题色 ── */}
      <div style={{ marginBottom: 24 }}>
        <Text strong style={{ display: 'block', marginBottom: 12, fontSize: 14 }}>
          主题色
        </Text>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {PRIMARY_COLORS.map((color) => (
            <div
              key={color}
              onClick={() => setPrimaryColor(color)}
              style={{
                width: 28,
                height: 28,
                borderRadius: 6,
                background: color,
                cursor: 'pointer',
                border: primaryColor === color ? `3px solid ${token.colorPrimary}` : '3px solid transparent',
                boxShadow: primaryColor === color ? `0 0 0 2px ${color}40` : 'none',
                transition: 'all 0.2s',
              }}
            />
          ))}
        </div>
      </div>

      <Divider style={{ margin: '16px 0' }} />

      {/* ── 布局模式 ── */}
      <div style={{ marginBottom: 24 }}>
        <Text strong style={{ display: 'block', marginBottom: 12, fontSize: 14 }}>
          导航模式
        </Text>
        <Select<LayoutMode>
          value={layoutMode}
          onChange={setLayoutMode}
          style={{ width: '100%' }}
          options={[
            { value: 'side', label: '侧边栏导航' },
            { value: 'top', label: '顶部导航' },
          ]}
        />
      </div>

      <Divider style={{ margin: '16px 0' }} />

      {/* ── UI 选项 ── */}
      <div style={{ marginBottom: 24 }}>
        <Text strong style={{ display: 'block', marginBottom: 12, fontSize: 14 }}>
          界面选项
        </Text>
        <Space direction='vertical' style={{ width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text type='secondary'>多标签页</Text>
            <Switch checked={showTabs} onChange={setShowTabs} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text type='secondary'>面包屑导航</Text>
            <Switch checked={showBreadcrumb} onChange={setShowBreadcrumb} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text type='secondary'>内容区宽度</Text>
            <Select
              value={contentWidth}
              onChange={setContentWidth}
              size='small'
              style={{ width: 120 }}
              options={[
                { value: 'fixed', label: '固定宽度' },
                { value: 'fluid', label: '自适应' },
              ]}
            />
          </div>
        </Space>
      </div>
    </Drawer>
  )
}
