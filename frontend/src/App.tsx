import { lazy, Suspense, type ComponentType } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { ConfigProvider, App as AntApp, Spin } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import ErrorBoundary from './components/ErrorBoundary'
import AppLayout from './components/Layout'

// ── 懒加载页面 — 首屏仅加载 StarList，其余按需加载 ──
const StarList = lazy(() => import('./pages/StarList'))
const StarDetail = lazy(() => import('./pages/StarDetail'))
const Stats = lazy(() => import('./pages/Stats'))
const Sync = lazy(() => import('./pages/Sync'))
const Classify = lazy(() => import('./pages/Classify'))
const CategoryList = lazy(() => import('./pages/CategoryList'))
const CategoryDetail = lazy(() => import('./pages/CategoryDetail'))
const AuthorList = lazy(() => import('./pages/AuthorList'))
const AuthorDetail = lazy(() => import('./pages/AuthorDetail'))
const Settings = lazy(() => import('./pages/Settings'))
const GithubSearch = lazy(() => import('./pages/GithubSearch'))
const Trending = lazy(() => import('./pages/Trending'))
const CloneTasks = lazy(() => import('./pages/CloneTasks'))
const CloneTaskDetail = lazy(() => import('./pages/CloneTaskDetail'))
const Logs = lazy(() => import('./pages/Logs'))

/** 页面级 Suspense 回退 — 居中加载指示器 */
function PageLoader() {
    return (
        <div
            style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                minHeight: '40vh',
            }}
        >
            <Spin size='large' />
        </div>
    )
}

/** 懒加载页面包装器 — 统一 ErrorBoundary + Suspense */
function LazyPage({ Page }: { Page: ComponentType }) {
    return (
        <ErrorBoundary>
            <Suspense fallback={<PageLoader />}>
                <Page />
            </Suspense>
        </ErrorBoundary>
    )
}

export default function App() {
    return (
        <ConfigProvider
            locale={zhCN}
            theme={{
                token: {
                    colorPrimary: '#1a1a2e',
                    borderRadius: 8,
                },
            }}
        >
            <AntApp>
                <BrowserRouter>
                    <ErrorBoundary>
                        <Routes>
                            <Route element={<AppLayout />}>
                                <Route path='/' element={<LazyPage Page={StarList} />} />
                                <Route path='/stars/:id' element={<LazyPage Page={StarDetail} />} />
                                <Route path='/stats' element={<LazyPage Page={Stats} />} />
                                <Route path='/sync' element={<LazyPage Page={Sync} />} />
                                <Route path='/ai/classify' element={<LazyPage Page={Classify} />} />
                                <Route path='/categories' element={<LazyPage Page={CategoryList} />} />
                                <Route path='/categories/:id' element={<LazyPage Page={CategoryDetail} />} />
                                <Route path='/authors' element={<LazyPage Page={AuthorList} />} />
                                <Route path='/authors/:ownerName' element={<LazyPage Page={AuthorDetail} />} />
                                <Route path='/settings' element={<LazyPage Page={Settings} />} />
                                <Route path='/search' element={<LazyPage Page={GithubSearch} />} />
                                <Route path='/trending' element={<LazyPage Page={Trending} />} />
                                <Route path='/clone-tasks' element={<LazyPage Page={CloneTasks} />} />
                                <Route path='/clone-tasks/:taskId' element={<LazyPage Page={CloneTaskDetail} />} />
                                <Route path='/logs' element={<LazyPage Page={Logs} />} />
                            </Route>
                        </Routes>
                    </ErrorBoundary>
                </BrowserRouter>
            </AntApp>
        </ConfigProvider>
    )
}
