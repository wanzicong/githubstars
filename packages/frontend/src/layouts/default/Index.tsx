import { useState, useEffect, Suspense } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Layout, theme, Spin } from 'antd'
import { useAppStore, useMultipleTabStore } from '@/stores'
import LayoutSider from './sider/LayoutSider'
import LayoutHeader from './header/LayoutHeader'
import MultipleTabs from './tabs/MultipleTabs'
import SettingDrawer from './setting/SettingDrawer'
import { SIDER_WIDTH, SIDER_COLLAPSED_WIDTH } from './constants'

const { Footer, Content } = Layout

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
  const refreshKey = useMultipleTabStore((s) => s.refreshKey)
  const tabs = useMultipleTabStore((s) => s.tabs)
  const [settingOpen, setSettingOpen] = useState(false)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light')
  }, [darkMode])

  // 平板端（769-1024px）自动折叠侧边栏，用户可手动展开（CSS 不再使用 !important）
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 769px) and (max-width: 1024px)')
    const handler = (e: MediaQueryListEvent | MediaQueryList) => {
      if (e.matches) {
        useAppStore.getState().setSiderCollapsed(true)
      }
    }
    handler(mq)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

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
  // MultipleTabs 在仅 1 个标签时不渲染，minHeight 需据此计算避免底部空白
  const tabsVisible = showTabs && tabs.length > 1
  const minHeight = `calc(100vh - 56px - ${tabsVisible ? 40 : 0}px - 40px)`  // header 56px + tabs(可选) + footer 40px

  const content = (
    <Content className={isSideMode ? 'layout-content-side' : undefined} style={{
      padding: '16px 24px',
      maxWidth: contentWidth === 'fixed' ? 1400 : 'none',
      width: '100%', margin: '0 auto',
      minHeight,
      background: 'var(--content-bg)',
    }}>
      <Suspense fallback={<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '40vh' }}><Spin size='large' /></div>}>
        <div key={refreshKey}>
          <Outlet />
        </div>
      </Suspense>
    </Content>
  )

  const footer = (
    <Footer className={isSideMode ? 'layout-footer-side' : undefined} style={{
      textAlign: 'center', color: token.colorTextTertiary, fontSize: 12, padding: 12,
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
      <Layout
        className='layout-inner-side'
        style={{
          marginLeft: sideMargin,
          transition: `margin-left var(--transition-duration) var(--transition-timing)`,
        }}
      >
        <LayoutHeader onOpenSetting={() => setSettingOpen(true)} />
        {showTabs && <MultipleTabs />}
        {content}
        {footer}
      </Layout>
      {drawer}
    </Layout>
  )
}
