import { useState } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { Layout, Menu, theme, Typography } from 'antd'
import {
  StarOutlined,
  SyncOutlined,
  BarChartOutlined,
  AppstoreOutlined,
  FolderOutlined,
  ThunderboltOutlined,
  UserOutlined,
  SettingOutlined,
  SearchOutlined,
} from '@ant-design/icons'

const { Header, Content, Footer } = Layout
const { Text } = Typography

const navItems = [
  { key: '/', icon: <StarOutlined />, label: 'Star列表' },
  { key: '/sync', icon: <SyncOutlined />, label: '同步管理' },
  { key: '/stats', icon: <BarChartOutlined />, label: '数据统计' },
  { key: '/ai/classify', icon: <ThunderboltOutlined />, label: 'AI分类' },
  { key: '/categories', icon: <AppstoreOutlined />, label: '分类管理' },
  { key: '/authors', icon: <UserOutlined />, label: '作者中心' },
  { key: '/settings', icon: <SettingOutlined />, label: '系统配置' },
  { key: '/search', icon: <SearchOutlined />, label: 'GitHub搜索' },
]

export default function AppLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const { token } = theme.useToken()

  const currentKey = '/' + location.pathname.split('/').filter(Boolean).slice(0, 1).join('/') || '/'
  const selectedKey = currentKey === '/ai' ? '/ai/classify' : currentKey

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: token.colorBgContainer,
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
          paddingInline: 24,
          height: 56,
          position: 'sticky',
          top: 0,
          zIndex: 100,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flex: 1, minWidth: 0 }}>
          <Text strong style={{ fontSize: 18, color: token.colorPrimary, whiteSpace: 'nowrap' }}>
            GitHub Stars
          </Text>
          <Menu
            mode="horizontal"
            selectedKeys={[selectedKey]}
            items={navItems}
            onClick={({ key }) => navigate(key)}
            style={{ flex: 1, border: 'none', minWidth: 0 }}
          />
        </div>
      </Header>
      <Content style={{ padding: '16px 24px', maxWidth: 1400, width: '100%', margin: '0 auto' }}>
        <Outlet />
      </Content>
      <Footer style={{ textAlign: 'center', color: token.colorTextTertiary, fontSize: 12 }}>
        GitHub Stars 管理系统 ©{new Date().getFullYear()}
      </Footer>
    </Layout>
  )
}
