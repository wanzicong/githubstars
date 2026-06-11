import { useState, useEffect } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { Layout, Menu, theme, Typography, Button, Tooltip, Space } from 'antd'
import {
  StarOutlined,
  SyncOutlined,
  BarChartOutlined,
  AppstoreOutlined,
  ThunderboltOutlined,
  UserOutlined,
  SettingOutlined,
  SearchOutlined,
  FireOutlined,
  CloudDownloadOutlined,
  MenuOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
} from '@ant-design/icons'

const { Header, Sider, Content, Footer } = Layout
const { Text } = Typography

type LayoutMode = 'top' | 'side'

const LAYOUT_KEY = 'githubstars-layout-mode'

const navItems = [
  { key: '/', icon: <StarOutlined />, label: 'Star列表' },
  { key: '/sync', icon: <SyncOutlined />, label: '同步管理' },
  { key: '/stats', icon: <BarChartOutlined />, label: '数据统计' },
  { key: '/ai/classify', icon: <ThunderboltOutlined />, label: 'AI分类' },
  { key: '/categories', icon: <AppstoreOutlined />, label: '分类管理' },
  { key: '/authors', icon: <UserOutlined />, label: '作者中心' },
  { key: '/clone-tasks', icon: <CloudDownloadOutlined />, label: '克隆管理' },
  { key: '/settings', icon: <SettingOutlined />, label: '系统配置' },
  { key: '/search', icon: <SearchOutlined />, label: 'GitHub搜索' },
  { key: '/trending', icon: <FireOutlined />, label: '趋势排行' },
]

function getSelectedKey(pathname: string) {
  const currentKey = '/' + pathname.split('/').filter(Boolean).slice(0, 1).join('/') || '/'
  return currentKey === '/ai' ? '/ai/classify' : currentKey
}

/** 注入 Menu 选中态样式 — 用主色替代默认灰色 */
function MenuStyles({ token }: { token: any }) {
  return (
    <style>{`
      /* ── 顶部水平菜单选中态 ── */
      .ant-menu-horizontal .ant-menu-item-selected {
        color: ${token.colorPrimary} !important;
      }
      .ant-menu-horizontal .ant-menu-item-selected::after {
        border-bottom-color: ${token.colorPrimary} !important;
      }
      .ant-menu-horizontal .ant-menu-item:hover {
        color: ${token.colorPrimary} !important;
      }

      /* ── 侧边栏内联菜单选中态 ── */
      .ant-menu-inline .ant-menu-item-selected {
        background: ${token.colorPrimaryBg} !important;
        color: ${token.colorPrimary} !important;
        border-radius: 8px;
        margin: 2px 8px;
        width: auto !important;
      }
      .ant-menu-inline .ant-menu-item-selected::after {
        border-right-color: ${token.colorPrimary} !important;
      }
      .ant-menu-inline .ant-menu-item {
        border-radius: 8px;
        margin: 2px 8px;
        width: auto !important;
      }
      .ant-menu-inline .ant-menu-item:hover {
        color: ${token.colorPrimary} !important;
        background: ${token.colorFillSecondary} !important;
      }
      .ant-menu-inline .ant-menu-submenu-selected > .ant-menu-submenu-title {
        color: ${token.colorPrimary} !important;
      }

      /* ── 收起状态下的弹出菜单选中态 ── */
      .ant-menu-vertical .ant-menu-item-selected {
        background: ${token.colorPrimaryBg} !important;
        color: ${token.colorPrimary} !important;
        border-radius: 8px;
      }
    `}</style>
  )
}

export default function AppLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const { token } = theme.useToken()

  const [layoutMode, setLayoutMode] = useState<LayoutMode>(() => {
    const saved = localStorage.getItem(LAYOUT_KEY)
    return saved === 'side' ? 'side' : 'top'
  })
  const [siderCollapsed, setSiderCollapsed] = useState(false)

  useEffect(() => {
    localStorage.setItem(LAYOUT_KEY, layoutMode)
  }, [layoutMode])

  const selectedKey = getSelectedKey(location.pathname)

  const brand = (
    <Text strong style={{ fontSize: 18, color: token.colorPrimary, whiteSpace: 'nowrap' }}>
      GitHub Stars
    </Text>
  )

  const toggleLayout = () => {
    setLayoutMode(prev => prev === 'top' ? 'side' : 'top')
  }

  // ── 顶部导航模式 ──
  if (layoutMode === 'top') {
    return (
      <Layout style={{ minHeight: '100vh' }}>
        <MenuStyles token={token} />
        <Header style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: token.colorBgContainer,
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
          paddingInline: 16, height: 56,
          position: 'sticky', top: 0, zIndex: 100,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
            {brand}
            <Menu
              mode="horizontal"
              selectedKeys={[selectedKey]}
              items={navItems}
              onClick={({ key }) => navigate(key)}
              style={{ flex: 1, border: 'none', minWidth: 0 }}
            />
          </div>
          <Tooltip title="切换到侧边栏布局">
            <Button type="text" icon={<MenuOutlined />} onClick={toggleLayout} />
          </Tooltip>
        </Header>
        <Content style={{ padding: '16px 24px', maxWidth: 1400, width: '100%', margin: '0 auto' }}>
          <Outlet />
        </Content>
        <Footer style={{ textAlign: 'center', color: token.colorTextTertiary, fontSize: 12, padding: 12 }}>
          GitHub Stars 管理系统 ©{new Date().getFullYear()}
        </Footer>
      </Layout>
    )
  }

  // ── 侧边栏导航模式 ──
  const siderWidth = siderCollapsed ? 80 : 220
  return (
    <Layout style={{ minHeight: '100vh' }}>
      <MenuStyles token={token} />

      {/* 固定侧边栏 */}
      <div style={{
        position: 'fixed',
        left: 0, top: 0, bottom: 0,
        width: siderWidth,
        zIndex: 100,
        transition: 'width 0.2s',
      }}>
        <Layout.Sider
          width={220}
          collapsedWidth={80}
          collapsible
          collapsed={siderCollapsed}
          onCollapse={setSiderCollapsed}
          trigger={null}
          style={{
            height: '100%',
            background: token.colorBgContainer,
            borderRight: `1px solid ${token.colorBorderSecondary}`,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Logo */}
          <div style={{
            height: 56, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderBottom: `1px solid ${token.colorBorderSecondary}`,
          }}>
            {siderCollapsed ? (
              <StarOutlined style={{ fontSize: 20, color: token.colorPrimary }} />
            ) : (
              brand
            )}
          </div>

          {/* 菜单 */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
            <Menu
              mode="inline"
              selectedKeys={[selectedKey]}
              items={navItems}
              onClick={({ key }) => navigate(key)}
              style={{ border: 'none' }}
            />
          </div>
        </Layout.Sider>
      </div>

      {/* 主内容区 */}
      <Layout style={{ marginLeft: siderWidth, transition: 'margin-left 0.2s', minHeight: '100vh' }}>
        <Header style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: token.colorBgContainer,
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
          paddingInline: 16, height: 56,
          position: 'sticky', top: 0, zIndex: 99,
        }}>
          <Space size={8}>
            <Button
              type="text"
              icon={siderCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setSiderCollapsed(!siderCollapsed)}
            />
            <Text type="secondary" style={{ fontSize: 13 }}>
              {navItems.find(i => i.key === selectedKey)?.label || ''}
            </Text>
          </Space>
          <Tooltip title="切换到顶部菜单布局">
            <Button type="text" icon={<MenuOutlined />} onClick={toggleLayout} />
          </Tooltip>
        </Header>
        <Content style={{ padding: '16px 24px', maxWidth: 1400, width: '100%', margin: '0 auto', flex: 1 }}>
          <Outlet />
        </Content>
        <Footer style={{ textAlign: 'center', color: token.colorTextTertiary, fontSize: 12, padding: 12 }}>
          GitHub Stars 管理系统 ©{new Date().getFullYear()}
        </Footer>
      </Layout>
    </Layout>
  )
}
