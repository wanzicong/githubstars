import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Card,
  Input,
  Select,
  Button,
  Row,
  Col,
  Tag,
  Avatar,
  Typography,
  Pagination,
  Empty,
  Space,
  Statistic,
  DatePicker,
  Spin,
  Collapse,
  Modal,
  Progress,
  message,
  Alert,
} from 'antd'
import {
  SearchOutlined,
  StarFilled,
  ForkOutlined,
  ClearOutlined,
  DownloadOutlined,
  GithubOutlined,
  CaretDownOutlined,
  TranslationOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import * as statsApi from '../api/stats'
import * as starsApi from '../api/stars'
import * as translateApi from '../api/translate'
import type { GithubRepo, OverviewStatsDTO, LanguageStatsDTO, PageResult } from '../types'

const { Title, Text, Paragraph } = Typography

function formatDate(dateStr: string | number[] | null): string {
  if (!dateStr) return '-'
  if (Array.isArray(dateStr)) {
    const [y, m, d] = dateStr
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  }
  if (typeof dateStr === 'string') {
    return dateStr.length >= 10 ? dateStr.substring(0, 10) : dateStr
  }
  return String(dateStr)
}

const SORT_BY_OPTIONS = [
  { label: 'Star 时间', value: 'starred_at' },
  { label: 'Star 数量', value: 'stars_count' },
  { label: 'Fork 数量', value: 'forks_count' },
  { label: '最近更新', value: 'repo_updated_at' },
  { label: '创建时间', value: 'repo_created_at' },
  { label: '推送时间', value: 'repo_pushed_at' },
]

const SORT_ORDER_OPTIONS = [
  { label: '降序', value: 'desc' },
  { label: '升序', value: 'asc' },
]

const DATE_FIELD_OPTIONS = [
  { label: 'Star 时间', value: 'starred_at' },
  { label: '创建时间', value: 'repo_created_at' },
  { label: '更新时间', value: 'repo_updated_at' },
  { label: '推送时间', value: 'repo_pushed_at' },
]

const PAGE_SIZE_OPTIONS = [12, 24, 48]

export default function StarList() {
  const [searchParams, setSearchParams] = useSearchParams()

  // 从 URL 参数读取筛选条件（路由切换后自动恢复）
  const keyword = searchParams.get('keyword') || ''
  // 使用字符串作为稳定的依赖项，避免数组引用变化导致 useEffect 无限循环
  const languageStr = searchParams.get('languages') || ''
  const selectedLanguages = languageStr ? languageStr.split(',') : []
  const sortBy = searchParams.get('sortBy') || 'starred_at'
  const sortOrder = searchParams.get('sortOrder') || 'desc'
  const dateField = searchParams.get('dateField') || undefined
  const currentPage = parseInt(searchParams.get('page') || '1', 10)
  const pageSize = parseInt(searchParams.get('size') || '12', 10)
  const startMonthStr = searchParams.get('startMonth')
  const endMonthStr = searchParams.get('endMonth')

  // 月份需要 Dayjs 对象，单独管理
  const [startMonth, setStartMonthState] = useState<dayjs.Dayjs | null>(
    startMonthStr ? dayjs(startMonthStr) : null
  )
  const [endMonth, setEndMonthState] = useState<dayjs.Dayjs | null>(
    endMonthStr ? dayjs(endMonthStr) : null
  )

  // URL 参数变更时同步月份状态
  useEffect(() => {
    setStartMonthState(startMonthStr ? dayjs(startMonthStr) : null)
  }, [startMonthStr])
  useEffect(() => {
    setEndMonthState(endMonthStr ? dayjs(endMonthStr) : null)
  }, [endMonthStr])

  // 更新 URL 参数的工具函数（清空筛选时重置到第一页）
  const setUrlParam = useCallback((key: string, value: string | null | undefined, resetPage = true) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      if (value === undefined || value === null || value === '') {
        next.delete(key)
      } else {
        next.set(key, value)
      }
      // 非翻页操作时重置到第一页
      if (resetPage && key !== 'page') {
        next.delete('page')
      }
      return next
    })
  }, [setSearchParams])

  const setUrlParams = useCallback((updates: Record<string, string | null | undefined>) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      let shouldReset = false
      for (const [key, value] of Object.entries(updates)) {
        if (value === undefined || value === null || value === '') {
          next.delete(key)
        } else {
          next.set(key, value)
        }
        if (key !== 'page') shouldReset = true
      }
      if (shouldReset) next.delete('page')
      return next
    })
  }, [setSearchParams])

  // 服务端分页数据
  const [pageResult, setPageResult] = useState<PageResult<GithubRepo>>({
    records: [],
    total: 0,
    size: 12,
    current: 1,
    pages: 0,
  })
  const [overview, setOverview] = useState<OverviewStatsDTO | null>(null)
  const [languageOptions, setLanguageOptions] = useState<LanguageStatsDTO[]>([])
  const [loading, setLoading] = useState(true)
  const [initialLoading, setInitialLoading] = useState(true)

  // 首次加载：获取概览统计 + 语言列表
  useEffect(() => {
    const loadMeta = async () => {
      try {
        const [overviewRes, langRes] = await Promise.allSettled([
          statsApi.fetchOverviewStats(),
          statsApi.fetchLanguageStats(),
        ])
        if (overviewRes.status === 'fulfilled') {
          setOverview(overviewRes.value)
        }
        if (langRes.status === 'fulfilled') {
          setLanguageOptions(langRes.value)
        }
      } catch {
        // errors already logged by interceptor
      } finally {
        setInitialLoading(false)
      }
    }
    loadMeta()
  }, [])

  // 服务端分页查询：筛选/排序/分页参数变化时重新请求
  useEffect(() => {
    const loadPage = async () => {
      setLoading(true)
      try {
        const result = await starsApi.fetchStarList({
          page: currentPage,
          size: pageSize,
          keyword: keyword || undefined,
          language: languageStr || undefined,
          sortBy: sortBy || undefined,
          sortOrder: sortOrder || undefined,
          dateField: dateField || undefined,
          startMonth: startMonth ? startMonth.format('YYYY-MM') : undefined,
          endMonth: endMonth ? endMonth.format('YYYY-MM') : undefined,
        })
        setPageResult(result)
      } catch {
        // errors already logged by interceptor
      } finally {
        setLoading(false)
      }
    }
    loadPage()
  }, [currentPage, pageSize, keyword, languageStr, sortBy, sortOrder, dateField, startMonth, endMonth])

  const handleClearFilters = useCallback(() => {
    setUrlParams({
      keyword: null,
      languages: null,
      sortBy: 'starred_at',
      sortOrder: 'desc',
      dateField: null,
      startMonth: null,
      endMonth: null,
    })
    setStartMonthState(null)
    setEndMonthState(null)
  }, [setUrlParams])

  const [batchTranslating, setBatchTranslating] = useState(false)

  // 全量翻译进度弹窗
  const [translateModalVisible, setTranslateModalVisible] = useState(false)
  const [translateTaskId, setTranslateTaskId] = useState<number | null>(null)
  const [translateProgress, setTranslateProgress] = useState<{
    status: string
    totalItems: number
    completedItems: number
    failedItems: number
    descTotal: number
    descCompleted: number
    descFailed: number
    readmeTotal: number
    readmeCompleted: number
    readmeFailed: number
    progress: number
  } | null>(null)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current)
      pollingRef.current = null
    }
  }, [])

  const startPolling = useCallback((taskId: number) => {
    stopPolling()
    pollingRef.current = setInterval(async () => {
      try {
        const res = await translateApi.getTaskProgress(taskId)
        if (res.success) {
          setTranslateProgress({
            status: res.status,
            totalItems: res.totalItems,
            completedItems: res.completedItems,
            failedItems: res.failedItems,
            descTotal: res.descTotal,
            descCompleted: res.descCompleted,
            descFailed: res.descFailed,
            readmeTotal: res.readmeTotal,
            readmeCompleted: res.readmeCompleted,
            readmeFailed: res.readmeFailed,
            progress: res.progress,
          })
          // 完成时停止轮询
          if (res.status === 'COMPLETED' || res.status === 'FAILED') {
            stopPolling()
            // 刷新当前页数据以显示翻译结果
            const result = await starsApi.fetchStarList({
              page: currentPage,
              size: pageSize,
              keyword: keyword || undefined,
              language: languageStr || undefined,
              sortBy: sortBy || undefined,
              sortOrder: sortOrder || undefined,
              dateField: dateField || undefined,
              startMonth: startMonth ? startMonth.format('YYYY-MM') : undefined,
              endMonth: endMonth ? endMonth.format('YYYY-MM') : undefined,
            })
            setPageResult(result)
          }
        }
      } catch {
        // ignore polling errors
      }
    }, 2000)
  }, [currentPage, pageSize, keyword, languageStr, sortBy, sortOrder, dateField, startMonth, endMonth])

  const handleStartFullTranslate = useCallback(async () => {
    setBatchTranslating(true)
    try {
      const result = await translateApi.startFullTranslate()
      if (result.success && result.taskId) {
        setTranslateTaskId(result.taskId)
        setTranslateProgress({
          status: 'PENDING',
          totalItems: 0,
          completedItems: 0,
          failedItems: 0,
          descTotal: 0,
          descCompleted: 0,
          descFailed: 0,
          readmeTotal: 0,
          readmeCompleted: 0,
          readmeFailed: 0,
          progress: 0,
        })
        setTranslateModalVisible(true)
        startPolling(result.taskId)
      } else {
        message.info(result.message || '没有需要翻译的项目')
      }
    } catch {
      message.error('启动翻译失败')
    } finally {
      setBatchTranslating(false)
    }
  }, [startPolling])

  const handleRetryFailed = useCallback(async () => {
    if (!translateTaskId) return
    try {
      const result = await translateApi.retryFailed(translateTaskId)
      if (result.success && result.taskId) {
        setTranslateTaskId(result.taskId)
        setTranslateProgress({
          status: 'PENDING',
          totalItems: 0,
          completedItems: 0,
          failedItems: 0,
          descTotal: 0,
          descCompleted: 0,
          descFailed: 0,
          readmeTotal: 0,
          readmeCompleted: 0,
          readmeFailed: 0,
          progress: 0,
        })
        startPolling(result.taskId)
      } else {
        message.info(result.message || '没有失败项')
      }
    } catch {
      message.error('重试失败')
    }
  }, [translateTaskId, startPolling])

  const handleCloseTranslateModal = useCallback(() => {
    stopPolling()
    setTranslateModalVisible(false)
    setTranslateTaskId(null)
    setTranslateProgress(null)
  }, [stopPolling])

  // 翻译进度弹窗渲染
  const renderTranslateProgress = () => {
    if (!translateProgress) return null
    const { status, totalItems, completedItems, failedItems, progress,
            descTotal, descCompleted, descFailed, readmeTotal, readmeCompleted, readmeFailed } = translateProgress
    const isRunning = status === 'PENDING' || status === 'PROCESSING'
    const isDone = status === 'COMPLETED' || status === 'FAILED'

    return (
      <Modal
        title="翻译进度"
        open={translateModalVisible}
        onCancel={isRunning ? undefined : handleCloseTranslateModal}
        footer={
          isDone ? (
            <Space>
              {failedItems > 0 && (
                <Button
                  icon={<ReloadOutlined />}
                  onClick={handleRetryFailed}
                >
                  重试失败 ({failedItems}项)
                </Button>
              )}
              <Button type="primary" onClick={handleCloseTranslateModal}>
                关闭
              </Button>
            </Space>
          ) : null
        }
        maskClosable={!isRunning}
        closable={!isRunning}
      >
        <div style={{ textAlign: 'center', padding: '16px 0' }}>
          <Spin spinning={isRunning} size="large">
            <div style={{ padding: 8 }}>
              {isDone && (
                <div style={{ fontSize: 48, marginBottom: 8 }}>
                  {failedItems > 0 ? (
                    <CloseCircleOutlined style={{ color: '#ff4d4f' }} />
                  ) : (
                    <CheckCircleOutlined style={{ color: '#52c41a' }} />
                  )}
                </div>
              )}
              <Progress
                type="circle"
                percent={progress}
                status={isRunning ? 'active' : failedItems > 0 ? 'exception' : 'success'}
                size={120}
              />
              <div style={{ marginTop: 16, fontSize: 14, color: '#666' }}>
                {isRunning ? '翻译执行中...' : status === 'COMPLETED' ? '翻译完成' : '翻译完成（部分失败）'}
              </div>
              <div style={{ marginTop: 12, fontSize: 13, color: '#999' }}>
                总 {totalItems} 项 | 成功 {completedItems} | 失败 {failedItems}
              </div>
            </div>
          </Spin>
        </div>

        <div style={{ padding: '8px 0' }}>
          <Alert
            type="info"
            showIcon
            message={
              <div style={{ fontSize: 13 }}>
                <div>描述翻译：{descCompleted}/{descTotal} 完成{failedItems > 0 ? `，${descFailed} 失败` : ''}</div>
                <div>README 翻译：{readmeCompleted}/{readmeTotal} 完成{failedItems > 0 ? `，${readmeFailed} 失败` : ''}</div>
              </div>
            }
          />
        </div>
      </Modal>
    )
  }

  const handleBatchTranslate = useCallback(async () => {
    setBatchTranslating(true)
    try {
      const result = await translateApi.translateBatch()
      if (result.translatedCount && result.translatedCount > 0) {
        // 刷新当前页数据以显示翻译结果
        const res = await starsApi.fetchStarList({
          page: currentPage,
          size: pageSize,
          keyword: keyword || undefined,
          language: languageStr || undefined,
          sortBy: sortBy || undefined,
          sortOrder: sortOrder || undefined,
          dateField: dateField || undefined,
          startMonth: startMonth ? startMonth.format('YYYY-MM') : undefined,
          endMonth: endMonth ? endMonth.format('YYYY-MM') : undefined,
        })
        setPageResult(res)
      }
    } catch {
      // errors already logged by interceptor
    } finally {
      setBatchTranslating(false)
    }
  }, [currentPage, pageSize, keyword, languageStr, sortBy, sortOrder, dateField, startMonth, endMonth])

  const handleExport = useCallback(async () => {
    try {
      const blob = await starsApi.exportStarsUrls({
        keyword: keyword || undefined,
        language: languageStr || undefined,
        sortBy: sortBy || undefined,
        sortOrder: sortOrder || undefined,
        dateField: dateField || undefined,
        startMonth: startMonth ? startMonth.format('YYYY-MM') : undefined,
        endMonth: endMonth ? endMonth.format('YYYY-MM') : undefined,
      })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `stars_export_${dayjs().format('YYYYMMDD_HHmmss')}.txt`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
    } catch {
      console.error('导出失败')
    }
  }, [keyword, languageStr, sortBy, sortOrder, dateField, startMonth, endMonth])

  const languageSelectOptions = useMemo(
    () =>
      languageOptions.map((lang) => ({
        label: `${lang.language} (${lang.count})`,
        value: lang.language,
      })),
    [languageOptions],
  )

  const hasActiveFilters =
    keyword.trim() !== '' ||
    languageStr !== '' ||
    sortBy !== 'starred_at' ||
    sortOrder !== 'desc' ||
    dateField !== undefined ||
    startMonth !== null ||
    endMonth !== null

  const { records: repos } = pageResult

  return (
    <div>
      <Title level={3} style={{ marginBottom: 24 }}>
        Star 仓库列表
      </Title>

      <Spin spinning={initialLoading}>
        <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
          <Col xs={12} sm={6}>
            <Card size="small">
              <Statistic
                title="总仓库数"
                value={overview?.totalRepos ?? 0}
                prefix={<GithubOutlined style={{ color: '#1677ff' }} />}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card size="small">
              <Statistic
                title="总 Star 数"
                value={overview?.totalStars ?? 0}
                prefix={<StarFilled style={{ color: '#faad14' }} />}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card size="small">
              <Statistic
                title="总 Fork 数"
                value={overview?.totalForks ?? 0}
                prefix={<ForkOutlined style={{ color: '#52c41a' }} />}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card size="small">
              <Statistic
                title="语言种类"
                value={overview?.totalLanguages ?? 0}
                prefix={<Tag color="purple" style={{ marginRight: 0 }}>#</Tag>}
              />
            </Card>
          </Col>
        </Row>
      </Spin>

      <Card style={{ marginBottom: 20, overflow: 'hidden' }}>
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Row gutter={[8, 12]} align="middle" style={{ flexWrap: 'wrap' }}>
            <Col xs={24} sm={12} md={8} lg={6}>
              <Input.Search
                placeholder="搜索仓库名、描述、作者..."
                defaultValue={keyword}
                onSearch={(val) => {
                  setUrlParam('keyword', val || null)
                }}
                onChange={(e) => {
                  if (!e.target.value) {
                    setUrlParam('keyword', null)
                  }
                }}
                allowClear
              />
            </Col>
            <Col xs={24} sm={12} md={10} lg={7}>
              <Select
                mode="multiple"
                placeholder="筛选语言"
                value={selectedLanguages}
                onChange={(vals) => {
                  setUrlParam('languages', vals.length > 0 ? vals.join(',') : null)
                  // setUrlParam handles page reset
                }}
                options={languageSelectOptions}
                allowClear
                showSearch
                maxTagCount={3}
                filterOption={(input, option) =>
                  (option?.label as string)?.toLowerCase().includes(input.toLowerCase())
                }
                style={{ width: '100%' }}
              />
            </Col>
            <Col xs={12} sm={8} md={6} lg={4}>
              <Select
                placeholder="排序字段"
                value={sortBy}
                onChange={(val) => {
                  setUrlParam('sortBy', val || null)
                  // setUrlParam handles page reset
                }}
                options={SORT_BY_OPTIONS}
                style={{ width: '100%' }}
              />
            </Col>
            <Col xs={12} sm={8} md={6} lg={3}>
              <Select
                placeholder="排序方向"
                value={sortOrder}
                onChange={(val) => {
                  setUrlParam('sortOrder', val || null)
                  // setUrlParam handles page reset
                }}
                options={SORT_ORDER_OPTIONS}
                style={{ width: '100%' }}
              />
            </Col>
            <Col xs={24} sm={24} md={24} lg={4}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {hasActiveFilters && (
                  <Button icon={<ClearOutlined />} onClick={handleClearFilters}>
                    清除
                  </Button>
                )}
                <Button
                  icon={<TranslationOutlined />}
                  loading={batchTranslating}
                  onClick={handleStartFullTranslate}
                  style={{ flex: '1 1 auto', minWidth: 0 }}
                >
                  批量翻译
                </Button>
                <Button
                  type="primary"
                  icon={<DownloadOutlined />}
                  onClick={handleExport}
                  style={{ flex: '1 1 auto', minWidth: 0 }}
                >
                  导出链接
                </Button>
              </div>
            </Col>
          </Row>

          <Collapse
            ghost
            size="small"
            items={[
              {
                key: 'date-filter',
                label: (
                  <span style={{ fontSize: 13, color: '#666' }}>
                    <CaretDownOutlined style={{ marginRight: 4 }} />
                    时间筛选
                  </span>
                ),
                children: (
                  <Row gutter={[16, 12]} align="middle">
                    <Col xs={24} sm={8} md={6} lg={4}>
                      <Select
                        placeholder="时间字段"
                        value={dateField}
                        onChange={(val) => {
                          setUrlParam('dateField', val || null)
                          // setUrlParam handles page reset
                        }}
                        allowClear
                        options={DATE_FIELD_OPTIONS}
                        style={{ width: '100%' }}
                      />
                    </Col>
                    <Col xs={12} sm={8} md={6} lg={4}>
                      <DatePicker
                        picker="month"
                        placeholder="起始月份"
                        value={startMonth}
                        onChange={(val) => {
                          setStartMonthState(val)
                          setUrlParam('startMonth', val ? val.format('YYYY-MM') : null)
                        }}
                        disabled={!dateField}
                        style={{ width: '100%' }}
                      />
                    </Col>
                    <Col xs={12} sm={8} md={6} lg={4}>
                      <DatePicker
                        picker="month"
                        placeholder="结束月份"
                        value={endMonth}
                        onChange={(val) => {
                          setEndMonthState(val)
                          setUrlParam('endMonth', val ? val.format('YYYY-MM') : null)
                        }}
                        disabled={!dateField}
                        style={{ width: '100%' }}
                      />
                    </Col>
                  </Row>
                ),
              },
            ]}
          />
        </Space>
      </Card>

      <Spin spinning={loading}>
        {repos.length > 0 ? (
          <Row gutter={[16, 16]}>
            {repos.map((repo) => (
              <Col key={repo.id} xs={24} sm={12} md={8} lg={6}>
                <Card
                  hoverable
                  style={{ height: '100%', cursor: 'pointer' }}
                  styles={{ body: { padding: 16 } }}
                  onClick={() => {
                    window.location.href = `/stars/${repo.id}`
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
                    <Avatar
                      src={repo.ownerAvatarUrl}
                      alt={repo.ownerName}
                      size={40}
                      style={{ flexShrink: 0 }}
                    />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <Text
                        strong
                        style={{ fontSize: 14, display: 'block', lineHeight: '20px' }}
                        ellipsis
                      >
                        <a
                          style={{ color: '#1677ff' }}
                          onClick={(e) => {
                            e.stopPropagation()
                            window.location.href = `/stars/${repo.id}`
                          }}
                        >
                          {repo.repoName}
                        </a>
                      </Text>
                      <Text type="secondary" style={{ fontSize: 12 }} ellipsis>
                        {repo.ownerName}
                      </Text>
                    </div>
                  </div>
                  {repo.descriptionCn ? (
                    <Paragraph
                      ellipsis={{ rows: 2 }}
                      style={{ marginBottom: 10, fontSize: 12, minHeight: 36, color: '#333' }}
                    >
                      {repo.descriptionCn}
                      <Text type="secondary" style={{ fontSize: 10, marginLeft: 4 }}>🇨🇳</Text>
                    </Paragraph>
                  ) : repo.description ? (
                    <Paragraph
                      type="secondary"
                      ellipsis={{ rows: 2 }}
                      style={{ marginBottom: 10, fontSize: 12, minHeight: 36 }}
                    >
                      {repo.description}
                    </Paragraph>
                  ) : null}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    {repo.language && (
                      <Tag color="blue" style={{ margin: 0 }}>
                        {repo.language}
                      </Tag>
                    )}
                    <Space size={4}>
                      <StarFilled style={{ color: '#faad14', fontSize: 12 }} />
                      <Text style={{ fontSize: 12 }}>{repo.starsCount}</Text>
                    </Space>
                    <Space size={4}>
                      <ForkOutlined style={{ fontSize: 12 }} />
                      <Text style={{ fontSize: 12 }}>{repo.forksCount}</Text>
                    </Space>
                  </div>
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    Star 于 {formatDate(repo.starredAt)}
                  </Text>
                </Card>
              </Col>
            ))}
          </Row>
        ) : (
          <Card>
            <Empty
              description={
                loading
                  ? '加载中...'
                  : pageResult.total === 0
                    ? '暂无仓库数据，请先同步'
                    : '筛选无结果，请尝试调整筛选条件'
              }
            >
              {hasActiveFilters && (
                <Button type="primary" onClick={handleClearFilters}>
                  清除所有筛选
                </Button>
              )}
            </Empty>
          </Card>
        )}

        {pageResult.total > pageSize && (
          <div style={{ marginTop: 20, display: 'flex', justifyContent: 'center' }}>
            <Pagination
              current={currentPage}
              pageSize={pageSize}
              total={pageResult.total}
              showSizeChanger
              pageSizeOptions={PAGE_SIZE_OPTIONS.map(String)}
              showQuickJumper
              showTotal={(total) => `共 ${total} 条 / ${pageResult.pages} 页`}
              onChange={(page, size) => {
                setUrlParam("page", String(page), false)
                if (size !== parseInt(searchParams.get("size") || "12", 10)) {
                  setUrlParam("size", String(size), false)
                }
              }}
            />
          </div>
        )}
      </Spin>
      {renderTranslateProgress()}
    </div>
  )
}
