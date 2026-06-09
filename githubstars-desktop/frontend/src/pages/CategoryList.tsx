import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Table, Modal, Input, Empty, Typography, App } from 'antd'
import { PlusOutlined, DeleteOutlined, EditOutlined, ReloadOutlined } from '@ant-design/icons'
import * as categoriesApi from '../api/categories'
import type { Category } from '../types'
import dayjs from 'dayjs'

const { Title } = Typography
const { TextArea } = Input

function formatDateTime(value: string | null): string {
  if (!value) return '-'
  return dayjs(value).format('YYYY-MM-DD HH:mm:ss')
}

export default function CategoryList() {
  const { message, modal } = App.useApp()
  const navigate = useNavigate()

  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [formName, setFormName] = useState('')
  const [formDesc, setFormDesc] = useState('')
  const [saving, setSaving] = useState(false)

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
  }, [])

  const openCreateModal = () => {
    setEditId(null)
    setFormName('')
    setFormDesc('')
    setModalOpen(true)
  }

  const openEditModal = (record: Category) => {
    setEditId(record.id)
    setFormName(record.name)
    setFormDesc(record.description || '')
    setModalOpen(true)
  }

  const handleModalClose = () => {
    setModalOpen(false)
    setEditId(null)
    setFormName('')
    setFormDesc('')
  }

  const handleSave = async () => {
    if (!formName.trim()) {
      message.warning('请输入分类名称')
      return
    }
    setSaving(true)
    try {
      if (editId !== null) {
        const res = await categoriesApi.updateCategory(editId, formName.trim(), formDesc.trim() || undefined)
        if (res.success) {
          message.success('更新成功')
          handleModalClose()
          fetchData()
        } else {
          message.error(res.message || '更新失败')
        }
      } else {
        const res = await categoriesApi.createCategory(formName.trim(), formDesc.trim() || undefined)
        if (res.success) {
          message.success('创建成功')
          handleModalClose()
          fetchData()
        } else {
          message.error(res.message || '创建失败')
        }
      }
    } catch {
      message.error('操作失败，请稍后重试')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = (id: number, name: string) => {
    modal.confirm({
      title: '确认删除',
      content: `确定要删除分类「${name}」吗？该分类下的仓库将变为未分类状态。`,
      okText: '确认删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          const res = await categoriesApi.deleteCategory(id)
          if (res.success) {
            message.success('删除成功')
            setSelectedRowKeys((prev) => prev.filter((k) => k !== id))
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

  const handleBatchDelete = () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请先选择要删除的分类')
      return
    }
    modal.confirm({
      title: '批量删除',
      content: `确定要删除选中的 ${selectedRowKeys.length} 个分类吗？分类下的仓库将变为未分类状态。`,
      okText: '确认删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          const res = await categoriesApi.batchDeleteCategories(selectedRowKeys as number[])
          if (res.success) {
            message.success('批量删除成功')
            setSelectedRowKeys([])
            fetchData()
          } else {
            message.error(res.message || '批量删除失败')
          }
        } catch {
          message.error('批量删除失败，请稍后重试')
        }
      },
    })
  }

  const columns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 70 },
    {
      title: '分类名称',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: Category) => (
        <a onClick={() => navigate(`/categories/${record.id}`)}>{name}</a>
      ),
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      render: (v: string | null) => v || '-',
    },
    {
      title: '仓库数量',
      dataIndex: 'repoCount',
      key: 'repoCount',
      width: 100,
      align: 'right' as const,
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (v: string) => formatDateTime(v),
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_: unknown, record: Category) => (
        <div style={{ display: 'flex', gap: 8 }}>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => openEditModal(record)}
          >
            编辑
          </Button>
          <Button
            type="link"
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record.id, record.name)}
          >
            删除
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div>
      <Title level={3} style={{ marginBottom: 24 }}>
        分类管理
      </Title>

      <div style={{ marginBottom: 16, display: 'flex', gap: 8 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
          新增分类
        </Button>
        {selectedRowKeys.length > 0 && (
          <Button danger icon={<DeleteOutlined />} onClick={handleBatchDelete}>
            批量删除 ({selectedRowKeys.length})
          </Button>
        )}
        <Button icon={<ReloadOutlined />} onClick={fetchData} loading={loading}>
          刷新
        </Button>
      </div>

      <Table
        rowKey="id"
        columns={columns}
        dataSource={categories}
        loading={loading}
        rowSelection={{
          selectedRowKeys,
          onChange: (keys) => setSelectedRowKeys(keys),
        }}
        pagination={{
          showTotal: (total) => `共 ${total} 条`,
          showSizeChanger: true,
          pageSizeOptions: ['10', '20', '50'],
        }}
        locale={{
          emptyText: <Empty description="暂无分类数据" />,
        }}
        scroll={{ x: 750 }}
      />

      <Modal
        title={editId !== null ? '编辑分类' : '新增分类'}
        open={modalOpen}
        onOk={handleSave}
        onCancel={handleModalClose}
        confirmLoading={saving}
        destroyOnClose
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 8 }}>
          <div>
            <div style={{ marginBottom: 4, fontWeight: 500 }}>名称</div>
            <Input
              placeholder="请输入分类名称"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              maxLength={50}
            />
          </div>
          <div>
            <div style={{ marginBottom: 4, fontWeight: 500 }}>描述</div>
            <TextArea
              placeholder="请输入分类描述（可选）"
              value={formDesc}
              onChange={(e) => setFormDesc(e.target.value)}
              rows={3}
              maxLength={200}
            />
          </div>
        </div>
      </Modal>
    </div>
  )
}
