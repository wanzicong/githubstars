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
  ReadOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import * as statsApi from '../api/stats'
import * as starsApi from '../api/stars'
import * as translateApi from '../api/translate'
import * as categoriesApi from '../api/categories'
import { formatNumberCn } from '../utils/format'
import type { Category, GithubRepo, OverviewStatsDTO, LanguageStatsDTO, PageResult } from '../types'

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

const PAGE_SIZE_OPTIONS = [36, 72, 144]

const TIME_PRESETS: { label: string; value: string; days: number }[] = [
  { label: '不限', value: '', days: 0 },
  { label: '今天', value: 'today', days: 0 },
  { label: '7天内', value: '7d', days: 7 },
  { label: '30天内', value: '30d', days: 30 },
  { label: '90天内', value: '90d', days: 90 },
  { label: '半年内', value: '180d', days: 180 },
  { label: '一年内', value: '365d', days: 365 },
]

function RepoCard({ repo }: { repo: GithubRepo }) {
  return (
    <Card
      hoverable
      style={{ height: '100%', cursor: 'pointer' }}
      styles={{ body: { padding: 16 } }}
      onClick={() => { window.location.href = `/stars/${repo.id}` }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
        <Avatar src={repo.ownerAvatarUrl} alt={repo.ownerName} size={48} style={{ flexShrink: 0 }} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <Text strong style={{ fontSize: 16, display: 'block', lineHeight: '24px' }} ellipsis>
            <a style={{ color: '#1677ff' }} onClick={(e) => { e.stopPropagation(); window.location.href = `/stars/${repo.id}` }}>{repo.repoName}</a>
          </Text>
          <Text type="secondary" style={{ fontSize: 14 }} ellipsis>{repo.ownerName}</Text>
        </div>
      </div>
      {repo.descriptionCn ? (
        <Paragraph ellipsis={{ rows: 2 }} style={{ marginBottom: 10, fontSize: 14, minHeight: 40, color: '#333', lineHeight: '1.6' }}>
          {repo.descriptionCn}<Text type="secondary" style={{ fontSize: 12, marginLeft: 4 }}>🇨🇳</Text>
        </Paragraph>
      ) : repo.description ? (
        <Paragraph type="secondary" ellipsis={{ rows: 2 }} style={{ marginBottom: 10, fontSize: 14, minHeight: 40, lineHeight: '1.6' }}>
          {repo.description}
        </Paragraph>
      ) : null}
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
        {repo.language && <Tag color="blue" style={{ margin: 0, fontSize: 13 }}>{repo.language}</Tag>}
        {repo.categoryNames && repo.categoryNames.length > 0 && repo.categoryNames.map((cat) => (
          <Tag key={cat} color="green" style={{ margin: 0, fontSize: 13 }}>{cat}</Tag>
        ))}
        <Space size={4}>
          <StarFilled style={{ color: '#faad14', fontSize: 14 }} />
          <Text style={{ fontSize: 14 }}>{repo.starsCount}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>{formatNumberCn(repo.starsCount)}</Text>
        </Space>
        <Space size={4}>
          <ForkOutlined style={{ fontSize: 14 }} />
          <Text style={{ fontSize: 14 }}>{repo.forksCount}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>{formatNumberCn(repo.forksCount)}</Text>
        </Space>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 4 }}>
        <Text type="secondary" style={{ fontSize: 13 }}>Star 于 {formatDate(repo.starredAt)}</Text>
        {repo.repoPushedAt && (() => {
          const days = dayjs().diff(dayjs(repo.repoPushedAt), 'day')
          let color = 'green'; if (days > 180) color = 'red'; else if (days > 30) color = 'orange'
          return <Tag color={color} style={{ margin: 0, fontSize: 12 }}>未更新 {days} 天</Tag>
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Avatar src={repo.ownerAvatarUrl} alt={repo.ownerName} size={44} style={{ flexShrink: 0 }} />
            <div style={{ minWidth: 0 }}>
              <Text strong style={{ fontSize: 16 }} ellipsis>
                <a style={{ color: '#1677ff' }} onClick={(e) => { e.stopPropagation(); window.location.href = `/stars/${repo.id}` }}>{repo.repoName}</a>
              </Text>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                <Text type="secondary" style={{ fontSize: 13 }}>{repo.ownerName}</Text>
                {repo.language && <Tag color="blue" style={{ margin: 0, fontSize: 12 }}>{repo.language}</Tag>}
                {repo.categoryNames && repo.categoryNames.length > 0 && repo.categoryNames.slice(0, 2).map((cat) => (
                  <Tag key={cat} color="green" style={{ margin: 0, fontSize: 12 }}>{cat}</Tag>
                ))}
              </div>
              {repo.descriptionCn ? (
                <Paragraph ellipsis={{ rows: 1 }} style={{ margin: '4px 0 0', fontSize: 14, color: '#333', lineHeight: '1.6' }}>{repo.descriptionCn}</Paragraph>
              ) : repo.description ? (
                <Paragraph type="secondary" ellipsis={{ rows: 1 }} style={{ margin: '4px 0 0', fontSize: 14, lineHeight: '1.6' }}>{repo.description}</Paragraph>
              ) : null}
            </div>
          </div>
        </Col>
        <Col xs={24} sm={12} md={10}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
            <span><StarFilled style={{ color: '#faad14', fontSize: 14 }} /> <Text style={{ fontSize: 15 }}>{repo.starsCount}</Text><Text type="secondary" style={{ fontSize: 12, marginLeft: 2 }}>{formatNumberCn(repo.starsCount)}</Text></span>
            <span><ForkOutlined style={{ fontSize: 14 }} /> <Text style={{ fontSize: 15 }}>{repo.forksCount}</Text><Text type="secondary" style={{ fontSize: 12, marginLeft: 2 }}>{formatNumberCn(repo.forksCount)}</Text></span>
            {repo.repoPushedAt && (() => {
              const days = dayjs().diff(dayjs(repo.repoPushedAt), 'day')
              let color = 'green'; if (days > 180) color = 'red'; else if (days > 30) color = 'orange'
              return <Tag color={color} style={{ margin: 0, fontSize: 12 }}>未更新 {days} 天</Tag>
            })()}
            <Text type="secondary" style={{ fontSize: 13 }}>Star 于 {formatDate(repo.starredAt)}</Text>
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
  const categoryIdsStr = searchParams.get('categoryIds') || ''
  const selectedCategoryIds = categoryIdsStr ? categoryIdsStr.split(',') : []
  const sortBy = searchParams.get('sortBy') || 'starred_at'
  const sortOrder = searchParams.get('sortOrder') || 'desc'
  const dateField = searchParams.get('dateField') || undefined
  const currentPage = parseInt(searchParams.get('page') || '1', 10)
  const pageSize = parseInt(searchParams.get('size') || '36', 10)
  const startDateStr = searchParams.get('startDate')
  const endDateStr = searchParams.get('endDate')
  const viewMode = (searchParams.get('view') || 'list') as 'grid' | 'list'

  const [startDate, setStartDateState] = useState<dayjs.Dayjs | null>(startDateStr ? dayjs(startDateStr) : null)
  const [endDate, setEndDateState] = useState<dayjs.Dayjs | null>(endDateStr ? dayjs(endDateStr) : null)
  const timePreset = searchParams.get('timePreset') || ''

  useEffect(() => { setStartDateState(startDateStr ? dayjs(startDateStr) : null) }, [startDateStr])
  useEffect(() => { setEndDateState(endDateStr ? dayjs(endDateStr) : null) }, [endDateStr])

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

  const handleTimePreset = useCallback((value: string) => {
    if (!value) {
      setUrlParams({ timePreset: null, dateField: null, startDate: null, endDate: null })
      setStartDateState(null); setEndDateState(null)
      return
    }
    const preset = TIME_PRESETS.find(p => p.value === value)
    if (!preset) return
    // 保留用户已选的时间字段，不覆盖；未选时默认 starred_at
    const effectiveField = dateField || 'starred_at'
    if (preset.value === 'today') {
      const today = dayjs().format('YYYY-MM-DD')
      setStartDateState(dayjs(today)); setEndDateState(dayjs(today))
      setUrlParams({ timePreset: value, dateField: effectiveField, startDate: today, endDate: today })
    } else if (preset.days > 0) {
      const start = dayjs().subtract(preset.days, 'day').format('YYYY-MM-DD')
      setStartDateState(dayjs(start)); setEndDateState(null)
      setUrlParams({ timePreset: value, dateField: effectiveField, startDate: start, endDate: null })
    }
  }, [dateField, setUrlParams])

  const [pageResult, setPageResult] = useState<PageResult<GithubRepo>>({ records: [], total: 0, size: 12, current: 1, pages: 0 })
  const [overview, setOverview] = useState<OverviewStatsDTO | null>(null)
  const [languageOptions, setLanguageOptions] = useState<LanguageStatsDTO[]>([])
  const [categoryOptions, setCategoryOptions] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [initialLoading, setInitialLoading] = useState(true)

  useEffect(() => {
    const loadMeta = async () => {
      try {
        const [overviewRes, langRes, catRes] = await Promise.allSettled([statsApi.fetchOverviewStats(), statsApi.fetchLanguageStats(), categoriesApi.fetchAllCategories()])
        if (overviewRes.status === 'fulfilled') setOverview(overviewRes.value)
        if (langRes.status === 'fulfilled') setLanguageOptions(langRes.value)
        if (catRes.status === 'fulfilled') setCategoryOptions(catRes.value)
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
          language: languageStr || undefined, categoryIds: categoryIdsStr || undefined,
          sortBy: sortBy || undefined,
          sortOrder: sortOrder || undefined, dateField: dateField || undefined,
          startDate: startDate ? startDate.format('YYYY-MM-DD') : undefined,
          endDate: endDate ? endDate.format('YYYY-MM-DD') : undefined,
        })
        setPageResult(result)
      } catch { } finally { setLoading(false) }
    }
    loadPage()
  }, [currentPage, pageSize, keyword, languageStr, categoryIdsStr, sortBy, sortOrder, dateField, startDate, endDate])

  const handleClearFilters = useCallback(() => {
    setUrlParams({ keyword: null, languages: null, categoryIds: null, timePreset: null, sortBy: 'starred_at', sortOrder: 'desc', dateField: null, startDate: null, endDate: null })
    setStartDateState(null); setEndDateState(null)
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
            const result = await starsApi.fetchStarList({ page: currentPage, size: pageSize, keyword: keyword || undefined, language: languageStr || undefined, categoryIds: categoryIdsStr || undefined, sortBy: sortBy || undefined, sortOrder: sortOrder || undefined, dateField: dateField || undefined, startDate: startDate ? startDate.format('YYYY-MM-DD') : undefined, endDate: endDate ? endDate.format('YYYY-MM-DD') : undefined })
            setPageResult(result)
          }
        }
      } catch { }
    }, 2000)
  }, [currentPage, pageSize, keyword, languageStr, categoryIdsStr, sortBy, sortOrder, dateField, startDate, endDate])

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

  const handleStartReadmeBatch = useCallback(async () => {
    setBatchTranslating(true)
    try {
      const result = await translateApi.startReadmeBatch()
      if (result.success && result.taskId) {
        setTranslateTaskId(result.taskId)
        setTranslateProgress({ status: 'PENDING', totalItems: 0, completedItems: 0, failedItems: 0, descTotal: 0, descCompleted: 0, descFailed: 0, readmeTotal: 0, readmeCompleted: 0, readmeFailed: 0, progress: 0 })
        setTranslateModalVisible(true)
        startPolling(result.taskId)
      } else { message.info(result.message || '没有需要翻译 README 的项目') }
    } catch { message.error('启动 README 批量翻译失败') } finally { setBatchTranslating(false) }
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
        const res = await starsApi.fetchStarList({ page: currentPage, size: pageSize, keyword: keyword || undefined, language: languageStr || undefined, sortBy: sortBy || undefined, sortOrder: sortOrder || undefined, dateField: dateField || undefined, startDate: startDate ? startDate.format('YYYY-MM-DD') : undefined, endDate: endDate ? endDate.format('YYYY-MM-DD') : undefined })
        setPageResult(res)
      }
    } catch { } finally { setBatchTranslating(false) }
  }, [currentPage, pageSize, keyword, languageStr, categoryIdsStr, sortBy, sortOrder, dateField, startDate, endDate])

  const handleExport = useCallback(async () => {
    try {
      const params = { keyword: keyword || undefined, language: languageStr || undefined, categoryIds: categoryIdsStr || undefined, sortBy: sortBy || undefined, sortOrder: sortOrder || undefined, dateField: dateField || undefined, startDate: startDate ? startDate.format('YYYY-MM-DD') : undefined, endDate: endDate ? endDate.format('YYYY-MM-DD') : undefined }
      const defaultName = `stars_export_${dayjs().format('YYYYMMDD_HHmmss')}.txt`

      // Electron 桌面端：使用原生保存对话框
      if (window.electronAPI) {
        const content = await starsApi.exportStarsUrlsText(params)
        const result = await window.electronAPI.showSaveDialog({
          defaultPath: defaultName,
          filters: [{ name: '文本文件', extensions: ['txt'] }],
        })
        if (!result.canceled && result.filePath) {
          await window.electronAPI.writeFile(result.filePath, content)
          message.success('导出成功')
        }
      } else {
        // Web 模式：Blob 下载
        const blob = await starsApi.exportStarsUrls(params)
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = defaultName
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        window.URL.revokeObjectURL(url)
        message.success('导出成功')
      }
    } catch { console.error('导出失败'); message.error('导出失败') }
  }, [keyword, languageStr, categoryIdsStr, sortBy, sortOrder, dateField, startDate, endDate])

  const languageSelectOptions = useMemo(() => languageOptions.map((lang) => ({ label: `${lang.language} (${lang.count})`, value: lang.language })), [languageOptions])
  const categorySelectOptions = useMemo(() => categoryOptions.map((cat) => ({ label: cat.name, value: String(cat.id) })), [categoryOptions])

  const hasActiveFilters = keyword.trim() !== '' || languageStr !== '' || categoryIdsStr !== '' || sortBy !== 'starred_at' || sortOrder !== 'desc' || dateField !== undefined || startDate !== null || endDate !== null

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
            <Col xs={24} sm={12} md={6} lg={4}>
              <Select mode="multiple" placeholder="筛选分类" value={selectedCategoryIds} onChange={(vals) => setUrlParam('categoryIds', vals.length > 0 ? vals.join(',') : null)} options={categorySelectOptions} allowClear showSearch maxTagCount={2} filterOption={(input, option) => (option?.label as string)?.toLowerCase().includes(input.toLowerCase())} style={{ width: '100%' }} />
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
                <Button icon={<ReadOutlined />} loading={false} onClick={handleStartReadmeBatch} style={{ flex: '1 1 auto', minWidth: 0 }}>批量README</Button>
                <Button type="primary" icon={<DownloadOutlined />} onClick={handleExport} style={{ flex: '1 1 auto', minWidth: 0 }}>导出链接</Button>
              </div>
            </Col>
          </Row>
          <Collapse ghost size="small" items={[{
            key: 'date-filter',
            label: <span style={{ fontSize: 13, color: '#666' }}><CaretDownOutlined style={{ marginRight: 4 }} />时间筛选</span>,
            children: (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <Segmented
                  value={timePreset || '不限'}
                  onChange={(val) => handleTimePreset(val as string)}
                  options={TIME_PRESETS.map(p => ({ label: p.label, value: p.value || '不限' }))}
                  size="small"
                />
                <Row gutter={[16, 12]} align="middle">
                  <Col xs={24} sm={8} md={6} lg={4}><Select placeholder="时间字段" value={dateField} onChange={(val) => { setUrlParam('dateField', val || null); setUrlParam('timePreset', null) }} allowClear options={DATE_FIELD_OPTIONS} style={{ width: '100%' }} /></Col>
                  <Col xs={12} sm={8} md={6} lg={4}><DatePicker placeholder="起始日期" value={startDate} onChange={(val) => { setStartDateState(val); setUrlParam('startDate', val ? val.format('YYYY-MM-DD') : null); setUrlParam('timePreset', null) }} disabled={!dateField} style={{ width: '100%' }} /></Col>
                  <Col xs={12} sm={8} md={6} lg={4}><DatePicker placeholder="结束日期" value={endDate} onChange={(val) => { setEndDateState(val); setUrlParam('endDate', val ? val.format('YYYY-MM-DD') : null); setUrlParam('timePreset', null) }} disabled={!dateField} style={{ width: '100%' }} /></Col>
                </Row>
              </div>
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
              onChange={(page, size) => { setUrlParam("page", String(page), false); if (size !== parseInt(searchParams.get("size") || "36", 10)) setUrlParam("size", String(size), false) }} />
          </div>
        )}
      </Spin>
      {renderTranslateProgress()}
    </div>
  )
}
