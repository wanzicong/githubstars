import { useEffect, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Tabs, Dropdown, theme, type MenuProps } from 'antd'
import { CloseOutlined, ReloadOutlined } from '@ant-design/icons'
import { useMultipleTabStore } from '@/stores'
import { getMenuTitle } from '@/router/menu'

/**
 * 多标签页组件 —— 显示已打开的页面标签，支持关闭/刷新操作。
 *
 * 特性：
 * - 自动监听路由变化，添加/激活标签
 * - 首页标签不可关闭
 * - 右键菜单支持关闭当前/其他/左侧/右侧/全部
 * - 双击刷新当前页面
 *
 * @callers
 *   - DefaultLayout（showTabs === true 时渲染）
 *
 * @depends
 *   - useMultipleTabStore（标签页状态管理）
 *   - router/menu.tsx（getMenuTitle 获取标题）
 */

export default function MultipleTabs() {
  const navigate = useNavigate()
  const location = useLocation()
  const { token } = theme.useToken()

  const tabs = useMultipleTabStore((s) => s.tabs)
  const activeKey = useMultipleTabStore((s) => s.activeKey)
  const addTab = useMultipleTabStore((s) => s.addTab)
  const removeTab = useMultipleTabStore((s) => s.removeTab)
  const removeOtherTabs = useMultipleTabStore((s) => s.removeOtherTabs)
  const removeLeftTabs = useMultipleTabStore((s) => s.removeLeftTabs)
  const removeRightTabs = useMultipleTabStore((s) => s.removeRightTabs)
  const removeAllTabs = useMultipleTabStore((s) => s.removeAllTabs)
  const setActiveKey = useMultipleTabStore((s) => s.setActiveKey)
  const refreshTab = useMultipleTabStore((s) => s.refreshTab)

  // 路由变化时自动添加标签（仅基于 pathname，避免筛选参数变化产生重复标签）
  useEffect(() => {
    const title = getMenuTitle(location.pathname)
    addTab({
      key: location.pathname,
      title,
      closable: location.pathname !== '/',
    })
  }, [location.pathname, addTab])

  // 标签切换 → 路由跳转
  const handleTabChange = useCallback(
    (key: string) => {
      setActiveKey(key)
      navigate(key)
    },
    [navigate, setActiveKey],
  )

  // 关闭标签
  const handleTabRemove = useCallback(
    (key: string) => {
      removeTab(key)
      // 如果关闭的是当前激活标签，跳转到新的 activeKey
      if (key === activeKey) {
        const store = useMultipleTabStore.getState()
        navigate(store.activeKey)
      }
    },
    [activeKey, navigate, removeTab],
  )

  // 右键菜单
  const contextMenu = useCallback(
    (key: string): MenuProps => ({
      items: [
        {
          key: 'refresh',
          icon: <ReloadOutlined />,
          label: '刷新页面',
          onClick: () => {
            // 先导航到右键的标签页，再递增 refreshKey 强制内容重新挂载
            if (key !== activeKey) navigate(key)
            refreshTab()
          },
        },
        { type: 'divider' },
        {
          key: 'close',
          icon: <CloseOutlined />,
          label: '关闭当前',
          disabled: key === '/',
          onClick: () => handleTabRemove(key),
        },
        {
          key: 'close-others',
          label: '关闭其他',
          onClick: () => {
            removeOtherTabs(key)
            if (activeKey !== key) navigate(key)
          },
        },
        {
          key: 'close-left',
          label: '关闭左侧',
          onClick: () => {
            removeLeftTabs(key)
            // 如果当前激活标签被移除了，导航到 store 中的新 activeKey
            const state = useMultipleTabStore.getState()
            if (!state.tabs.find((t) => t.key === activeKey)) {
              navigate(state.activeKey)
            }
          },
        },
        {
          key: 'close-right',
          label: '关闭右侧',
          onClick: () => {
            removeRightTabs(key)
            const state = useMultipleTabStore.getState()
            if (!state.tabs.find((t) => t.key === activeKey)) {
              navigate(state.activeKey)
            }
          },
        },
        {
          key: 'close-all',
          label: '关闭全部',
          onClick: () => {
            removeAllTabs()
            navigate('/')
          },
        },
      ],
    }),
    [activeKey, navigate, handleTabRemove, removeOtherTabs, removeLeftTabs, removeRightTabs, removeAllTabs, refreshTab],
  )

  // 无标签或仅首页时不显示
  if (!tabs || tabs.length <= 1) return null

  return (
    <div
      className='multiple-tabs-container'
      style={{
        background: token.colorBgContainer,
        borderBottom: `1px solid ${token.colorBorderSecondary}`,
        padding: '0 8px',
        overflow: 'hidden',
        // 固定在 header 下方：header 高度 56px、z-index 100；tabs 用 z-index 99 让 Dropdown 不被遮挡
        position: 'sticky',
        top: 56,
        zIndex: 99,
      }}
    >
      <Tabs
        type='editable-card'
        hideAdd
        size='small'
        activeKey={activeKey}
        items={tabs.map((tab) => ({
          key: tab.key,
          label: (
            <Dropdown menu={contextMenu(tab.key)} trigger={['contextMenu']}>
              <span
                onDoubleClick={() => refreshTab()}
                style={{ display: 'inline-block', userSelect: 'none' }}
              >
                {tab.title}
              </span>
            </Dropdown>
          ),
          closable: tab.closable,
        }))}
        onChange={handleTabChange}
        onEdit={(key, action) => {
          if (action === 'remove' && typeof key === 'string') {
            handleTabRemove(key)
          }
        }}
        style={{ marginBottom: 0 }}
      />
    </div>
  )
}
