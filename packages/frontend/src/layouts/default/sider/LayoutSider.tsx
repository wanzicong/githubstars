import { useNavigate, useLocation } from 'react-router-dom'
import { Layout, Menu, theme } from 'antd'
import { StarOutlined } from '@ant-design/icons'
import { useAppStore } from '@/stores'
import { menuItems } from '@/router/menu'
import { SIDER_WIDTH, SIDER_COLLAPSED_WIDTH } from '../constants'

/** 侧边栏 —— Logo + 菜单 */
export default function LayoutSider() {
  const { token } = theme.useToken()
  const navigate = useNavigate()
  const location = useLocation()
  const siderCollapsed = useAppStore((s) => s.siderCollapsed)
  const toggleSiderCollapsed = useAppStore((s) => s.toggleSiderCollapsed)

  const selectedKey = '/' + location.pathname.split('/').filter(Boolean)[0] || '/'
  const width = siderCollapsed ? SIDER_COLLAPSED_WIDTH : SIDER_WIDTH

  return (
    <div
      className='layout-sider-wrapper'
      style={{
        position: 'fixed', left: 0, top: 0, bottom: 0, width, zIndex: 101,
        transition: `width var(--transition-duration) var(--transition-timing)`,
      }}
    >
      <Layout.Sider
        width={SIDER_WIDTH} collapsedWidth={SIDER_COLLAPSED_WIDTH}
        collapsible collapsed={siderCollapsed} onCollapse={toggleSiderCollapsed}
        trigger={null}
        style={{
          height: '100%', background: token.colorBgContainer,
          borderRight: `1px solid ${token.colorBorderSecondary}`,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Logo */}
        <div style={{
          height: 56, flexShrink: 0, display: 'flex', alignItems: 'center',
          justifyContent: 'center', borderBottom: `1px solid ${token.colorBorderSecondary}`,
          padding: '0 16px',
        }}>
          {siderCollapsed
            ? <StarOutlined style={{ fontSize: 20, color: token.colorPrimary }} />
            : <span style={{ fontSize: 18, fontWeight: 600, color: token.colorPrimary, whiteSpace: 'nowrap' }}>GitHub Stars</span>
          }
        </div>

        {/* 菜单 */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
          <Menu
            mode='inline'
            selectedKeys={[selectedKey]}
            inlineCollapsed={siderCollapsed}
            items={menuItems.map((item) => ({ key: item.key, icon: item.icon, label: item.label }))}
            onClick={({ key }) => navigate(key)}
            style={{ border: 'none' }}
          />
        </div>
      </Layout.Sider>
    </div>
  )
}
