import { useMemo, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Drawer, Menu, theme, type MenuProps } from 'antd'
import { StarOutlined } from '@ant-design/icons'
import { menuGroups, getSelectedMenuKey, getOpenGroupKeys } from '@/router/menu'

type MenuItem = NonNullable<MenuProps['items']>[number]

interface Props {
  open: boolean
  onClose: () => void
}

/** 移动端侧边栏抽屉 — <768px 时替代固定侧边栏，通过 Header 汉堡按钮打开 */
export default function MobileSiderDrawer({ open, onClose }: Props) {
  const { token } = theme.useToken()
  const navigate = useNavigate()
  const location = useLocation()

  const selectedKey = getSelectedMenuKey(location.pathname)
  // openKeys 初始化与切换路由时都不重置，仅在抽屉打开事件时同步（afterOpenChange）
  const [openKeys, setOpenKeys] = useState<string[]>(() => getOpenGroupKeys(location.pathname))

  const items: MenuItem[] = useMemo(
    () =>
      menuGroups
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
        })),
    [],
  )

  return (
    <Drawer
      placement='left'
      open={open}
      onClose={onClose}
      size={260}
      afterOpenChange={(visible) => {
        if (visible) setOpenKeys(getOpenGroupKeys(location.pathname))
      }}
      styles={{
        body: { padding: 0 },
        header: { padding: '0 16px', height: 56, borderBottom: `1px solid ${token.colorBorderSecondary}` },
      }}
      title={
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 16, fontWeight: 600, color: token.colorPrimary }}>
          <StarOutlined /> GitHub Stars
        </span>
      }
    >
      <Menu
        mode='inline'
        selectedKeys={[selectedKey]}
        openKeys={openKeys}
        onOpenChange={(keys) => setOpenKeys(keys as string[])}
        items={items}
        onClick={({ key }) => {
          navigate(key)
          onClose()
        }}
        style={{ border: 'none', paddingTop: 4 }}
      />
    </Drawer>
  )
}
