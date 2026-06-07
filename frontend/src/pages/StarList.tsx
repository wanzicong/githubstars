import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Card,
  Input,
  Select,
  TreeSelect,
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
  BulbOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import * as statsApi from '../api/stats'
import * as starsApi from '../api/stars'
import * as translateApi from '../api/translate'
import * as categoriesApi from '../api/categories'
import * as analyzeApi from '../api/analyze'
import { formatNumberCn } from '../utils/format'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
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
        {repo.readmeFetched && repo.readmeCn ? (
          <Tag color="purple" style={{ margin: 0, fontSize: 12 }}><ReadOutlined style={{ fontSize: 11 }} /> 已翻译</Tag>
        ) : repo.readmeFetched ? (
          <Tag color="default" style={{ margin: 0, fontSize: 12 }}>无README</Tag>
        ) : null}
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
                {repo.readmeFetched && repo.readmeCn ? (
                  <Tag color="purple" style={{ margin: 0, fontSize: 11 }}><ReadOutlined style={{ fontSize: 10 }} /> 已翻译</Tag>
                ) : repo.readmeFetched ? (
                  <Tag color="default" style={{ margin: 0, fontSize: 11 }}>无README</Tag>
                ) : null}
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
  const startMonthStr = searchParams.get('startMonth')
  const endMonthStr = searchParams.get('endMonth')
  const viewMode = (searchParams.get('view') || 'list') as 'grid' | 'list'

  const [startMonth, setStartMonthState] = useState<dayjs.Dayjs | null>(startMonthStr ? dayjs(startMonthStr) : null)
  const [endMonth, setEndMonthState] = useState<dayjs.Dayjs | null>(endMonthStr ? dayjs(endMonthStr) : null)
  const timePreset = searchParams.get('timePreset') || ''

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

  const handleTimePreset = useCallback((value: string) => {
    if (!value) {
      setUrlParams({ timePreset: null, dateField: null, startMonth: null, endMonth: null })
      setStartMonthState(null); setEndMonthState(null)
      return
    }
    const preset = TIME_PRESETS.find(p => p.value === value)
    if (!preset) return
    if (preset.value === 'today') {
      const today = dayjs().format('YYYY-MM')
      setStartMonthState(dayjs(today)); setEndMonthState(dayjs(today))
      setUrlParams({ timePreset: value, dateField: 'starred_at', startMonth: today, endMonth: today })
    } else if (preset.days > 0) {
      const start = dayjs().subtract(preset.days, 'day').format('YYYY-MM')
      setStartMonthState(dayjs(start)); setEndMonthState(null)
      setUrlParams({ timePreset: value, dateField: 'starred_at', startMonth: start, endMonth: null })
    }
  }, [setUrlParams])

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
          startMonth: startMonth ? startMonth.format('YYYY-MM') : undefined,
          endMonth: endMonth ? endMonth.format('YYYY-MM') : undefined,
        })
        setPageResult(result)
      } catch { } finally { setLoading(false) }
    }
    loadPage()
  }, [currentPage, pageSize, keyword, languageStr, categoryIdsStr, sortBy, sortOrder, dateField, startMonth, endMonth])

  const handleClearFilters = useCallback(() => {
    setUrlParams({ keyword: null, languages: null, categoryIds: null, timePreset: null, sortBy: 'starred_at', sortOrder: 'desc', dateField: null, startMonth: null, endMonth: null })
    setStartMonthState(null); setEndMonthState(null)
  }, [setUrlParams])

  const [batchTranslating, setBatchTranslating] = useState(false)
  const [translateModalVisible, setTranslateModalVisible] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [analyzeTaskId, setAnalyzeTaskId] = useState<string | null>(null)
  const [analyzeModalVisible, setAnalyzeModalVisible] = useState(false)
  const [analyzeResult, setAnalyzeResult] = useState<string | null>(null)
  const [analyzeStatus, setAnalyzeStatus] = useState<string>('')
  const analyzePollingRef = useRef<ReturnType<typeof setInterval> | null>(null)
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
            const result = await starsApi.fetchStarList({ page: currentPage, size: pageSize, keyword: keyword || undefined, language: languageStr || undefined, categoryIds: categoryIdsStr || undefined, sortBy: sortBy || undefined, sortOrder: sortOrder || undefined, dateField: dateField || undefined, startMonth: startMonth ? startMonth.format('YYYY-MM') : undefined, endMonth: endMonth ? endMonth.format('YYYY-MM') : undefined })
            setPageResult(result)
          }
        }
      } catch { }
    }, 2000)
  }, [currentPage, pageSize, keyword, languageStr, categoryIdsStr, sortBy, sortOrder, dateField, startMonth, endMonth])

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

  const handleAiAnalyze = useCallback(async () => {
    setAnalyzing(true)
    try {
      const result = await analyzeApi.startAnalyze({
        keyword: keyword || undefined,
        language: languageStr || undefined,
        categoryIds: categoryIdsStr || undefined,
        sortBy: sortBy || undefined,
        sortOrder: sortOrder || undefined,
      })
      if (result.success && result.taskId) {
        setAnalyzeTaskId(result.taskId)
        setAnalyzeStatus('PROCESSING')
        setAnalyzeResult(null)
        setAnalyzeModalVisible(true)
        // 轮询结果
        const taskId = result.taskId
        if (analyzePollingRef.current) clearInterval(analyzePollingRef.current)
        analyzePollingRef.current = setInterval(async () => {
          try {
            const status = await analyzeApi.getAnalyzeStatus(taskId)
            if (status.status === 'COMPLETED') {
              if (analyzePollingRef.current) clearInterval(analyzePollingRef.current)
              setAnalyzeStatus('COMPLETED')
              setAnalyzeResult(status.content || '分析完成，但无内容返回')
            }
          } catch { }
        }, 3000)
      } else {
        message.info(result.message || '启动分析失败')
      }
    } catch { message.error('AI 分析请求失败') }
    finally { setAnalyzing(false) }
  }, [keyword, languageStr, categoryIdsStr, sortBy, sortOrder])

  const handleCloseAnalyzeModal = useCallback(() => {
    if (analyzePollingRef.current) clearInterval(analyzePollingRef.current)
    setAnalyzeModalVisible(false)
    setAnalyzeTaskId(null)
    setAnalyzeResult(null)
    setAnalyzeStatus('')
  }, [])

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
  }, [currentPage, pageSize, keyword, languageStr, categoryIdsStr, sortBy, sortOrder, dateField, startMonth, endMonth])

  const handleExport = useCallback(async () => {
    try {
      const blob = await starsApi.exportStarsUrls({ keyword: keyword || undefined, language: languageStr || undefined, categoryIds: categoryIdsStr || undefined, sortBy: sortBy || undefined, sortOrder: sortOrder || undefined, dateField: dateField || undefined, startMonth: startMonth ? startMonth.format('YYYY-MM') : undefined, endMonth: endMonth ? endMonth.format('YYYY-MM') : undefined })
      const url = window.URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `stars_export_${dayjs().format('YYYYMMDD_HHmmss')}.txt`; document.body.appendChild(a); a.click(); document.body.removeChild(a); window.URL.revokeObjectURL(url)
    } catch { console.error('导出失败') }
  }, [keyword, languageStr, categoryIdsStr, sortBy, sortOrder, dateField, startMonth, endMonth])

  const handleExportMd = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (keyword) params.set('keyword', keyword)
      if (languageStr) params.set('language', languageStr)
      if (categoryIdsStr) params.set('categoryIds', categoryIdsStr)
      if (sortBy) params.set('sortBy', sortBy)
      if (sortOrder) params.set('sortOrder', sortOrder)
      params.set('maxCount', '50')
      const resp = await fetch(`/export/md?${params.toString()}`)
      const blob = await resp.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = `stars_export_${dayjs().format('YYYYMMDD_HHmmss')}.md`
      document.body.appendChild(a); a.click(); document.body.removeChild(a); window.URL.revokeObjectURL(url)
    } catch { message.error('导出MD失败') }
  }, [keyword, languageStr, categoryIdsStr, sortBy, sortOrder])

  const [cloneTaskId, setCloneTaskId] = useState<string | null>(null)
  const [cloneModalVisible, setCloneModalVisible] = useState(false)
  const [cloneProgress, setCloneProgress] = useState<{ status: string; totalRepos: number; completedRepos: number; failedRepos: number; skippedRepos: number; results: { fullName: string; status: string; message: string }[] } | null>(null)
  const clonePollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const handleCloneExecute = useCallback(async () => {
    try {
      const params = new URLSearchParams({ maxCount: '50' })
      if (keyword) params.set('keyword', keyword)
      if (languageStr) params.set('language', languageStr)
      if (categoryIdsStr) params.set('categoryIds', categoryIdsStr)
      const resp = await fetch('/api/clone/start', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.fromEntries(params)) })
      const data = await resp.json()
      if (data.success && data.taskId) {
        setCloneTaskId(data.taskId)
        setCloneProgress({ status: 'RUNNING', totalRepos: 0, completedRepos: 0, failedRepos: 0, skippedRepos: 0, results: [] })
        setCloneModalVisible(true)
        if (clonePollRef.current) clearInterval(clonePollRef.current)
        clonePollRef.current = setInterval(async () => {
          try {
            const r = await fetch(`/api/clone/task/${data.taskId}`)
            const p = await r.json()
            if (p.success) {
              setCloneProgress(p)
              if (p.status === 'COMPLETED' && clonePollRef.current) clearInterval(clonePollRef.current)
            }
          } catch {}
        }, 2000)
      }
    } catch { message.error('启动Clone失败') }
  }, [keyword, languageStr, categoryIdsStr])

  const handleCloseCloneModal = () => { if (clonePollRef.current) clearInterval(clonePollRef.current); setCloneModalVisible(false); setCloneTaskId(null); setCloneProgress(null) }

  const languageSelectOptions = useMemo(() => languageOptions.map((lang) => ({ label: `${lang.language} (${lang.count})`, value: lang.language })), [languageOptions])
  const categoryTreeData = useMemo(() => {
    const buildTree = (cats: Category[]): any[] => {
      return cats.map(cat => {
        const node: any = {
          title: (cat.level === 1 ? '📁 ' : '📂 ') + cat.name + ' (' + cat.repoCount + ')',
          value: String(cat.id),
          key: String(cat.id),
        }
        if (cat.children && cat.children.length > 0) {
          node.children = buildTree(cat.children)
        }
        return node
      })
    }
    return buildTree(categoryOptions.filter(c => c.level === 1 || !c.parentId))
  }, [categoryOptions])

  const hasActiveFilters = keyword.trim() !== '' || languageStr !== '' || categoryIdsStr !== '' || sortBy !== 'starred_at' || sortOrder !== 'desc' || dateField !== undefined || startMonth !== null || endMonth !== null

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

      <Card style={{ marginBottom: 20 }}>
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Row gutter={[8, 12]} align="middle" style={{ flexWrap: 'wrap' }}>
            <Col xs={24} sm={12} md={8} lg={6}>
              <Input.Search placeholder="搜索仓库名、描述、作者..." defaultValue={keyword} onSearch={(val) => setUrlParam('keyword', val || null)} onChange={(e) => { if (!e.target.value) setUrlParam('keyword', null) }} allowClear />
            </Col>
            <Col xs={24} sm={12} md={10} lg={7}>
              <Select mode="multiple" placeholder="筛选语言" value={selectedLanguages} onChange={(vals) => setUrlParam('languages', vals.length > 0 ? vals.join(',') : null)} options={languageSelectOptions} allowClear showSearch maxTagCount={3} filterOption={(input, option) => (option?.label as string)?.toLowerCase().includes(input.toLowerCase())} style={{ width: '100%' }} />
            </Col>
            <Col xs={24} sm={12} md={6} lg={4}>
              <TreeSelect treeData={categoryTreeData} value={selectedCategoryIds} onChange={(vals) => setUrlParam('categoryIds', vals.length > 0 ? vals.join(',') : null)} placeholder="筛选分类" treeCheckable showCheckedStrategy={TreeSelect.SHOW_CHILD} allowClear showSearch maxTagCount={2} filterTreeNode={(input, node) => (node?.title as string)?.toLowerCase().includes(input.toLowerCase())} style={{ width: '100%' }} />
            </Col>
            <Col xs={12} sm={8} md={6} lg={4}>
              <Select placeholder="排序字段" value={sortBy} onChange={(val) => setUrlParam('sortBy', val || null)} options={SORT_BY_OPTIONS} style={{ width: '100%' }} />
            </Col>
            <Col xs={12} sm={8} md={6} lg={3}>
              <Select placeholder="排序方向" value={sortOrder} onChange={(val) => setUrlParam('sortOrder', val || null)} options={SORT_ORDER_OPTIONS} style={{ width: '100%' }} />
            </Col>
          </Row>
          <Row gutter={[8, 8]} style={{ marginTop: 8 }}>
            <Col span={24}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {hasActiveFilters && <Button icon={<ClearOutlined />} onClick={handleClearFilters}>清除</Button>}
                <Button icon={<TranslationOutlined />} loading={batchTranslating} onClick={handleStartFullTranslate}>批量翻译</Button>
                <Button icon={<ReadOutlined />} loading={false} onClick={handleStartReadmeBatch}>批量README</Button>
                <Button icon={<BulbOutlined />} loading={analyzing} onClick={handleAiAnalyze}>AI 分析</Button>
                <Button icon={<DownloadOutlined />} onClick={handleExportMd}>导出MD</Button>
                <Button icon={<DownloadOutlined />} onClick={handleCloneExecute}>批量Clone</Button>
                <Button type="primary" icon={<DownloadOutlined />} onClick={handleExport}>导出链接</Button>
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
                  <Col xs={24} sm={8} md={6} lg={4}><Select placeholder="时间字段" value={dateField} onChange={(val) => setUrlParam('dateField', val || null)} allowClear options={DATE_FIELD_OPTIONS} style={{ width: '100%' }} /></Col>
                  <Col xs={12} sm={8} md={6} lg={4}><DatePicker picker="month" placeholder="起始月份" value={startMonth} onChange={(val) => { setStartMonthState(val); setUrlParam('startMonth', val ? val.format('YYYY-MM') : null); setUrlParam('timePreset', null) }} disabled={!dateField} style={{ width: '100%' }} /></Col>
                  <Col xs={12} sm={8} md={6} lg={4}><DatePicker picker="month" placeholder="结束月份" value={endMonth} onChange={(val) => { setEndMonthState(val); setUrlParam('endMonth', val ? val.format('YYYY-MM') : null); setUrlParam('timePreset', null) }} disabled={!dateField} style={{ width: '100%' }} /></Col>
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

      {/* AI 分析结果弹窗 */}
      <Modal
        title={<Space><BulbOutlined style={{ color: '#faad14' }} />AI 项目分析总结</Space>}
        open={analyzeModalVisible}
        onCancel={handleCloseAnalyzeModal}
        footer={<Button type="primary" onClick={handleCloseAnalyzeModal}>关闭</Button>}
        width={900}
        style={{ top: 20 }}
        maskClosable={analyzeStatus === 'COMPLETED'}
        closable={analyzeStatus === 'COMPLETED'}
      >
        {analyzeStatus === 'PROCESSING' && (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <Spin size="large" />
            <div style={{ marginTop: 16, fontSize: 15, color: '#666' }}>
              <BulbOutlined style={{ color: '#faad14', marginRight: 8 }} />
              AI 正在分析筛选出的项目，请耐心等待...
            </div>
            <div style={{ marginTop: 8, fontSize: 13, color: '#999' }}>
              最多分析 30 个项目 | 分析内容包括描述和 README
            </div>
          </div>
        )}
        {analyzeStatus === 'COMPLETED' && analyzeResult && (
          <div style={{ maxHeight: '70vh', overflow: 'auto', padding: '8px 0' }} className="readme-markdown">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                h1: ({ children }) => <h1 style={{ fontSize: 20, borderBottom: '2px solid #1677ff', paddingBottom: 8, marginTop: 20, marginBottom: 12 }}>{children}</h1>,
                h2: ({ children }) => <h2 style={{ fontSize: 17, borderBottom: '1px solid #eee', paddingBottom: 6, marginTop: 16, marginBottom: 10 }}>{children}</h2>,
                h3: ({ children }) => <h3 style={{ fontSize: 15, marginTop: 14, marginBottom: 8 }}>{children}</h3>,
                p: ({ children }) => <p style={{ lineHeight: 1.8, marginBottom: 10, fontSize: 14 }}>{children}</p>,
                a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: '#1677ff' }}>{children}</a>,
                ul: ({ children }) => <ul style={{ paddingLeft: 24, marginBottom: 10, lineHeight: 1.8 }}>{children}</ul>,
                ol: ({ children }) => <ol style={{ paddingLeft: 24, marginBottom: 10, lineHeight: 1.8 }}>{children}</ol>,
                li: ({ children }) => <li style={{ marginBottom: 4, fontSize: 14 }}>{children}</li>,
                code: ({ children }) => <code style={{ backgroundColor: '#f5f5f5', padding: '2px 6px', borderRadius: 3, fontSize: 13 }}>{children}</code>,
                pre: ({ children }) => <pre style={{ backgroundColor: '#f6f8fa', padding: 14, borderRadius: 6, overflow: 'auto', fontSize: 13, lineHeight: 1.5, marginBottom: 14 }}>{children}</pre>,
                strong: ({ children }) => <strong style={{ fontWeight: 600 }}>{children}</strong>,
                table: ({ children }) => <table style={{ borderCollapse: 'collapse', width: '100%', marginBottom: 14 }}>{children}</table>,
                th: ({ children }) => <th style={{ border: '1px solid #ddd', padding: '8px 12px', backgroundColor: '#f5f5f5', fontWeight: 600, fontSize: 13 }}>{children}</th>,
                td: ({ children }) => <td style={{ border: '1px solid #ddd', padding: '8px 12px', fontSize: 13 }}>{children}</td>,
              }}
            >
              {analyzeResult}
            </ReactMarkdown>
          </div>
        )}
      </Modal>

      {/* Clone 进度弹窗 */}
      <Modal title="批量 Clone 进度" open={cloneModalVisible} onCancel={handleCloseCloneModal}
        footer={<Button type="primary" onClick={handleCloseCloneModal}>关闭</Button>}
        maskClosable={cloneProgress?.status === 'COMPLETED'}>
        {cloneProgress && (
          <div>
            <div style={{ marginBottom: 16, display: 'flex', gap: 16, justifyContent: 'center' }}>
              <span>总数: <Text strong>{cloneProgress.totalRepos}</Text></span>
              <span style={{ color: '#52c41a' }}>成功: <Text strong>{cloneProgress.completedRepos}</Text></span>
              <span style={{ color: '#faad14' }}>跳过: <Text strong>{cloneProgress.skippedRepos}</Text></span>
              <span style={{ color: '#ff4d4f' }}>失败: <Text strong>{cloneProgress.failedRepos}</Text></span>
            </div>
            {cloneProgress.status !== 'COMPLETED' && <Spin tip="正在 Clone..." style={{ display: 'block', textAlign: 'center' }} />}
            {cloneProgress.results.length > 0 && (
              <div style={{ maxHeight: 400, overflow: 'auto' }}>
                {cloneProgress.results.map((r, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, padding: '4px 0', borderBottom: '1px solid #f0f0f0', fontSize: 13 }}>
                    <span style={{ minWidth: 60, color: r.status === 'CLONED' ? '#52c41a' : r.status === 'SKIPPED' ? '#faad14' : '#ff4d4f' }}>
                      {r.status === 'CLONED' ? '✅ 已克隆' : r.status === 'SKIPPED' ? '⏭ 跳过' : '❌ 失败'}
                    </span>
                    <Text style={{ flex: 1 }}>{r.fullName}</Text>
                    <Text type="secondary">{r.message}</Text>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
