import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Card, Modal, Input, Typography, App, Space, Tag, Select, Popconfirm, Divider, Radio, Empty, Spin } from 'antd'
import { PlusOutlined, DeleteOutlined, EditOutlined, ReloadOutlined, FolderOutlined, FolderAddOutlined, SearchOutlined } from '@ant-design/icons'
import * as categoriesApi from '../api/categories'
import type { Category } from '../types'

const { Title, Text, Paragraph } = Typography
const { TextArea } = Input

export default function CategoryList() {
    const { message, modal } = App.useApp()
    const navigate = useNavigate()

    const [categories, setCategories] = useState<Category[]>([])
    const [loading, setLoading] = useState(false)
    const [searchText, setSearchText] = useState('')

    // ---- Create form state (right panel) ----
    const [createType, setCreateType] = useState<'level1' | 'level2'>('level1')
    const [formName, setFormName] = useState('')
    const [formDesc, setFormDesc] = useState('')
    const [formParentId, setFormParentId] = useState<number | null>(null)
    const [saving, setSaving] = useState(false)

    // ---- Edit modal state ----
    const [editModalOpen, setEditModalOpen] = useState(false)
    const [editId, setEditId] = useState<number | null>(null)
    const [editName, setEditName] = useState('')
    const [editDesc, setEditDesc] = useState('')
    const [editSaving, setEditSaving] = useState(false)

    // ---- Add child inline state ----
    const [addingChildFor, setAddingChildFor] = useState<number | null>(null)
    const [childName, setChildName] = useState('')
    const [addingChild, setAddingChild] = useState(false)

    // ======================== Data Fetching ========================

    const fetchData = async () => {
        setLoading(true)
        try {
            const data = await categoriesApi.fetchAllCategories()
            setCategories(data)
        } catch {
            message.error('获取分类列表失败')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchData()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // ======================== Derived Data ========================

    // Flatten the tree to get all categories (for Unassigned section lookup)
    const allCategories = useMemo(() => {
        const result: Category[] = []
        const traverse = (cats: Category[]) => {
            for (const cat of cats) {
                result.push(cat)
                if (cat.children && cat.children.length > 0) {
                    traverse(cat.children)
                }
            }
        }
        traverse(categories)
        return result
    }, [categories])

    // Level 1 categories: only actual Level 1, with search filtering
    const level1Categories = useMemo(() => {
        let list = categories.filter((c) => c.level === 1)
        if (searchText) {
            const kw = searchText.toLowerCase()
            list = list.filter((c) => c.name.toLowerCase().includes(kw) || (c.description || '').toLowerCase().includes(kw))
        }
        return list
    }, [categories, searchText])

    // Unassigned Level 2: parentId === null but level === 2 (orphaned after move-out)
    const unassignedLevel2 = allCategories.filter((c) => c.parentId === null && c.level === 2)

    // Options for parent select
    const level1Options = level1Categories.map((c) => ({ label: c.name, value: c.id }))

    // ======================== Create ========================

    const handleCreate = async () => {
        if (!formName.trim()) {
            message.warning('请输入分类名称')
            return
        }
        if (createType === 'level2' && formParentId === null) {
            message.warning('请选择所属的一级分类')
            return
        }
        setSaving(true)
        try {
            const parentId = createType === 'level2' ? formParentId : null
            const res = await categoriesApi.createCategory(formName.trim(), formDesc.trim() || undefined, parentId)
            if (res.success) {
                message.success('创建成功')
                setFormName('')
                setFormDesc('')
                setFormParentId(null)
                setCreateType('level1')
                fetchData()
            } else {
                message.error(res.message || '创建失败')
            }
        } catch {
            message.error('操作失败，请稍后重试')
        } finally {
            setSaving(false)
        }
    }

    // ======================== Edit ========================

    const openEditModal = (record: Category) => {
        setEditId(record.id)
        setEditName(record.name)
        setEditDesc(record.description || '')
        setEditModalOpen(true)
    }

    const handleEditSave = async () => {
        if (!editName.trim()) {
            message.warning('请输入分类名称')
            return
        }
        if (editId === null) return
        setEditSaving(true)
        try {
            const res = await categoriesApi.updateCategory(editId, editName.trim(), editDesc.trim() || undefined)
            if (res.success) {
                message.success('更新成功')
                setEditModalOpen(false)
                fetchData()
            } else {
                message.error(res.message || '更新失败')
            }
        } catch {
            message.error('操作失败，请稍后重试')
        } finally {
            setEditSaving(false)
        }
    }

    // ======================== Delete ========================

    const handleDelete = (cat: Category) => {
        const hasChildren = cat.children && cat.children.length > 0
        modal.confirm({
            title: '确认删除',
            content: hasChildren
                ? `确定要删除「${cat.name}」吗？其下的 ${cat.children.length} 个子分类也将被一并删除。`
                : `确定要删除「${cat.name}」吗？`,
            okText: '确认删除',
            okType: 'danger',
            cancelText: '取消',
            onOk: async () => {
                try {
                    const res = await categoriesApi.deleteCategory(cat.id)
                    if (res.success) {
                        message.success('删除成功')
                        fetchData()
                    } else {
                        message.error(res.message || '删除失败')
                    }
                } catch {
                    message.error('删除失败，请稍后重试')
                }
            },
        })
    }

    // ======================== Move ========================

    const handleMove = async (id: number, newParentId: number | null) => {
        try {
            const res = await categoriesApi.moveCategory(id, newParentId)
            if (res.success) {
                message.success('移动成功')
                fetchData()
            } else {
                message.error(res.message || '移动失败')
            }
        } catch {
            message.error('移动失败，请稍后重试')
        }
    }

    // ======================== Add Child ========================

    const handleAddChild = async (parentId: number) => {
        if (!childName.trim()) {
            message.warning('请输入子分类名称')
            return
        }
        setAddingChild(true)
        try {
            const res = await categoriesApi.createCategory(childName.trim(), undefined, parentId)
            if (res.success) {
                message.success('子分类创建成功')
                setAddingChildFor(null)
                setChildName('')
                fetchData()
            } else {
                message.error(res.message || '创建失败')
            }
        } catch {
            message.error('操作失败，请稍后重试')
        } finally {
            setAddingChild(false)
        }
    }

    // ======================== Render ========================

    return (
        <div style={{ display: 'flex', gap: 24, minHeight: 'calc(100vh - 200px)' }}>
            {/* ==================== Left Panel: Tree View ==================== */}
            <div style={{ flex: 1, overflow: 'auto', paddingBottom: 40 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, gap: 12, flexWrap: 'wrap' }}>
                    <Title level={4} style={{ margin: 0 }}>
                        分类管理
                    </Title>
                    <Space>
                        <Input.Search
                            placeholder='搜索分类名称...'
                            allowClear
                            value={searchText}
                            onChange={(e) => setSearchText(e.target.value)}
                            onSearch={setSearchText}
                            style={{ width: 220 }}
                            prefix={<SearchOutlined />}
                        />
                        <Button icon={<ReloadOutlined />} onClick={fetchData} loading={loading}>
                            刷新
                        </Button>
                    </Space>
                </div>

                <Spin spinning={loading}>
                    {level1Categories.length === 0 && !loading ? (
                        <Empty description={searchText ? '未找到匹配的分类' : '暂无分类，请在右侧创建'} style={{ marginTop: 80 }} />
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                            {level1Categories.map((cat) => (
                                <Card
                                    key={cat.id}
                                    size='small'
                                    title={
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                                            <FolderOutlined style={{ color: '#1677ff', fontSize: 18 }} />
                                            <span style={{ fontSize: 16, fontWeight: 700 }}>{cat.name}</span>
                                            <Tag color='processing'>{cat.repoCount ?? 0} 个仓库</Tag>
                                            {cat.children && cat.children.length > 0 && <Tag>{cat.children.length} 个子分类</Tag>}
                                        </div>
                                    }
                                    extra={
                                        <Space size={4}>
                                            <Button size='small' icon={<EditOutlined />} onClick={() => openEditModal(cat)}>
                                                编辑
                                            </Button>
                                            <Popconfirm
                                                title='确认删除'
                                                description={
                                                    cat.children && cat.children.length > 0
                                                        ? `将同时删除「${cat.name}」及其 ${cat.children.length} 个子分类`
                                                        : `确定删除「${cat.name}」？`
                                                }
                                                onConfirm={() => handleDelete(cat)}
                                                okText='删除'
                                                okType='danger'
                                                cancelText='取消'
                                            >
                                                <Button size='small' danger icon={<DeleteOutlined />}>
                                                    删除
                                                </Button>
                                            </Popconfirm>
                                        </Space>
                                    }
                                    styles={{ body: { padding: '12px 16px 16px' } }}
                                >
                                    {cat.description && (
                                        <Paragraph
                                            type='secondary'
                                            style={{ marginBottom: cat.children && cat.children.length > 0 ? 12 : 0, fontSize: 13 }}
                                        >
                                            {cat.description}
                                        </Paragraph>
                                    )}

                                    {/* Level 2 children list */}
                                    {cat.children && cat.children.length > 0 ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                            {cat.children.map((child) => (
                                                <div
                                                    key={child.id}
                                                    style={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'space-between',
                                                        padding: '10px 14px',
                                                        background: '#fafafa',
                                                        borderRadius: 8,
                                                        border: '1px solid #f0f0f0',
                                                    }}
                                                >
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                                                        <FolderOutlined style={{ color: '#52c41a', fontSize: 14, flexShrink: 0 }} />
                                                        <a
                                                            onClick={() => navigate(`/categories/${child.id}`)}
                                                            style={{
                                                                fontWeight: 500,
                                                                fontSize: 14,
                                                                overflow: 'hidden',
                                                                textOverflow: 'ellipsis',
                                                                whiteSpace: 'nowrap',
                                                            }}
                                                        >
                                                            {child.name}
                                                        </a>
                                                        <Tag style={{ margin: 0, flexShrink: 0 }}>{child.repoCount ?? 0} 个仓库</Tag>
                                                    </div>
                                                    <Space size={6} style={{ flexShrink: 0 }}>
                                                        <Select
                                                            size='small'
                                                            placeholder='移动到...'
                                                            style={{ width: 150 }}
                                                            value={undefined}
                                                            onChange={(val) => val !== undefined && val !== null && handleMove(child.id, val)}
                                                            options={level1Options.filter((o) => o.value !== cat.id)}
                                                        />
                                                        <Popconfirm
                                                            title='确认移出'
                                                            description={`将「${child.name}」从「${cat.name}」中移出？`}
                                                            onConfirm={() => handleMove(child.id, null)}
                                                            okText='移出'
                                                            cancelText='取消'
                                                        >
                                                            <Button size='small' type='link' danger>
                                                                移出
                                                            </Button>
                                                        </Popconfirm>
                                                    </Space>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <Text type='secondary' style={{ fontSize: 13 }}>
                                            暂无子分类
                                        </Text>
                                    )}

                                    {/* Add child inline form */}
                                    <div style={{ marginTop: 14 }}>
                                        {addingChildFor === cat.id ? (
                                            <Space>
                                                <Input
                                                    size='small'
                                                    placeholder='子分类名称'
                                                    value={childName}
                                                    onChange={(e) => setChildName(e.target.value)}
                                                    style={{ width: 200 }}
                                                    onPressEnter={() => handleAddChild(cat.id)}
                                                    autoFocus
                                                    maxLength={50}
                                                />
                                                <Button
                                                    size='small'
                                                    type='primary'
                                                    loading={addingChild}
                                                    onClick={() => handleAddChild(cat.id)}
                                                >
                                                    确认
                                                </Button>
                                                <Button
                                                    size='small'
                                                    onClick={() => {
                                                        setAddingChildFor(null)
                                                        setChildName('')
                                                    }}
                                                >
                                                    取消
                                                </Button>
                                            </Space>
                                        ) : (
                                            <Button
                                                size='small'
                                                type='dashed'
                                                icon={<FolderAddOutlined />}
                                                onClick={() => {
                                                    setAddingChildFor(cat.id)
                                                    setChildName('')
                                                }}
                                            >
                                                添加子分类
                                            </Button>
                                        )}
                                    </div>
                                </Card>
                            ))}

                            {/* Unassigned Level 2 section */}
                            {unassignedLevel2.length > 0 && (
                                <>
                                    <Divider style={{ margin: '4px 0' }} />
                                    <Card
                                        size='small'
                                        title={
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                <FolderOutlined style={{ color: '#1677ff', fontSize: 18 }} />
                                                <span style={{ fontWeight: 600, fontSize: 15 }}>待归类的子分类</span>
                                                <Tag color='blue'>{unassignedLevel2.length} 个</Tag>
                                            </div>
                                        }
                                        style={{ borderStyle: 'dashed', borderColor: '#1677ff' }}
                                        styles={{ body: { padding: '12px 16px' } }}
                                    >
                                        <Text type='secondary' style={{ display: 'block', marginBottom: 12, fontSize: 12 }}>
                                            以下子分类尚未归属到任何父分类，请使用下拉选择为其指定父分类。
                                        </Text>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                            {unassignedLevel2.map((child) => (
                                                <div
                                                    key={child.id}
                                                    style={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'space-between',
                                                        padding: '10px 14px',
                                                        background: '#f0f5ff',
                                                        borderRadius: 8,
                                                        border: '1px solid #d6e4ff',
                                                    }}
                                                >
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                        <FolderOutlined style={{ color: '#faad14', fontSize: 14 }} />
                                                        <a
                                                            onClick={() => navigate(`/categories/${child.id}`)}
                                                            style={{ fontWeight: 500, fontSize: 14 }}
                                                        >
                                                            {child.name}
                                                        </a>
                                                        <Tag style={{ margin: 0 }}>{child.repoCount ?? 0} 个仓库</Tag>
                                                    </div>
                                                    <Select
                                                        size='small'
                                                        placeholder='移动到一级分类'
                                                        style={{ width: 200 }}
                                                        value={undefined}
                                                        onChange={(val) => val !== undefined && val !== null && handleMove(child.id, val)}
                                                        options={level1Options}
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    </Card>
                                </>
                            )}
                        </div>
                    )}
                </Spin>
            </div>

            {/* ==================== Right Panel: Create Form ==================== */}
            <div style={{ width: 360, flexShrink: 0 }}>
                <Card
                    title={
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <PlusOutlined style={{ color: '#1677ff' }} />
                            <span style={{ fontWeight: 600 }}>新建分类</span>
                        </div>
                    }
                    style={{ position: 'sticky', top: 16 }}
                >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                        {/* Level type selector */}
                        <div>
                            <div style={{ marginBottom: 8, fontWeight: 500, fontSize: 13, color: '#666' }}>分类层级</div>
                            <Radio.Group
                                value={createType}
                                onChange={(e) => setCreateType(e.target.value)}
                                buttonStyle='solid'
                                style={{ width: '100%' }}
                            >
                                <Radio.Button value='level1' style={{ width: '50%', textAlign: 'center' }}>
                                    一级分类
                                </Radio.Button>
                                <Radio.Button value='level2' style={{ width: '50%', textAlign: 'center' }}>
                                    二级分类
                                </Radio.Button>
                            </Radio.Group>
                        </div>

                        {/* Parent selector (Level 2 only) */}
                        {createType === 'level2' && (
                            <div>
                                <div style={{ marginBottom: 4, fontWeight: 500, fontSize: 13, color: '#666' }}>所属父分类</div>
                                {level1Options.length === 0 ? (
                                    <Text type='secondary' style={{ fontSize: 13 }}>
                                        请先创建一级分类
                                    </Text>
                                ) : (
                                    <Select
                                        placeholder='请选择一级分类'
                                        value={formParentId}
                                        onChange={(val) => setFormParentId(val)}
                                        options={level1Options}
                                        style={{ width: '100%' }}
                                        allowClear
                                        showSearch
                                        filterOption={(input, option) =>
                                            (option?.label as string)?.toLowerCase().includes(input.toLowerCase())
                                        }
                                    />
                                )}
                            </div>
                        )}

                        {/* Name input */}
                        <div>
                            <div style={{ marginBottom: 4, fontWeight: 500, fontSize: 13, color: '#666' }}>分类名称</div>
                            <Input
                                placeholder={createType === 'level1' ? '如：AI/机器学习' : '如：深度学习'}
                                value={formName}
                                onChange={(e) => setFormName(e.target.value)}
                                maxLength={50}
                            />
                        </div>

                        {/* Description input */}
                        <div>
                            <div style={{ marginBottom: 4, fontWeight: 500, fontSize: 13, color: '#666' }}>描述（可选）</div>
                            <TextArea
                                placeholder='简要描述此分类的用途'
                                value={formDesc}
                                onChange={(e) => setFormDesc(e.target.value)}
                                rows={3}
                                maxLength={200}
                                showCount
                            />
                        </div>

                        {/* Submit button */}
                        <Button type='primary' block icon={<PlusOutlined />} onClick={handleCreate} loading={saving} size='large'>
                            创建分类
                        </Button>
                    </div>
                </Card>
            </div>

            {/* ==================== Edit Modal ==================== */}
            <Modal
                title='编辑分类'
                open={editModalOpen}
                onOk={handleEditSave}
                onCancel={() => setEditModalOpen(false)}
                confirmLoading={editSaving}
                destroyOnClose
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 8 }}>
                    <div>
                        <div style={{ marginBottom: 4, fontWeight: 500 }}>名称</div>
                        <Input placeholder='分类名称' value={editName} onChange={(e) => setEditName(e.target.value)} maxLength={50} />
                    </div>
                    <div>
                        <div style={{ marginBottom: 4, fontWeight: 500 }}>描述</div>
                        <TextArea
                            placeholder='分类描述（可选）'
                            value={editDesc}
                            onChange={(e) => setEditDesc(e.target.value)}
                            rows={3}
                            maxLength={200}
                        />
                    </div>
                </div>
            </Modal>
        </div>
    )
}
