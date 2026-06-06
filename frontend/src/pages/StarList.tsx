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
  Segmented,
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
  AppstoreOutlined,
  UnorderedListOutlined,
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

function RepoCard({ repo }: { repo: GithubRepo }) {
  return (
    <Card
      hoverable
      style={{ height: '100%', cursor: 'pointer' }}
      styles={{ body: { padding: 16 } }}
      onClick={() => { window.location.href = `/stars/${repo.id}` }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
        <Avatar src={repo.ownerAvatarUrl} alt={repo.ownerName} size={40} style={{ flexShrink: 0 }} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <Text strong style={{ fontSize: 14, display: 'block', lineHeight: '20px' }} ellipsis>
            <a style={{ color: '#1677ff' }} onClick={(e) => { e.stopPropagation(); window.location.href = `/stars/${repo.id}` }}>{repo.repoName}</a>
          </Text>
          <Text type="secondary" style={{ fontSize: 12 }} ellipsis>{repo.ownerName}</Text>
        </div>
      </div>
      {repo.descriptionCn ? (
        <Paragraph ellipsis={{ rows: 2 }} style={{ marginBottom: 10, fontSize: 12, minHeight: 36, color: '#333' }}>
          {repo.descriptionCn}<Text type="secondary" style={{ fontSize: 10, marginLeft: 4 }}>🇨🇳</Text>
        </Paragraph>
      ) : repo.description ? (
        <Paragraph type="secondary" ellipsis={{ rows: 2 }} style={{ marginBottom: 10, fontSize: 12, minHeight: 36 }}>
          {repo.description}
        </Paragraph>
      ) : null}
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
        {repo.language && <Tag color="blue" style={{ margin: 0 }}>{repo.language}</Tag>}
        {repo.categoryNames && repo.categoryNames.length > 0 && repo.categoryNames.map((cat) => (
          <Tag key={cat} color="green" style={{ margin: 0, fontSize: 11 }}>{cat}</Tag>
        ))}
        <Space size={4}>
          <StarFilled style={{ color: '#faad14', fontSize: 12 }} />
          <Text style={{ fontSize: 12 }}>{repo.starsCount}</Text>
        </Space>
        <Space size={4}>
          <ForkOutlined style={{ fontSize: 12 }} />
          <Text style={{ fontSize: 12 }}>{repo.forksCount}</Text>
        </Space>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 4 }}>
        <Text type="secondary" style={{ fontSize: 11 }}>Star 于 {formatDate(repo.starredAt)}</Text>
        {repo.repoPushedAt && (() => {
          const days = dayjs().diff(dayjs(repo.repoPushedAt), 'day')
          let color = 'green'; if (days > 180) color = 'red'; else if (days > 30) color = 'orange'
          return <Tag color={color} style={{ margin: 0, fontSize: 10 }}>未更新 {days} 天</Tag>
        })()}
      </div>
    </Card>
  )
}

function RepoRow({ repo }: { repo: GithubRepo }) {
  return (
    <Card
      hoverable
      style={{ cursor: 'pointer' }}
      styles={{ body: { padding: 12 } }}
      onClick={() => { window.location.href = `/stars/${repo.id}` }}
    >
      <Row align="middle" gutter={[12, 8]}>
        <Col xs={24} sm={12} md={14}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Avatar src={repo.ownerAvatarUrl} alt={repo.ownerName} size={36} style={{ flexShrink: 0 }} />
            <div style={{ minWidth: 0 }}>
              <Text strong style={{ fontSize: 14 }} ellipsis>
                <a style={{ color: '#1677ff' }} onClick={(e) => { e.stopPropagation(); window.location.href = `/stars/${repo.id}` }}>{repo.repoName}</a>
              </Text>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                <Text type="secondary" style={{ fontSize: 11 }}>{repo.ownerName}</Text>
                {repo.language && <Tag color="blue" style={{ margin: 0, fontSize: 10 }}>{repo.language}</Tag>}
                {repo.categoryNames && repo.categoryNames.length > 0 && repo.categoryNames.slice(0, 2).map((cat) => (
                  <Tag key={cat} color="green" style={{ margin: 0, fontSize: 10 }}>{cat}</Tag>
                ))}
              </div>
              {repo.descriptionCn ? (
                <Paragraph ellipsis={{ rows: 1 }} style={{ margin: '4px 0 0', fontSize: 12, color: '#333' }}>{repo.descriptionCn}</Paragraph>
              ) : repo.description ? (
                <Paragraph type="secondary" ellipsis={{ rows: 1 }} style={{ margin: '4px 0 0', fontSize: 12 }}>{repo.description}</Paragraph>
              ) : null}
            </div>
          </div>
        </Col>
        <Col xs={24} sm={12} md={10}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
            <span><StarFilled style={{ color: '#faad14', fontSize: 12 }} /> <Text style={{ fontSize: 13 }}>{repo.starsCount}</Text></span>
            <span><ForkOutlined style={{ fontSize: 12 }} /> <Text style={{ fontSize: 13 }}>{repo.forksCount}</Text></span>
            {repo.repoPushedAt && (() => {
              const days = dayjs().diff(dayjs(repo.repoPushedAt), 'day')
              let color = 'green'; if (days > 180) color = 'red'; else if (days > 30) color = 'orange'
              return <Tag color={color} style={{ margin: 0, fontSize: 10 }}>未更新 {days} 天</Tag>
            })()}
            <Text type="secondary" style={{ fontSize: 11 }}>Star 于 {formatDate(repo.starredAt)}</Text>
          </div>
        </Col>
      </Row>
    </Card>
  )
}

export default function StarList() {
  const [searchParams, setSearchParams] = useSearchParams()

  const keyword = searchParams.get('keyword') || ''
  const languageStr = searchParams.get('languages') || ''
  const selectedLanguages = languageStr ? languageStr.split(',') : []
  const sortBy = searchParams.get('sortBy') || 'starred_at'
  const sortOrder = searchParams.get('sortOrder') || 'desc'
  const dateField = searchParams.get('dateField') || undefined
  const currentPage = parseInt(searchParams.get('page') || '1', 10)
  const pageSize = parseInt(searchParams.get('size') || '12', 10)
  const startMonthStr = searchParams.get('startMonth')
  const endMonthStr = searchParams.get('endMonth')
  const viewMode = (searchParams.get('view') || 'grid') as 'grid' | 'list'

  const [startMonth, setStartMonthState] = useState<dayjs.Dayjs | null>(startMonthStr ? dayjs(startMonthStr) : null)
  const [endMonth, setEndMonthState] = useState<dayjs.Dayjs | null>(endMonthStr ? dayjs(endMonthStr) : null)

  useEffect(() => { setStartMonthState(startMonthStr ? dayjs(startMonthStr) : null) }, [startMonthStr])
  useEffect(() => { setEndMonthState(endMonthStr ? dayjs(endMonthStr) : null) }, [endMonthStr])

  const setUrlParam = useCallback((key: string, value: string | null | undefined, resetPage = true) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      if (value === undefined || value === null || value === '') next.delete(key)
      else next.set(key, value)
      if (resetPage && key !== 'page') next.delete('page')
      return next
    })
  }, [setSearchParams])

  const setUrlParams = useCallback((updates: Record<string, string | null | undefined>) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      let shouldReset = false
      for (const [key, value] of Object.entries(updates)) {
        if (value === undefined || value === null || value === '') next.delete(key)
        else next.set(key, value)
        if (key !== 'page') shouldReset = true
      }
      if (shouldReset) next.delete('page')
      return next
    })
  }, [setSearchParams])

  const [pageResult, setPageResult] = useState<PageResult<GithubRepo>>({ records: [], total: 0, size: 12, current: 1, pages: 0 })
  const [overview, setOverview] = useState<OverviewStatsDTO | null>(null)
  const [languageOptions, setLanguageOptions] = useState<LanguageStatsDTO[]>([])
  const [loading, setLoading] = useState(true)
  const [initialLoading, setInitialLoading] = useState(true)

  useEffect(() => {
    const loadMeta = async () => {
      try {
        const [overviewRes, langRes] = await Promise.allSettled([statsApi.fetchOverviewStats(), statsApi.fetchLanguageStats()])
        if (overviewRes.status === 'fulfilled') setOverview(overviewRes.value)
        if (langRes.status === 'fulfilled') setLanguageOptions(langRes.value)
      } catch { } finally { setInitialLoading(false) }
    }
    loadMeta()
  }, [])

  useEffect(() => {
    const loadPage = async () => {
      setLoading(true)
      try {
        const result = await starsApi.fetchStarList({
          page: currentPage, size: pageSize, keyword: keyword || undefined,
          language: languageStr || undefined, sortBy: sortBy || undefined,
          sortOrder: sortOrder || undefined, dateField: dateField || undefined,
          startMonth: startMonth ? startMonth.format('YYYY-MM') : undefined,
          endMonth: endMonth ? endMonth.format('YYYY-MM') : undefined,
        })
        setPageResult(result)
      } catch { } finally { setLoading(false) }
    }
    loadPage()
  }, [currentPage, pageSize, keyword, languageStr, sortBy, sortOrder, dateField, startMonth, endMonth])

  const handleClearFilters = useCallback(() => {
    setUrlParams({ keyword: null, languages: null, sortBy: 'starred_at', sortOrder: 'desc', dateField: null, startMonth: null, endMonth: null })
    setStartMonthState(null); setEndMonthState(null)
  }, [setUrlParams])

  const [batchTranslating, setBatchTranslating] = useState(false)
  const [translateModalVisible, setTranslateModalVisible] = useState(false)
  const [translateTaskId, setTranslateTaskId] = useState<number | null>(null)
  const [translateProgress, setTranslateProgress] = useState<{ status: string; totalItems: number; completedItems: number; failedItems: number; descTotal: number; descCompleted: number; descFailed: number; readmeTotal: number; readmeCompleted: number; readmeFailed: number; progress: number } | null>(null)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopPolling = useCallback(() => { if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null } }, [])
  const startPolling = useCallback((taskId: number) => {
    stopPolling()
    pollingRef.current = setInterval(async () => {
      try {
        const res = await translateApi.getTaskProgress(taskId)
        if (res.success) {
          setTranslateProgress({ status: res.status, totalItems: res.totalItems, completedItems: res.completedItems, failedItems: res.failedItems, descTotal: res.descTotal, descCompleted: res.descCompleted, descFailed: res.descFailed, readmeTotal: res.readmeTotal, readmeCompleted: res.readmeCompleted, readmeFailed: res.readmeFailed, progress: res.progress })
          if (res.status === 'COMPLETED' || res.status === 'FAILED') {
            stopPolling()
            const result = await starsApi.fetchStarList({ page: currentPage, size: pageSize, keyword: keyword || undefined, language: languageStr || undefined, sortBy: sortBy || undefined, sortOrder: sortOrder || undefined, dateField: dateField || undefined, startMonth: startMonth ? startMonth.format('YYYY-MM') : undefined, endMonth: endMonth ? endMonth.format('YYYY-MM') : undefined })
            setPageResult(result)
          }
        }
      } catch { }
    }, 2000)
  }, [currentPage, pageSize, keyword, languageStr, sortBy, sortOrder, dateField, startMonth, endMonth])

  const handleStartFullTranslate = useCallback(async () => {
    setBatchTranslating(true)
    try {
      const result = await translateApi.startFullTranslate()
      if (result.success && result.taskId) {
        setTranslateTaskId(result.taskId)
        setTranslateProgress({ status: 'PENDING', totalItems: 0, completedItems: 0, failedItems: 0, descTotal: 0, descCompleted: 0, descFailed: 0, readmeTotal: 0, readmeCompleted: 0, readmeFailed: 0, progress: 0 })
        setTranslateModalVisible(true)
        startPolling(result.taskId)
      } else { message.info(result.message || '没有需要翻译的项目') }
    } catch { message.error('启动翻译失败') } finally { setBatchTranslating(false) }
  }, [startPolling])

  const handleRetryFailed = useCallback(async () => {
    if (!translateTaskId) return
    try {
      const result = await translateApi.retryFailed(translateTaskId)
      if (result.success && result.taskId) { setTranslateTaskId(result.taskId); setTranslateProgress({ status: 'PENDING', totalItems: 0, completedItems: 0, failedItems: 0, descTotal: 0, descCompleted: 0, descFailed: 0, readmeTotal: 0, readmeCompleted: 0, readmeFailed: 0, progress: 0 }); startPolling(result.taskId) }
      else { message.info(result.message || '没有失败项') }
    } catch { message.error('重试失败') }
  }, [translateTaskId, startPolling])

  const handleCloseTranslateModal = useCallback(() => { stopPolling(); setTranslateModalVisible(false); setTranslateTaskId(null); setTranslateProgress(null) }, [stopPolling])

  const renderTranslateProgress = () => {
    if (!translateProgress) return null
    const { status, totalItems, completedItems, failedItems, progress, descTotal, descCompleted, descFailed, readmeTotal, readmeCompleted, readmeFailed } = translateProgress
    const isRunning = status === 'PENDING' || status === 'PROCESSING'
    const isDone = status === 'COMPLETED' || status === 'FAILED'
    return (
      <Modal title="翻译进度" open={translateModalVisible} onCancel={isRunning ? undefined : handleCloseTranslateModal}
        footer={isDone ? (<Space>{failedItems > 0 && <Button icon={<ReloadOutlined />} onClick={handleRetryFailed}>重试失败 ({failedItems}项)</Button>}<Button type="primary" onClick={handleCloseTranslateModal}>关闭</Button></Space>) : null}
        maskClosable={!isRunning} closable={!isRunning}>
        <div style={{ textAlign: 'center', padding: '16px 0' }}>
          <Spin spinning={isRunning} size="large">
            <div style={{ padding: 8 }}>
              {isDone && <div style={{ fontSize: 48, marginBottom: 8 }}>{failedItems > 0 ? <CloseCircleOutlined style={{ color: '#ff4d4f' }} /> : <CheckCircleOutlined style={{ color: '#52c41a' }} />}</div>}
              <Progress type="circle" percent={progress} status={isRunning ? 'active' : failedItems > 0 ? 'exception' : 'success'} size={120} />
              <div style={{ marginTop: 16, fontSize: 14, color: '#666' }}>{isRunning ? '翻译执行中...' : status === 'COMPLETED' ? '翻译完成' : '翻译完成（部分失败）'}</div>
              <div style={{ marginTop: 12, fontSize: 13, color: '#999' }}>总 {totalItems} 项 | 成功 {completedItems} | 失败 {failedItems}</div>
            </div>
          </Spin>
        </div>
        <div style={{ padding: '8px 0' }}>
          <Alert type="info" showIcon message={<div style={{ fontSize: 13 }}><div>描述翻译：{descCompleted}/{descTotal} 完成{failedItems > 0 ? `，${descFailed} 失败` : ''}</div><div>README 翻译：{readmeCompleted}/{readmeTotal} 完成{failedItems > 0 ? `，${readmeFailed} 失败` : ''}</div></div>} />
        </div>
      </Modal>
    )
  }

  const handleBatchTranslate = useCallback(async () => {
    setBatchTranslating(true)
    try {
      const result = await translateApi.translateBatch()
      if (result.translatedCount && result.translatedCount > 0) {
        const res = await starsApi.fetchStarList({ page: currentPage, size: pageSize, keyword: keyword || undefined, language: languageStr || undefined, sortBy: sortBy || undefined, sortOrder: sortOrder || undefined, dateField: dateField || undefined, startMonth: startMonth ? startMonth.format('YYYY-MM') : undefined, endMonth: endMonth ? endMonth.format('YYYY-MM') : undefined })
        setPageResult(res)
      }
    } catch { } finally { setBatchTranslating(false) }
  }, [currentPage, pageSize, keyword, languageStr, sortBy, sortOrder, dateField, startMonth, endMonth])

  const handleExport = useCallback(async () => {
    try {
      const blob = await starsApi.exportStarsUrls({ keyword: keyword || undefined, language: languageStr || undefined, sortBy: sortBy || undefined, sortOrder: sortOrder || undefined, dateField: dateField || undefined, startMonth: startMonth ? startMonth.format('YYYY-MM') : undefined, endMonth: endMonth ? endMonth.format('YYYY-MM') : undefined })
      const url = window.URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `stars_export_${dayjs().format('YYYYMMDD_HHmmss')}.txt`; document.body.appendChild(a); a.click(); document.body.removeChild(a); window.URL.revokeObjectURL(url)
    } catch { console.error('导出失败') }
  }, [keyword, languageStr, sortBy, sortOrder, dateField, startMonth, endMonth])

  const languageSelectOptions = useMemo(() => languageOptions.map((lang) => ({ label: `${lang.language} (${lang.count})`, value: lang.language })), [languageOptions])

  const hasActiveFilters = keyword.trim() !== '' || languageStr !== '' || sortBy !== 'starred_at' || sortOrder !== 'desc' || dateField !== undefined || startMonth !== null || endMonth !== null

  const { records: repos } = pageResult

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 8 }}>
        <Title level={3} style={{ margin: 0 }}>Star 仓库列表</Title>
        <Segmented
          value={viewMode}
          onChange={(val) => setUrlParam('view', val === 'grid' ? null : val as string, false)}
          options={[{ value: 'grid', icon: <AppstoreOutlined /> }, { value: 'list', icon: <UnorderedListOutlined /> }]}
        />
      </div>

      <Spin spinning={initialLoading}>
        <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
          <Col xs={12} sm={6}><Card size="small"><Statistic title="总仓库数" value={overview?.totalRepos ?? 0} prefix={<GithubOutlined style={{ color: '#1677ff' }} />} /></Card></Col>
          <Col xs={12} sm={6}><Card size="small"><Statistic title="总 Star 数" value={overview?.totalStars ?? 0} prefix={<StarFilled style={{ color: '#faad14' }} />} /></Card></Col>
          <Col xs={12} sm={6}><Card size="small"><Statistic title="总 Fork 数" value={overview?.totalForks ?? 0} prefix={<ForkOutlined style={{ color: '#52c41a' }} />} /></Card></Col>
          <Col xs={12} sm={6}><Card size="small"><Statistic title="语言种类" value={overview?.totalLanguages ?? 0} prefix={<Tag color="purple" style={{ marginRight: 0 }}>#</Tag>} /></Card></Col>
        </Row>
      </Spin>

      <Card style={{ marginBottom: 20, overflow: 'hidden' }}>
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Row gutter={[8, 12]} align="middle" style={{ flexWrap: 'wrap' }}>
            <Col xs={24} sm={12} md={8} lg={6}>
              <Input.Search placeholder="搜索仓库名、描述、作者..." defaultValue={keyword} onSearch={(val) => setUrlParam('keyword', val || null)} onChange={(e) => { if (!e.target.value) setUrlParam('keyword', null) }} allowClear />
            </Col>
            <Col xs={24} sm={12} md={10} lg={7}>
              <Select mode="multiple" placeholder="筛选语言" value={selectedLanguages} onChange={(vals) => setUrlParam('languages', vals.length > 0 ? vals.join(',') : null)} options={languageSelectOptions} allowClear showSearch maxTagCount={3} filterOption={(input, option) => (option?.label as string)?.toLowerCase().includes(input.toLowerCase())} style={{ width: '100%' }} />
            </Col>
            <Col xs={12} sm={8} md={6} lg={4}>
              <Select placeholder="排序字段" value={sortBy} onChange={(val) => setUrlParam('sortBy', val || null)} options={SORT_BY_OPTIONS} style={{ width: '100%' }} />
            </Col>
            <Col xs={12} sm={8} md={6} lg={3}>
              <Select placeholder="排序方向" value={sortOrder} onChange={(val) => setUrlParam('sortOrder', val || null)} options={SORT_ORDER_OPTIONS} style={{ width: '100%' }} />
            </Col>
            <Col xs={24} sm={24} md={24} lg={4}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {hasActiveFilters && <Button icon={<ClearOutlined />} onClick={handleClearFilters}>清除</Button>}
                <Button icon={<TranslationOutlined />} loading={batchTranslating} onClick={handleStartFullTranslate} style={{ flex: '1 1 auto', minWidth: 0 }}>批量翻译</Button>
                <Button type="primary" icon={<DownloadOutlined />} onClick={handleExport} style={{ flex: '1 1 auto', minWidth: 0 }}>导出链接</Button>
              </div>
            </Col>
          </Row>
          <Collapse ghost size="small" items={[{
            key: 'date-filter',
            label: <span style={{ fontSize: 13, color: '#666' }}><CaretDownOutlined style={{ marginRight: 4 }} />时间筛选</span>,
            children: (
              <Row gutter={[16, 12]} align="middle">
                <Col xs={24} sm={8} md={6} lg={4}><Select placeholder="时间字段" value={dateField} onChange={(val) => setUrlParam('dateField', val || null)} allowClear options={DATE_FIELD_OPTIONS} style={{ width: '100%' }} /></Col>
                <Col xs={12} sm={8} md={6} lg={4}><DatePicker picker="month" placeholder="起始月份" value={startMonth} onChange={(val) => { setStartMonthState(val); setUrlParam('startMonth', val ? val.format('YYYY-MM') : null) }} disabled={!dateField} style={{ width: '100%' }} /></Col>
                <Col xs={12} sm={8} md={6} lg={4}><DatePicker picker="month" placeholder="结束月份" value={endMonth} onChange={(val) => { setEndMonthState(val); setUrlParam('endMonth', val ? val.format('YYYY-MM') : null) }} disabled={!dateField} style={{ width: '100%' }} /></Col>
              </Row>
            ),
          }]} />
        </Space>
      </Card>

      <Spin spinning={loading}>
        {repos.length > 0 ? (
          viewMode === 'list' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {repos.map((repo) => <RepoRow key={repo.id} repo={repo} />)}
            </div>
          ) : (
            <Row gutter={[16, 16]}>
              {repos.map((repo) => (
                <Col key={repo.id} xs={24} sm={12} md={8} lg={6}>
                  <RepoCard repo={repo} />
                </Col>
              ))}
            </Row>
          )
        ) : (
          <Card>
            <Empty description={loading ? '加载中...' : pageResult.total === 0 ? '暂无仓库数据，请先同步' : '筛选无结果，请尝试调整筛选条件'}>
              {hasActiveFilters && <Button type="primary" onClick={handleClearFilters}>清除所有筛选</Button>}
            </Empty>
          </Card>
        )}

        {pageResult.total > pageSize && (
          <div style={{ marginTop: 20, display: 'flex', justifyContent: 'center' }}>
            <Pagination current={currentPage} pageSize={pageSize} total={pageResult.total} showSizeChanger pageSizeOptions={PAGE_SIZE_OPTIONS.map(String)} showQuickJumper showTotal={(total) => `共 ${total} 条 / ${pageResult.pages} 页`}
              onChange={(page, size) => { setUrlParam("page", String(page), false); if (size !== parseInt(searchParams.get("size") || "12", 10)) setUrlParam("size", String(size), false) }} />
          </div>
        )}
      </Spin>
      {renderTranslateProgress()}
    </div>
  )
}
