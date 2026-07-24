import { useLocation, useNavigate } from 'react-router-dom'
import { Layout, theme, Space, Button, Tooltip, Breadcrumb, Menu } from 'antd'
import { MenuFoldOutlined, MenuUnfoldOutlined, MenuOutlined, SettingOutlined } from '@ant-design/icons'
import { useAppStore } from '@/stores'
import { menuItems, getMenuTitle, getSelectedMenuKey } from '@/router/menu'

interface Props {
  /** 是否为手机端（<768px），手机端显示汉堡按钮打开抽屉 */
  isMobile?: boolean
  /** 手机端汉堡按钮点击回调 */
  onOpenMobileMenu?: () => void
  onOpenSetting?: () => void
}

/** 顶部导航栏 + 面包屑 */
export default function LayoutHeader({ isMobile = false, onOpenMobileMenu, onOpenSetting }: Props) {
  const { token } = theme.useToken()
  const navigate = useNavigate()
  const location = useLocation()
  const layoutMode = useAppStore((s) => s.layoutMode)
  const siderCollapsed = useAppStore((s) => s.siderCollapsed)
  const toggleSiderCollapsed = useAppStore((s) => s.toggleSiderCollapsed)
  const showBreadcrumb = useAppStore((s) => s.showBreadcrumb)

  // ── 面包屑 ──
  const segments = location.pathname.split('/').filter(Boolean)
  const breadcrumbItems = segments.length > 0 ? [
    { title: <a onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>首页</a> },
    ...segments.map((seg, i) => {
      const path = '/' + segments.slice(0, i + 1).join('/')
      const isId = /^\d+$/.test(seg) || /^[a-f0-9-]{36}$/.test(seg)
      return { title: isId ? getMenuTitle(path) : <a onClick={() => navigate(path)} style={{ cursor: 'pointer' }}>{getMenuTitle(path)}</a> }
    }),
  ] : []

  const settingBtn = (
    <Tooltip title='布局设置'>
      <Button type='text' icon={<SettingOutlined />} onClick={onOpenSetting} aria-label='布局设置' />
    </Tooltip>
  )

  const selectedKey = getSelectedMenuKey(location.pathname)

  // 手机端：侧边栏隐藏，折叠按钮改为汉堡按钮打开抽屉
  const collapseBtn = isMobile ? (
    <Button
      type='text'
      icon={<MenuOutlined />}
      onClick={onOpenMobileMenu}
      aria-label='打开菜单'
    />
  ) : (
    <Button
      type='text'
      icon={siderCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
      onClick={toggleSiderCollapsed}
      aria-label={siderCollapsed ? '展开侧边栏' : '折叠侧边栏'}
    />
  )

  // ── 侧边栏模式 ──
  if (layoutMode === 'side') {
    return (
      <Layout.Header
        className='layout-header-side'
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: token.colorBgContainer, borderBottom: `1px solid ${token.colorBorderSecondary}`,
          padding: '0 16px', height: 56, position: 'sticky', top: 0, zIndex: 99,
        }}>
        <Space size={8} style={{ minWidth: 0, overflow: 'hidden' }}>
          {collapseBtn}
          {isMobile && (
            <span style={{ fontSize: 16, fontWeight: 600, color: token.colorPrimary, whiteSpace: 'nowrap' }}>
              GitHub Stars
            </span>
          )}
          {!isMobile && showBreadcrumb && segments.length > 0 && <Breadcrumb style={{ fontSize: 13 }} items={breadcrumbItems} />}
        </Space>
        {settingBtn}
      </Layout.Header>
    )
  }

  // ── 顶部导航模式 ──
  return (
    <Layout.Header style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      background: token.colorBgContainer, borderBottom: `1px solid ${token.colorBorderSecondary}`,
      padding: '0 16px', height: 56, position: 'sticky', top: 0, zIndex: 102,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
        {isMobile && collapseBtn}
        <span style={{ fontSize: 18, fontWeight: 600, color: token.colorPrimary, whiteSpace: 'nowrap' }}>GitHub Stars</span>
        {!isMobile && (
          <div style={{ flex: 1, minWidth: 0 }}>
            <Menu
              mode='horizontal'
              selectedKeys={[selectedKey]}
              items={menuItems.map((item) => ({ key: item.key, icon: item.icon, label: item.label }))}
              onClick={({ key }) => navigate(key)}
              style={{ border: 'none' }}
            />
          </div>
        )}
      </div>
      {settingBtn}
    </Layout.Header>
  )
}
