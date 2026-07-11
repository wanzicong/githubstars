import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Layout, Menu, theme } from 'antd'
import { StarOutlined } from '@ant-design/icons'
import type { MenuProps } from 'antd'
import { useAppStore } from '@/stores'
import { menuGroups, getSelectedMenuKey, getOpenGroupKeys } from '@/router/menu'
import { SIDER_WIDTH, SIDER_COLLAPSED_WIDTH } from '../constants'

type MenuItem = NonNullable<MenuProps['items']>[number]

/** 侧边栏 -- Logo + 二级可折叠菜单 */
export default function LayoutSider() {
  const { token } = theme.useToken()
  const navigate = useNavigate()
  const location = useLocation()
  const siderCollapsed = useAppStore((s) => s.siderCollapsed)
  const toggleSiderCollapsed = useAppStore((s) => s.toggleSiderCollapsed)

  const selectedKey = getSelectedMenuKey(location.pathname)
  const width = siderCollapsed ? SIDER_COLLAPSED_WIDTH : SIDER_WIDTH

  // 展开分组状态 -- 路由切换时自动展开包含当前页面的分组
  const [openKeys, setOpenKeys] = useState<string[]>(() => getOpenGroupKeys(location.pathname))

  useEffect(() => {
    const autoOpen = getOpenGroupKeys(location.pathname)
    setOpenKeys((prev) => {
      const merged = new Set(prev)
      for (const k of autoOpen) merged.add(k)
      return Array.from(merged)
    })
  }, [location.pathname])

  // 构建二级菜单 items -- 分组 -> SubMenu，子项 -> MenuItem
  const items: MenuItem[] = menuGroups
    .slice()
    .sort((a, b) => a.orderNo - b.orderNo)
    .map((group) => ({
      key: group.key,
      icon: group.icon,
      label: group.label,
      children: group.children.map((child) => ({
        key: child.key,
        label: child.label,
      })),
    }))

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
            openKeys={siderCollapsed ? undefined : openKeys}
            onOpenChange={setOpenKeys}
            inlineCollapsed={siderCollapsed}
            items={items}
            onClick={({ key }) => navigate(key)}
            style={{ border: 'none' }}
          />
        </div>
      </Layout.Sider>
    </div>
  )
}
