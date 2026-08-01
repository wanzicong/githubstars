import { lazy, useState, useEffect, Suspense } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Layout, Spin, Grid } from 'antd'
import { useAppStore, useMultipleTabStore } from '@/stores'
import { useGlobalShortcuts } from '@/hooks/useGlobalShortcuts'
import ErrorBoundary from '@/components/common/ErrorBoundary'
import PersistentRouteView from '@/components/common/PersistentRouteView'
import LayoutSider from './sider/LayoutSider'
import MobileSiderDrawer from './sider/MobileSiderDrawer'
import LayoutHeader from './header/LayoutHeader'
import MultipleTabs from './tabs/MultipleTabs'
import SettingDrawer from './setting/SettingDrawer'
import { SIDER_WIDTH, SIDER_COLLAPSED_WIDTH } from './constants'

const { Content } = Layout
const AgentChat = lazy(() => import('@/pages/AgentChat'))

/** 路由切换时滚动到顶部 */
function useScrollToTop() {
    const { pathname } = useLocation()
    useEffect(() => {
        window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
    }, [pathname])
}

/** 默认布局 —— Sider + Header + Tabs + Content */
export default function DefaultLayout() {
    useScrollToTop()
    useGlobalShortcuts()
    const layoutMode = useAppStore((s) => s.layoutMode)
    const showTabs = useAppStore((s) => s.showTabs)
    const darkMode = useAppStore((s) => s.darkMode)
    const contentWidth = useAppStore((s) => s.contentWidth)
    const siderCollapsed = useAppStore((s) => s.siderCollapsed)
    const refreshKey = useMultipleTabStore((s) => s.refreshKey)
    const tabs = useMultipleTabStore((s) => s.tabs)
    const [settingOpen, setSettingOpen] = useState(false)
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

    // Ant Design 断点：md = ≥768px。screens.md 为 false 即手机端
    const screens = Grid.useBreakpoint()
    const isMobile = !screens.md

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light')
    }, [darkMode])

    // 平板端（768-1024px）自动折叠侧边栏，用户可手动展开
    useEffect(() => {
        const mq = window.matchMedia('(min-width: 768px) and (max-width: 1024px)')
        const handler = (e: MediaQueryListEvent | MediaQueryList) => {
            if (e.matches) {
                useAppStore.getState().setSiderCollapsed(true)
            }
        }
        handler(mq)
        mq.addEventListener('change', handler)
        return () => mq.removeEventListener('change', handler)
    }, [])

    // 路由变化时关闭移动端抽屉（渲染期间派生状态，避免 effect 内 setState）
    const { pathname } = useLocation()
    const isAgentRoute = pathname === '/agent'
    const [prevPathname, setPrevPathname] = useState(pathname)
    if (prevPathname !== pathname) {
        setPrevPathname(pathname)
        if (mobileMenuOpen) setMobileMenuOpen(false)
    }

    const isSideMode = layoutMode === 'side'
    const sideMargin = siderCollapsed ? SIDER_COLLAPSED_WIDTH : SIDER_WIDTH
    // MultipleTabs 在仅 1 个标签时不渲染，minHeight 需据此计算避免底部空白
    const tabsVisible = showTabs && tabs.length > 1
    const minHeight = `calc(100vh - 56px - ${tabsVisible ? 40 : 0}px)` // header 56px + tabs(可选)

    const content = (
        <Content
            className={isSideMode ? 'layout-content-side' : undefined}
            style={{
                padding: isMobile ? '12px 12px' : '16px 24px',
                maxWidth: contentWidth === 'fixed' ? 1400 : 'none',
                width: '100%',
                margin: '0 auto',
                minHeight,
                background: 'var(--content-bg)',
            }}
        >
            <Suspense
                fallback={
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '40vh' }}>
                        <Spin size='large' />
                    </div>
                }
            >
                <div key={refreshKey} className='page-enter' style={{ display: isAgentRoute ? 'none' : 'block' }}>
                    <Outlet />
                </div>
                <PersistentRouteView active={isAgentRoute}>
                    <ErrorBoundary>
                        <AgentChat />
                    </ErrorBoundary>
                </PersistentRouteView>
            </Suspense>
        </Content>
    )


    const drawer = <SettingDrawer open={settingOpen} onClose={() => setSettingOpen(false)} />

    // 顶部导航模式
    if (layoutMode === 'top') {
        return (
            <Layout style={{ minHeight: '100vh' }}>
                <LayoutHeader
                    isMobile={isMobile}
                    onOpenMobileMenu={() => setMobileMenuOpen(true)}
                    onOpenSetting={() => setSettingOpen(true)}
                />
                {showTabs && <MultipleTabs />}
                {content}
                {drawer}
                <MobileSiderDrawer open={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />
            </Layout>
        )
    }

    // 侧边栏模式（默认）
    return (
        <Layout style={{ minHeight: '100vh' }}>
            {!isMobile && <LayoutSider />}
            <Layout
                className='layout-inner-side'
                style={{
                    marginLeft: isMobile ? 0 : sideMargin,
                    transition: `margin-left var(--transition-duration) var(--transition-timing)`,
                }}
            >
                <LayoutHeader
                    isMobile={isMobile}
                    onOpenMobileMenu={() => setMobileMenuOpen(true)}
                    onOpenSetting={() => setSettingOpen(true)}
                />
                {showTabs && <MultipleTabs />}
                {content}
            </Layout>
            {drawer}
            <MobileSiderDrawer open={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />
        </Layout>
    )
}
