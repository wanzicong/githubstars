import { useState, useEffect, Suspense } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Layout, theme, Spin } from 'antd'
import { useAppStore } from '@/stores'
import LayoutSider from './sider/LayoutSider'
import LayoutHeader from './header/LayoutHeader'
import MultipleTabs from './tabs/MultipleTabs'
import SettingDrawer from './setting/SettingDrawer'

const { Footer, Content } = Layout

const SIDER_WIDTH = 220
const SIDER_COLLAPSED_WIDTH = 80

/** 路由切换时滚动到顶部 */
function useScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior }) }, [pathname])
}

/** 默认布局 —— Sider + Header + Tabs + Content + Footer */
export default function DefaultLayout() {
  useScrollToTop()
  const { token } = theme.useToken()
  const layoutMode = useAppStore((s) => s.layoutMode)
  const showTabs = useAppStore((s) => s.showTabs)
  const darkMode = useAppStore((s) => s.darkMode)
  const contentWidth = useAppStore((s) => s.contentWidth)
  const siderCollapsed = useAppStore((s) => s.siderCollapsed)
  const [settingOpen, setSettingOpen] = useState(false)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light')
  }, [darkMode])

  // Menu 样式覆盖
  const menuStyles = (
    <style>{`
      .ant-menu-horizontal .ant-menu-item-selected { color: ${token.colorPrimary} !important; }
      .ant-menu-horizontal .ant-menu-item-selected::after { border-bottom-color: ${token.colorPrimary} !important; }
      .ant-menu-horizontal .ant-menu-item:hover { color: ${token.colorPrimary} !important; }
      .ant-menu-inline .ant-menu-item-selected { background: ${token.colorPrimaryBg} !important; color: ${token.colorPrimary} !important; border-radius: 8px; margin: 2px 8px; width: auto !important; }
      .ant-menu-inline .ant-menu-item-selected::after { border-right-color: ${token.colorPrimary} !important; }
      .ant-menu-inline .ant-menu-item { border-radius: 8px; margin: 2px 8px; width: auto !important; }
      .ant-menu-inline .ant-menu-item:hover { color: ${token.colorPrimary} !important; background: ${token.colorFillSecondary} !important; }
      .ant-menu-inline .ant-menu-submenu-selected > .ant-menu-submenu-title { color: ${token.colorPrimary} !important; }
      .ant-menu-vertical .ant-menu-item-selected { background: ${token.colorPrimaryBg} !important; color: ${token.colorPrimary} !important; border-radius: 8px; }
    `}</style>
  )

  const isSideMode = layoutMode === 'side'
  const sideMargin = siderCollapsed ? SIDER_COLLAPSED_WIDTH : SIDER_WIDTH
  const minHeight = showTabs
    ? 'calc(100vh - 56px - 40px - 40px)'  // header 56px + tabs 40px + footer 40px
    : 'calc(100vh - 56px - 40px)'         // header 56px + footer 40px

  const content = (
    <Content style={{
      padding: '16px 24px',
      maxWidth: contentWidth === 'fixed' ? 1400 : 'none',
      width: '100%', margin: '0 auto',
      minHeight,
      background: 'var(--content-bg)',
      ...(isSideMode ? { marginLeft: sideMargin, transition: 'margin-left 0.2s ease' } : {}),
    }}>
      <Suspense fallback={<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '40vh' }}><Spin size='large' /></div>}>
        <Outlet />
      </Suspense>
    </Content>
  )

  const footer = (
    <Footer style={{
      textAlign: 'center', color: token.colorTextTertiary, fontSize: 12, padding: 12,
      ...(isSideMode ? { marginLeft: sideMargin, transition: 'margin-left 0.2s ease' } : {}),
    }}>
      GitHub Stars 管理系统 ©{new Date().getFullYear()}
    </Footer>
  )

  const drawer = <SettingDrawer open={settingOpen} onClose={() => setSettingOpen(false)} />

  // 顶部导航模式
  if (layoutMode === 'top') {
    return (
      <Layout style={{ minHeight: '100vh' }}>
        {menuStyles}
        <LayoutHeader onOpenSetting={() => setSettingOpen(true)} />
        {showTabs && <MultipleTabs />}
        {content}
        {footer}
        {drawer}
      </Layout>
    )
  }

  // 侧边栏模式（默认）
  return (
    <Layout style={{ minHeight: '100vh' }}>
      {menuStyles}
      <LayoutSider />
      <Layout style={{ minHeight: '100vh' }}>
        <LayoutHeader onOpenSetting={() => setSettingOpen(true)} />
        {showTabs && <MultipleTabs />}
        {content}
        {footer}
      </Layout>
      {drawer}
    </Layout>
  )
}
