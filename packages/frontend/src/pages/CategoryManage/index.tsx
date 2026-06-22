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

    return (
        <div style={{ padding: 24 }}>
            <Row gutter={24}>
                <Col xs={24} md={8} lg={7} xl={6}>
                    <CategoryTreePanel tree={tree} />
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
