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
  Popconfirm,
  message,
  Alert,
  Segmented,
  AutoComplete,
  InputNumber,
  Switch,
} from 'antd'
import {
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
import dayjs from '../setupDayjs'
import * as statsApi from '../api/stats'
import * as starsApi from '../api/stars'
import * as translateApi from '../api/translate'
import * as categoriesApi from '../api/categories'
import * as analyzeApi from '../api/analyze'
import * as cloneApi from '../api/clone'
import { buildTargetPath, sanitizeSubdirectory } from '../utils/clonePath'
import { formatNumberCn } from '../utils/format'
import ReactMarkdown from 'react-markdown'
import rehypeRaw from 'rehype-raw'
import remarkGfm from 'remark-gfm'
import TranslatePanel from '../components/TranslatePanel'
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
  const startDateStr = searchParams.get('startDate')
  const endDateStr = searchParams.get('endDate')
  const untranslatedOnly = searchParams.get('untranslatedOnly') === 'true'
  const viewMode = (searchParams.get('view') || 'list') as 'grid' | 'list'

  const startDate = useMemo(() => {
    if (!startDateStr) return null
    const parsed = dayjs(startDateStr, 'YYYY-MM-DD', true)
    return parsed.isValid() ? parsed : null
  }, [startDateStr])

  const endDate = useMemo(() => {
    if (!endDateStr) return null
    const parsed = dayjs(endDateStr, 'YYYY-MM-DD', true)
    return parsed.isValid() ? parsed : null
  }, [endDateStr])

  const timePreset = searchParams.get('timePreset') || ''

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
    const normalized = value === '不限' ? '' : value
    if (!normalized) {
      setUrlParams({ timePreset: null, dateField: null, startDate: null, endDate: null })
      return
    }
    const preset = TIME_PRESETS.find(p => p.value === normalized)
    if (!preset) return
    // 保留用户已选的时间字段，不覆盖；未选时默认 starred_at
    const effectiveField = dateField || 'starred_at'
    if (preset.value === 'today') {
      const today = dayjs().format('YYYY-MM-DD')
      setUrlParams({ timePreset: normalized, dateField: effectiveField, startDate: today, endDate: today })
    } else if (preset.days > 0) {
      const start = dayjs().subtract(preset.days, 'day').format('YYYY-MM-DD')
      const end = dayjs().format('YYYY-MM-DD')
      setUrlParams({ timePreset: normalized, dateField: effectiveField, startDate: start, endDate: end })
    }
  }, [dateField, setUrlParams])

  const handleDateFieldChange = useCallback((val: string | undefined) => {
    if (!val) {
      setUrlParams({ dateField: null, startDate: null, endDate: null, timePreset: null })
      return
    }
    setUrlParams({ dateField: val, timePreset: null })
  }, [setUrlParams])

  const handleStartDateChange = useCallback((val: dayjs.Dayjs | null) => {
    if (val && endDate && val.isAfter(endDate, 'day')) {
      const formatted = val.format('YYYY-MM-DD')
      setUrlParams({ startDate: formatted, endDate: formatted, timePreset: null })
      message.warning('起始日期不能晚于结束日期，已自动对齐')
      return
    }
    setUrlParams({ startDate: val ? val.format('YYYY-MM-DD') : null, timePreset: null })
  }, [endDate, setUrlParams])

  const handleEndDateChange = useCallback((val: dayjs.Dayjs | null) => {
    if (val && startDate && val.isBefore(startDate, 'day')) {
      const formatted = val.format('YYYY-MM-DD')
      setUrlParams({ startDate: formatted, endDate: formatted, timePreset: null })
      message.warning('结束日期不能早于起始日期，已自动对齐')
      return
    }
    setUrlParams({ endDate: val ? val.format('YYYY-MM-DD') : null, timePreset: null })
  }, [startDate, setUrlParams])

  const dateFieldLabel = DATE_FIELD_OPTIONS.find((item) => item.value === dateField)?.label
  const timeFilterSummary = useMemo(() => {
    if (!dateField && !timePreset) return ''
    const presetLabel = TIME_PRESETS.find((item) => item.value === timePreset)?.label
    const rangeText = startDate && endDate
      ? `${startDate.format('YYYY年M月D日')} ~ ${endDate.format('YYYY年M月D日')}`
      : startDate
        ? `${startDate.format('YYYY年M月D日')} 起`
        : endDate
          ? `至 ${endDate.format('YYYY年M月D日')}`
          : ''
    if (presetLabel && presetLabel !== '不限') {
      return `${dateFieldLabel || 'Star 时间'} · ${presetLabel}${rangeText ? `（${rangeText}）` : ''}`
    }
    if (dateFieldLabel && rangeText) return `${dateFieldLabel} · ${rangeText}`
    if (dateFieldLabel) return dateFieldLabel
    return ''
  }, [dateField, dateFieldLabel, timePreset, startDate, endDate])

  const dateFilterExpanded = !!(dateField || startDateStr || endDateStr || timePreset)

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
    let cancelled = false
    const loadPage = async () => {
      setLoading(true)
      try {
        const result = await starsApi.fetchStarList({
          page: currentPage, size: pageSize, keyword: keyword || undefined,
          language: languageStr || undefined, categoryIds: categoryIdsStr || undefined,
          sortBy: sortBy || undefined,
          sortOrder: sortOrder || undefined, dateField: dateField || undefined,
          startDate: startDateStr || undefined,
          endDate: endDateStr || undefined,
          untranslatedOnly: untranslatedOnly || undefined,
        })
        if (!cancelled) setPageResult(result)
      } catch {
        if (!cancelled) message.error('加载列表失败')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    loadPage()
    return () => { cancelled = true }
  }, [currentPage, pageSize, keyword, languageStr, categoryIdsStr, sortBy, sortOrder, dateField, startDateStr, endDateStr, untranslatedOnly])

  const handleClearFilters = useCallback(() => {
    setUrlParams({ keyword: null, languages: null, categoryIds: null, timePreset: null, sortBy: 'starred_at', sortOrder: 'desc', dateField: null, startDate: null, endDate: null, untranslatedOnly: null })
  }, [setUrlParams])

  const [fullTranslating, setFullTranslating] = useState(false)
  const [readmeTranslating, setReadmeTranslating] = useState(false)
  const [filterTranslating, setFilterTranslating] = useState(false)
  const [translatePanelOpen, setTranslatePanelOpen] = useState(false)
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
            const result = await starsApi.fetchStarList({ page: currentPage, size: pageSize, keyword: keyword || undefined, language: languageStr || undefined, categoryIds: categoryIdsStr || undefined, sortBy: sortBy || undefined, sortOrder: sortOrder || undefined, dateField: dateField || undefined, startDate: startDateStr || undefined, endDate: endDateStr || undefined })
            setPageResult(result)
          }
        }
      } catch { }
    }, 2000)
  }, [currentPage, pageSize, keyword, languageStr, categoryIdsStr, sortBy, sortOrder, dateField, startDateStr, endDateStr])

  const handleStartFullTranslate = useCallback(async () => {
    setFullTranslating(true)
    try {
      const result = await translateApi.startFullTranslate()
      if (result.success && result.taskId) {
        setTranslateTaskId(result.taskId)
        setTranslateProgress({ status: 'PENDING', totalItems: 0, completedItems: 0, failedItems: 0, descTotal: 0, descCompleted: 0, descFailed: 0, readmeTotal: 0, readmeCompleted: 0, readmeFailed: 0, progress: 0 })
        setTranslateModalVisible(true)
        startPolling(result.taskId)
      } else { message.info(result.message || '没有需要翻译的项目') }
    } catch { message.error('启动翻译失败') } finally { setFullTranslating(false) }
  }, [startPolling])

  const handleStartReadmeBatch = useCallback(async () => {
    setReadmeTranslating(true)
    try {
      const result = await translateApi.startReadmeBatch()
      if (result.success && result.taskId) {
        setTranslateTaskId(result.taskId)
        setTranslateProgress({ status: 'PENDING', totalItems: 0, completedItems: 0, failedItems: 0, descTotal: 0, descCompleted: 0, descFailed: 0, readmeTotal: 0, readmeCompleted: 0, readmeFailed: 0, progress: 0 })
        setTranslateModalVisible(true)
        startPolling(result.taskId)
      } else { message.info(result.message || '没有需要翻译 README 的项目') }
    } catch { message.error('启动 README 批量翻译失败') } finally { setReadmeTranslating(false) }
  }, [startPolling])

  const handleFilterTranslate = useCallback(async () => {
    setFilterTranslating(true)
    try {
      const result = await translateApi.startFilterBatch({
        keyword: keyword || undefined,
        language: languageStr || undefined,
        categoryIds: categoryIdsStr || undefined,
        sortBy: sortBy || undefined,
        sortOrder: sortOrder || undefined,
        dateField: dateField || undefined,
        startDate: startDateStr || undefined,
        endDate: endDateStr || undefined,
      })
      if (result.success && result.taskId) {
        setTranslateTaskId(result.taskId)
        setTranslateProgress({ status: 'PENDING', totalItems: 0, completedItems: 0, failedItems: 0, descTotal: 0, descCompleted: 0, descFailed: 0, readmeTotal: 0, readmeCompleted: 0, readmeFailed: 0, progress: 0 })
        setTranslateModalVisible(true)
        startPolling(result.taskId)
      } else { message.info(result.message || '没有需要翻译的项目') }
    } catch { message.error('启动筛选翻译失败') } finally { setFilterTranslating(false) }
  }, [keyword, languageStr, categoryIdsStr, sortBy, sortOrder, dateField, startDateStr, endDateStr, startPolling])

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

  // (已移除废弃的单独批量翻译入口 handleBatchTranslate)

  const handleExport = useCallback(async () => {
    try {
      const blob = await starsApi.exportStarsUrls({ keyword: keyword || undefined, language: languageStr || undefined, categoryIds: categoryIdsStr || undefined, sortBy: sortBy || undefined, sortOrder: sortOrder || undefined, dateField: dateField || undefined, startDate: startDateStr || undefined, endDate: endDateStr || undefined })
      const url = window.URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `stars_export_${dayjs().format('YYYYMMDD_HHmmss')}.txt`; document.body.appendChild(a); a.click(); document.body.removeChild(a); window.URL.revokeObjectURL(url)
    } catch { console.error('导出失败') }
  }, [keyword, languageStr, categoryIdsStr, sortBy, sortOrder, dateField, startDateStr, endDateStr])

  const handleExportMd = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (keyword) params.set('keyword', keyword)
      if (languageStr) params.set('language', languageStr)
      if (categoryIdsStr) params.set('categoryIds', categoryIdsStr)
      if (sortBy) params.set('sortBy', sortBy)
      if (sortOrder) params.set('sortOrder', sortOrder)
      const totalCount = pageResult?.total ?? 0
      if (totalCount === 0) { message.warning('没有匹配的仓库可导出'); return }
      params.set('maxCount', String(totalCount))
      const resp = await fetch(`/export/md?${params.toString()}`)
      const blob = await resp.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = `stars_export_${dayjs().format('YYYYMMDD_HHmmss')}.md`
      document.body.appendChild(a); a.click(); document.body.removeChild(a); window.URL.revokeObjectURL(url)
    } catch { message.error('导出MD失败') }
  }, [keyword, languageStr, categoryIdsStr, sortBy, sortOrder, pageResult?.total])

  const [cloneModalVisible, setCloneModalVisible] = useState(false)
  const [cloneDirModalVisible, setCloneDirModalVisible] = useState(false)
  const [cloneBaseDir, setCloneBaseDir] = useState('')
  const [cloneSubDir, setCloneSubDir] = useState('')
  const [cloneSubDirHistory, setCloneSubDirHistory] = useState<string[]>([])
  const [cloneDirLoading, setCloneDirLoading] = useState(false)
  const [cloneStarting, setCloneStarting] = useState(false)
  const [cloneInProgress, setCloneInProgress] = useState(false)
  const [cloneTargetDir, setCloneTargetDir] = useState('')
  const [cloneSubDirError, setCloneSubDirError] = useState('')
  const [cloneProgress, setCloneProgress] = useState<{ status: string; errorMessage?: string; totalRepos: number; completedRepos: number; failedRepos: number; skippedRepos: number; results: { fullName: string; status: string; message: string }[] } | null>(null)
  const [cloneConcurrency, setCloneConcurrency] = useState(5)
  const [cloneDepth, setCloneDepth] = useState(1)
  const [cloneMaxRepoSizeMb, setCloneMaxRepoSizeMb] = useState(500)
  const clonePollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const clonePollFailCountRef = useRef(0)

  useEffect(() => {
    return () => {
      if (clonePollRef.current) clearInterval(clonePollRef.current)
    }
  }, [])

  const handleOpenCloneDirModal = useCallback(async () => {
    if (cloneInProgress) {
      message.warning('已有 Clone 任务正在执行，请等待完成')
      setCloneModalVisible(true)
      return
    }
    setCloneDirModalVisible(true)
    setCloneDirLoading(true)
    setCloneSubDirError('')
    try {
      const config = await cloneApi.fetchCloneConfig()
      setCloneBaseDir(config.baseDirectory)
      setCloneSubDirHistory(config.subdirectoryHistory || [])
      setCloneSubDir(config.lastSubdirectory || '')
      setCloneInProgress(!!config.hasActiveTask)
    } catch {
      message.error('加载 Clone 配置失败')
    } finally {
      setCloneDirLoading(false)
    }
  }, [cloneInProgress])

  const handleCloneExecute = useCallback(async () => {
    const { error } = sanitizeSubdirectory(cloneSubDir)
    if (error) {
      setCloneSubDirError(error)
      message.error(error)
      return
    }

    const totalCount = pageResult.total
    if (totalCount > 200) {
      const confirmed = await new Promise<boolean>((resolve) => {
        Modal.confirm({
          title: '项目数量较多，确认克隆吗？',
          content: `当前筛选结果共 ${totalCount} 个项目，并发数 ${cloneConcurrency}。克隆大量项目可能占用较多磁盘空间和网络带宽。`,
          okText: '确认克隆',
          cancelText: '不克隆',
          onOk: () => resolve(true),
          onCancel: () => resolve(false),
        })
      })
      if (!confirmed) return
    }

    setCloneStarting(true)
    setCloneSubDirError('')
    try {
      const data = await cloneApi.startClone({
        keyword: keyword || undefined,
        language: languageStr || undefined,
        categoryIds: categoryIdsStr || undefined,
        maxCount: totalCount,
        subDirectory: cloneSubDir.trim() || undefined,
        dateField: dateField || undefined,
        startDate: startDateStr || undefined,
        endDate: endDateStr || undefined,
        sortBy: sortBy || undefined,
        sortOrder: sortOrder || undefined,
        concurrency: cloneConcurrency,
        cloneDepth: cloneDepth,
        maxRepoSizeMb: cloneMaxRepoSizeMb,
      })
      if (!data.success) {
        message.error(data.message || '启动 Clone 失败')
        return
      }
      if (data.taskId) {
        clonePollTaskIdRef.current = data.taskId
        setCloneTargetDir(data.targetDirectory || '')
        setCloneDirModalVisible(false)
        setCloneInProgress(true)
        setCloneProgress({ status: 'RUNNING', totalRepos: 0, completedRepos: 0, failedRepos: 0, skippedRepos: 0, results: [] })
        setCloneModalVisible(true)
        clonePollFailCountRef.current = 0
        if (clonePollRef.current) clearInterval(clonePollRef.current)
        clonePollRef.current = setInterval(async () => {
          try {
            const p = await cloneApi.fetchCloneTask(data.taskId!)
            if (p.success) {
              clonePollFailCountRef.current = 0
              setCloneProgress(p)
              if (p.status === 'COMPLETED' || p.status === 'FAILED') {
                setCloneInProgress(false)
                if (clonePollRef.current) clearInterval(clonePollRef.current)
              }
            }
          } catch {
            clonePollFailCountRef.current += 1
            if (clonePollFailCountRef.current >= 3) {
              message.error('查询 Clone 进度失败，请稍后重试')
              if (clonePollRef.current) clearInterval(clonePollRef.current)
            }
          }
        }, 2000)
      }
    } catch {
      message.error('启动 Clone 失败')
    } finally {
      setCloneStarting(false)
    }
  }, [keyword, languageStr, categoryIdsStr, cloneSubDir, dateField, startDateStr, endDateStr, sortBy, sortOrder, cloneConcurrency, cloneDepth, cloneMaxRepoSizeMb, pageResult.total])

  const handleCloseCloneModal = () => {
    if (clonePollRef.current) clearInterval(clonePollRef.current)
    setCloneProgress((prev) => {
      if (!prev || prev.status === 'COMPLETED' || prev.status === 'FAILED') {
        setCloneInProgress(false)
      }
      return null
    })
    setCloneModalVisible(false)
    setCloneTargetDir('')
  }

  const handleCancelCloneTask = useCallback(async () => {
    if (!cloneProgress || cloneProgress.status !== 'RUNNING') return
    // 从缓存中找到当前 taskId（通过 polling 上下文）
    try {
      const res = await cloneApi.cancelCloneTask(clonePollTaskIdRef.current)
      if (res.success) {
        message.success('已发送取消请求')
      } else {
        message.warning(res.message || '取消失败')
      }
    } catch {
      message.error('取消请求失败')
    }
  }, [cloneProgress])

  const clonePollTaskIdRef = useRef<string>('')

  const handleCloneSubDirChange = useCallback((value: string) => {
    setCloneSubDir(value)
    const { error } = sanitizeSubdirectory(value)
    setCloneSubDirError(error || '')
  }, [])

  const cloneSubDirOptions = useMemo(
    () => cloneSubDirHistory.map((dir) => ({ value: dir, label: dir })),
    [cloneSubDirHistory],
  )

  const cloneTargetPreview = useMemo(() => buildTargetPath(cloneBaseDir, cloneSubDir), [cloneBaseDir, cloneSubDir])

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

  const hasActiveFilters = keyword.trim() !== '' || languageStr !== '' || categoryIdsStr !== '' || sortBy !== 'starred_at' || sortOrder !== 'desc' || dateField !== undefined || !!startDateStr || !!endDateStr || untranslatedOnly

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
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                {hasActiveFilters && <Button icon={<ClearOutlined />} onClick={handleClearFilters}>清除</Button>}
                <Button
                  icon={<TranslationOutlined />}
                  onClick={() => setTranslatePanelOpen(true)}
                >
                  翻译管理
                </Button>
                <Button icon={<BulbOutlined />} loading={analyzing} onClick={handleAiAnalyze}>AI 分析</Button>
                <Button icon={<DownloadOutlined />} onClick={handleExportMd}>导出MD</Button>
                <Button icon={<DownloadOutlined />} onClick={handleOpenCloneDirModal} disabled={cloneInProgress}>批量Clone</Button>
                <Button type="primary" icon={<DownloadOutlined />} onClick={handleExport}>导出链接</Button>
                <Switch
                  checked={untranslatedOnly}
                  onChange={(checked) => setUrlParam('untranslatedOnly', checked ? 'true' : null)}
                  checkedChildren="仅未翻译"
                  unCheckedChildren="全部"
                />
              </div>
            </Col>
          </Row>
          <Collapse
            ghost
            size="small"
            defaultActiveKey={dateFilterExpanded ? ['date-filter'] : undefined}
            items={[{
            key: 'date-filter',
            label: (
              <span style={{ fontSize: 13, color: '#666' }}>
                <CaretDownOutlined style={{ marginRight: 4 }} />
                时间筛选
                {timeFilterSummary && (
                  <Tag color="blue" style={{ marginLeft: 8, fontSize: 12 }}>{timeFilterSummary}</Tag>
                )}
              </span>
            ),
            children: (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>快捷选择</Text>
                  <Segmented
                    value={timePreset || '不限'}
                    onChange={(val) => handleTimePreset(val as string)}
                    options={TIME_PRESETS.map(p => ({ label: p.label, value: p.value || '不限' }))}
                    size="small"
                  />
                </div>
                <div>
                  <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>自定义范围</Text>
                  <Row gutter={[12, 12]} align="middle">
                    <Col xs={24} sm={8} md={6} lg={5}>
                      <Select
                        placeholder="选择时间字段"
                        value={dateField}
                        onChange={handleDateFieldChange}
                        allowClear
                        options={DATE_FIELD_OPTIONS}
                        style={{ width: '100%' }}
                      />
                    </Col>
                    <Col xs={12} sm={8} md={6} lg={5}>
                      <DatePicker
                        placeholder="起始日期"
                        format="YYYY年MM月DD日"
                        value={startDate}
                        onChange={handleStartDateChange}
                        disabled={!dateField}
                        allowClear
                        style={{ width: '100%' }}
                      />
                    </Col>
                    <Col xs={12} sm={8} md={6} lg={5}>
                      <DatePicker
                        placeholder="结束日期"
                        format="YYYY年MM月DD日"
                        value={endDate}
                        onChange={handleEndDateChange}
                        disabled={!dateField}
                        allowClear
                        style={{ width: '100%' }}
                      />
                    </Col>
                  </Row>
                  {!dateField && (
                    <Text type="secondary" style={{ fontSize: 12, marginTop: 8, display: 'block' }}>
                      请先选择时间字段，再指定日期范围
                    </Text>
                  )}
                </div>
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
              rehypePlugins={[rehypeRaw]}
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

      {/* Clone 子目录选择弹窗 */}
      <Modal
        title="选择 Clone 目录"
        open={cloneDirModalVisible}
        onCancel={() => setCloneDirModalVisible(false)}
        onOk={handleCloneExecute}
        okText="开始 Clone"
        cancelText="取消"
        confirmLoading={cloneStarting}
        okButtonProps={{ disabled: !!cloneSubDirError }}
        destroyOnClose
      >
        <Spin spinning={cloneDirLoading}>
          <div style={{ marginBottom: 16 }}>
            <Text type="secondary">基础目录（可在系统配置中修改 clone.directory）</Text>
            <div style={{ marginTop: 8, padding: '8px 12px', background: '#f5f5f5', borderRadius: 6, wordBreak: 'break-all' }}>
              {cloneBaseDir || '-'}
            </div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <Alert
              type="info"
              showIcon
              message={
                <span>
                  当前筛选结果：<Text strong>{pageResult.total}</Text> 个项目
                  {pageResult.total > 200 && (
                    <Tag color="warning" style={{ marginLeft: 8 }}>数量较多</Tag>
                  )}
                </span>
              }
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <Text>并发克隆数</Text>
            <InputNumber
              min={1}
              max={20}
              value={cloneConcurrency}
              onChange={(val) => setCloneConcurrency(val ?? 5)}
              addonAfter="个同时克隆"
              style={{ width: '100%', marginTop: 8 }}
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <Text>克隆深度</Text>
            <Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>浅克隆仅拉取最新提交，大幅减少时间和磁盘占用</Text>
            <Select
              value={cloneDepth}
              onChange={(val) => setCloneDepth(val)}
              style={{ width: '100%', marginTop: 8 }}
              options={[
                { value: 1, label: '浅克隆 (depth=1, 推荐)' },
                { value: 3, label: '浅克隆 (depth=3)' },
                { value: 10, label: '浅克隆 (depth=10)' },
                { value: 0, label: '完整克隆 (所有历史记录)' },
              ]}
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <Text>最大仓库大小</Text>
            <Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>超过此大小的仓库将被跳过，0=不限制</Text>
            <InputNumber
              min={0}
              max={10000}
              value={cloneMaxRepoSizeMb}
              onChange={(val) => setCloneMaxRepoSizeMb(val ?? 500)}
              addonAfter="MB"
              style={{ width: '100%', marginTop: 8 }}
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <Text>子目录</Text>
            <Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>留空则直接 Clone 到基础目录</Text>
            <AutoComplete
              style={{ width: '100%', marginTop: 8 }}
              value={cloneSubDir}
              options={cloneSubDirOptions}
              placeholder="输入或从历史记录选择，如 java、frontend/react"
              onChange={handleCloneSubDirChange}
              onSelect={handleCloneSubDirChange}
              allowClear
              status={cloneSubDirError ? 'error' : undefined}
              filterOption={(input, option) =>
                (option?.value as string)?.toLowerCase().includes(input.toLowerCase()) ?? false
              }
            />
            {cloneSubDirError && <Text type="danger" style={{ fontSize: 12 }}>{cloneSubDirError}</Text>}
          </div>
          <Alert
            type={cloneSubDirError ? 'error' : 'info'}
            showIcon
            message={cloneSubDirError ? `路径无效：${cloneSubDirError}` : `目标路径：${cloneTargetPreview.path || '-'}`}
            description={cloneSubDirHistory.length > 0 ? '可从下拉列表选择历史子目录，也可输入新目录' : '首次使用可直接输入子目录，任务成功完成后会自动保存到历史记录'}
          />
        </Spin>
      </Modal>

      {/* Clone 进度弹窗 */}
      <Modal title="批量 Clone 进度" open={cloneModalVisible} onCancel={handleCloseCloneModal}
        footer={
          <Space>
            {cloneProgress?.status === 'RUNNING' && (
              <Popconfirm title="确定取消克隆任务吗？" onConfirm={handleCancelCloneTask} okText="确定" cancelText="返回">
                <Button danger>取消任务</Button>
              </Popconfirm>
            )}
            <Button type="primary" onClick={handleCloseCloneModal}>关闭</Button>
          </Space>
        }
        maskClosable={cloneProgress?.status === 'COMPLETED' || cloneProgress?.status === 'FAILED'}>
        {cloneProgress && (
          <div>
            {cloneTargetDir && (
              <div style={{ marginBottom: 12, fontSize: 13, color: '#666', wordBreak: 'break-all' }}>
                目标目录：<Text code>{cloneTargetDir}</Text>
              </div>
            )}
            {cloneProgress.status === 'FAILED' && (
              <Alert type="error" showIcon message="Clone 任务失败" description={cloneProgress.errorMessage || '未知错误'} style={{ marginBottom: 12 }} />
            )}
            <div style={{ marginBottom: 16, display: 'flex', gap: 16, justifyContent: 'center' }}>
              <span>总数: <Text strong>{cloneProgress.totalRepos}</Text></span>
              <span style={{ color: '#52c41a' }}>成功: <Text strong>{cloneProgress.completedRepos}</Text></span>
              <span style={{ color: '#faad14' }}>跳过: <Text strong>{cloneProgress.skippedRepos}</Text></span>
              <span style={{ color: '#ff4d4f' }}>失败: <Text strong>{cloneProgress.failedRepos}</Text></span>
            </div>
            {cloneProgress.status === 'RUNNING' && <Spin tip="正在 Clone..." style={{ display: 'block', textAlign: 'center' }} />}
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

      {/* 翻译管理面板 */}
      <TranslatePanel
        open={translatePanelOpen}
        onClose={() => setTranslatePanelOpen(false)}
        filters={{
          keyword: keyword || undefined,
          language: languageStr || undefined,
          categoryIds: categoryIdsStr || undefined,
          sortBy: sortBy || undefined,
          sortOrder: sortOrder || undefined,
          dateField: dateField || undefined,
          startDate: startDateStr || undefined,
          endDate: endDateStr || undefined,
        }}
        hasActiveFilters={hasActiveFilters}
        onRefreshList={() => {
          const fetchList = async () => {
            const res = await starsApi.fetchStarList({
              page: currentPage, size: pageSize,
              keyword: keyword || undefined,
              language: languageStr || undefined,
              categoryIds: categoryIdsStr || undefined,
              sortBy: sortBy || undefined,
              sortOrder: sortOrder || undefined,
              dateField: dateField || undefined,
              startDate: startDateStr || undefined,
              endDate: endDateStr || undefined,
            })
            setPageResult(res)
          }
          fetchList().catch(console.error)
        }}
      />
    </div>
  )
}
