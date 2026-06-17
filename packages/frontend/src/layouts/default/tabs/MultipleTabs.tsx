import { useEffect, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Tabs, Dropdown, type MenuProps } from 'antd'
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

  const tabs = useMultipleTabStore((s) => s.tabs)
  const activeKey = useMultipleTabStore((s) => s.activeKey)
  const addTab = useMultipleTabStore((s) => s.addTab)
  const removeTab = useMultipleTabStore((s) => s.removeTab)
  const removeOtherTabs = useMultipleTabStore((s) => s.removeOtherTabs)
  const removeLeftTabs = useMultipleTabStore((s) => s.removeLeftTabs)
  const removeRightTabs = useMultipleTabStore((s) => s.removeRightTabs)
  const removeAllTabs = useMultipleTabStore((s) => s.removeAllTabs)
  const setActiveKey = useMultipleTabStore((s) => s.setActiveKey)

  // 路由变化时自动添加标签
  useEffect(() => {
    const title = getMenuTitle(location.pathname)
    addTab({
      key: location.pathname + location.search,
      title,
      closable: location.pathname !== '/',
    })
  }, [location.pathname, location.search, addTab])

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
            // 强制刷新当前标签页：先导航到同路径触发重新渲染
            navigate(key, { replace: true })
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
          onClick: () => removeLeftTabs(key),
        },
        {
          key: 'close-right',
          label: '关闭右侧',
          onClick: () => removeRightTabs(key),
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
    [activeKey, navigate, handleTabRemove, removeOtherTabs, removeLeftTabs, removeRightTabs, removeAllTabs],
  )

  // 无标签或仅首页时不显示
  if (!tabs || tabs.length <= 1) return null

  return (
    <div
      style={{
        background: '#fff',
        borderBottom: '1px solid #f0f0f0',
        padding: '0 8px',
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
                onDoubleClick={() => navigate(tab.key, { replace: true })}
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
