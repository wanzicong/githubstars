/**
 * 分类管理页面
 *
 * 布局：左侧分类树 + 右侧仓库列表
 * - 分类树：支持展开/折叠、右键菜单、拖拽排序
 * - 仓库列表：支持分页、筛选、排序、批量移除
 * - 添加仓库弹窗：搜索已有 starred 仓库并绑定
 */
import { useCallback } from 'react'
import { Row, Col } from 'antd'
import CategoryTreePanel from './components/CategoryTreePanel'
import CategoryRepoPanel from './components/CategoryRepoPanel'
import { useCategoryTree } from './hooks/useCategoryTree'
import { useCategoryRepos } from './hooks/useCategoryRepos'

export default function CategoryManage() {
    const tree = useCategoryTree()
    const repoState = useCategoryRepos(tree.selectedKey)

    const handleCategoryRefresh = useCallback(async () => {
        await tree.refresh()
    }, [tree])

    // 左侧分类树 sticky 固定：高度 = 视口 - header(56) - tabs(40) - Content 上 padding(16) - 页面 padding(24) - Content 下 padding(16) - 页面 padding(24)（footer 已移除）
    // 给一点余量防止临界抖动
    // 注意：Row 不能用 align="top"，否则 col 会被 flex 收缩到内容高度，sticky 就失去滚动空间
    // 默认 stretch 让 col 撑满 row 高度（= 最高列高度），sticky 才能在该空间内固定
    const stickyTop = 24
    const panelMaxHeight = 'calc(100vh - 200px)'

    return (
        <div style={{ padding: 24 }}>
            <Row gutter={24}>
                <Col xs={24} md={8} lg={7} xl={6}>
                    <div style={{ position: 'sticky', top: stickyTop, maxHeight: panelMaxHeight, overflowY: 'auto' }}>
                        <CategoryTreePanel tree={tree} />
                    </div>
                </Col>
                <Col xs={24} md={16} lg={17} xl={18}>
                    <CategoryRepoPanel
                        selectedNode={tree.selectedNode}
                        repoState={repoState}
                        onCategoryRefresh={handleCategoryRefresh}
                    />
                </Col>
            </Row>
        </div>
    )
}
