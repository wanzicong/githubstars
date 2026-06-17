/**
 * 布局尺寸常量 —— 侧边栏宽度、折叠宽度等。
 *
 * 注意：这些值需与 index.css 中的 CSS 变量保持同步：
 *   --sider-width          : 220px
 *   --sider-collapsed-width: 80px
 *
 * @callers
 *   - LayoutSider（设置 Antd Sider 尺寸、包装器宽度）
 *   - LayoutHeader（计算 side-mode 平移偏移量）
 *   - DefaultLayout（计算 Content/Footer 平移偏移量）
 *
 * @depends
 *   - index.css（CSS 变量 --sider-width / --sider-collapsed-width 为权威来源）
 */

/** 侧边栏展开宽度（需与 CSS 变量 --sider-width 保持同步） */
export const SIDER_WIDTH = 220

/** 侧边栏折叠宽度（需与 CSS 变量 --sider-collapsed-width 保持同步） */
export const SIDER_COLLAPSED_WIDTH = 80
