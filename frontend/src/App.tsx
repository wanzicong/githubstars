import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { ConfigProvider, App as AntApp } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import AppLayout from './components/Layout'
import StarList from './pages/StarList'
import StarDetail from './pages/StarDetail'
import Stats from './pages/Stats'
import Sync from './pages/Sync'
import Classify from './pages/Classify'
import CategoryList from './pages/CategoryList'
import CategoryDetail from './pages/CategoryDetail'
import AuthorList from './pages/AuthorList'
import AuthorDetail from './pages/AuthorDetail'
import Settings from './pages/Settings'
import GithubSearch from './pages/GithubSearch'
import Trending from './pages/Trending'

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
          <Routes>
            <Route element={<AppLayout />}>
              <Route path="/" element={<StarList />} />
              <Route path="/stars/:id" element={<StarDetail />} />
              <Route path="/stats" element={<Stats />} />
              <Route path="/sync" element={<Sync />} />
              <Route path="/ai/classify" element={<Classify />} />
              <Route path="/categories" element={<CategoryList />} />
              <Route path="/categories/:id" element={<CategoryDetail />} />
              <Route path="/authors" element={<AuthorList />} />
              <Route path="/authors/:ownerName" element={<AuthorDetail />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/search" element={<GithubSearch />} />
              <Route path="/trending" element={<Trending />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AntApp>
    </ConfigProvider>
  )
}
