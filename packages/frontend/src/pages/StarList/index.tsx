import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import {
    Card,
    Input,
    Select,
    Button,
    Row,
    Col,
    Tag,
    Typography,
    Space,
    DatePicker,
    Collapse,
    App,
    Segmented,
    Switch,
} from 'antd'
import {
    ClearOutlined,
    DownloadOutlined,
    TranslationOutlined,
    CaretDownOutlined,
    AppstoreOutlined,
    UnorderedListOutlined,
    CopyOutlined,
} from '@ant-design/icons'
import dayjs, { type Dayjs } from '../../config/setupDayjs'
import * as api from '../../api'
import { fetchAllStarIds, fetchReposByIds } from '../../api/stars'
import { TranslatePanel } from '../../components/translate'
import { StarStatsBar } from '../../components/stars'
import { StarRepoView } from '../../components/stars'
import { TranslateProgressModal } from '../../components/translate'
import CloneWizardModal from '../../components/clone/CloneWizardModal'
import CloneProgressModal from '../../components/clone/CloneProgressModal'
import DownloadWizardModal from '../../components/download/DownloadWizardModal'
import DownloadProgressModal from '../../components/download/DownloadProgressModal'
import type { GithubRepo, OverviewStatsDTO, LanguageStatsDTO, PageResult } from '../../types'
import type { CloneTaskProgress } from '../../api/clone'
import { getCloneTaskProgress, retryCloneFailed, retryCloneItem, deleteCloneTask } from '../../api/clone'
import type { DownloadTaskProgress } from '../../api/download'
import { getDownloadTaskProgress, retryDownloadFailed, retryDownloadItem, deleteDownloadTask } from '../../api/download'
import { usePolling } from '../../hooks/usePolling'
import { useStarListParams, TIME_PRESETS } from './hooks/useStarListParams'
import { INITIAL_TASK_PROGRESS, type TaskProgress } from '../../constants'

const { Title, Text } = Typography

const SORT_BY_OPTIONS = [
    { label: 'Star 数量', value: 'stars_count' },
    { label: 'Star 时间', value: 'starred_at' },
    { label: 'Fork 数量', value: 'forks_count' },
    { label: '仓库大小', value: 'repo_size' },
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


export default function StarList() {
    const { message } = App.useApp()
    const [searchParams] = useSearchParams()
    const location = useLocation()

    const params = useStarListParams()
    const { keyword, languageStr, selectedLanguages, sortBy, sortOrder,
        dateField, currentPage, pageSize, startDateStr, endDateStr,
        startDate, endDate, untranslatedOnly, viewMode, timePreset,
        setUrlParam, setUrlParams, clearFilters } = params

    const handleTimePreset = useCallback((value: string) => {
        const normalized = value === '不' ? '' : value
        if (!normalized) { setUrlParams({ timePreset: null, dateField: null, startDate: null, endDate: null }); return }
        const preset = TIME_PRESETS.find((p) => p.value === normalized)
        if (!preset) return
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

    const handleDateFieldChange = useCallback((val: string) => {
        if (!val) { setUrlParams({ dateField: null, startDate: null, endDate: null, timePreset: null }); return }
        setUrlParams({ dateField: val, timePreset: null })
    }, [setUrlParams])

    const handleStartDateChange = useCallback((val: Dayjs | null) => {
        if (val && endDate && val.isAfter(endDate, 'day')) {
            const formatted = val.format('YYYY-MM-DD')
            setUrlParams({ startDate: formatted, endDate: formatted, timePreset: null })
            message.warning('起')
            return
        }
        setUrlParams({ startDate: val ? val.format('YYYY-MM-DD') : null, timePreset: null })
    }, [endDate, setUrlParams])

    const handleEndDateChange = useCallback((val: Dayjs | null) => {
        if (val && startDate && val.isBefore(startDate, 'day')) {
            const formatted = val.format('YYYY-MM-DD')
            setUrlParams({ startDate: formatted, endDate: formatted, timePreset: null })
            message.warning('起')
            return
        }
        setUrlParams({ endDate: val ? val.format('YYYY-MM-DD') : null, timePreset: null })
    }, [startDate, setUrlParams])

    const dateFieldLabel = DATE_FIELD_OPTIONS.find((item) => item.value === dateField)?.label
    const timeFilterSummary = useMemo(() => {
        if (!dateField && !timePreset) return ''
        const presetLabel = TIME_PRESETS.find((item) => item.value === timePreset)?.label
        let rangeText: string
        if (startDate && endDate) {
            rangeText = `${startDate.format('YYYY年M月D日')} ~ ${endDate.format('YYYY年M月D日')}`
        } else if (startDate) {
            rangeText = `${startDate.format('YYYY年M月D日')} 起`
        } else if (endDate) {
            rangeText = `至 ${endDate.format('YYYY年M月D日')}`
        } else {
            rangeText = ''
        }
        if (presetLabel && presetLabel !== '不限') {
            const rangeSuffix = rangeText ? `（${rangeText}）` : ''
            return `${dateFieldLabel || 'Star 时间'} · ${presetLabel}${rangeSuffix}`
        }
        if (dateFieldLabel && rangeText) return `${dateFieldLabel} · ${rangeText}`
        if (dateFieldLabel) return dateFieldLabel
        return ''
    }, [dateField, dateFieldLabel, timePreset, startDate, endDate])

    const dateFilterExpanded = !!(dateField || startDateStr || endDateStr || timePreset)

    const buildFilters = useCallback(() => ({
        keyword: keyword || undefined,
        language: languageStr || undefined,
        sortBy: sortBy || undefined,
        sortOrder: sortOrder || undefined,
        dateField: dateField || undefined,
        startDate: startDateStr || undefined,
        endDate: endDateStr || undefined,
        untranslatedOnly: untranslatedOnly || undefined,
    }), [keyword, languageStr, sortBy, sortOrder, dateField, startDateStr, endDateStr, untranslatedOnly])

    const [pageResult, setPageResult] = useState<PageResult<GithubRepo>>({ records: [], total: 0, size: 12, current: 1, pages: 0 })
    const [overview, setOverview] = useState<OverviewStatsDTO | null>(null)
    const [languageOptions, setLanguageOptions] = useState<LanguageStatsDTO[]>([])
    const [loading, setLoading] = useState(true)
    const [initialLoading, setInitialLoading] = useState(true)
    // ── 首次加载概览和语言统计（仅一次）──
    useEffect(() => {
        const loadMeta = async () => {
            try {
                const [overviewRes, langRes] = await Promise.allSettled([
                    api.fetchOverviewStats(),
                    api.fetchLanguageStats(),
                ])
                if (overviewRes.status === 'fulfilled') setOverview(overviewRes.value)
                if (langRes.status === 'fulfilled') setLanguageOptions(langRes.value)
            } catch {
                /* 概览加载失败不阻塞列表 */
            } finally {
                setInitialLoading(false)
            }
        }
        loadMeta()
    }, [])

    useEffect(() => {
        let cancelled = false
        const loadPage = async () => {
            setLoading(true)
            try {
                const result = await api.fetchStarList({
                    page: currentPage,
                    size: pageSize,
                    ...buildFilters(),
                })
                if (!cancelled) setPageResult(result)
            } catch {
                if (!cancelled) message.error('加载列表失败')
            } finally {
                if (!cancelled) setLoading(false)
            }
        }
        loadPage()
        return () => {
            cancelled = true
        }
    }, [
        currentPage,
        pageSize,
        keyword,
        languageStr,
        sortBy,
        sortOrder,
        dateField,
        startDateStr,
        endDateStr,
        untranslatedOnly,
        location.pathname, // 从详情页返回列表时触发刷新
    ])

    const [translatePanelOpen, setTranslatePanelOpen] = useState(false)
    const [translateModalVisible, setTranslateModalVisible] = useState(false)
    const [translateTaskId, setTranslateTaskId] = useState<number | null>(null)
    const [translateProgress, setTranslateProgress] = useState<TaskProgress | null>(null)

    // ── 克隆相关状态 ──
    const [selectedRepoIds, setSelectedRepoIds] = useState<number[]>([])
    const [selectedReposForClone, setSelectedReposForClone] = useState<GithubRepo[]>([])
    const [cloneWizardOpen, setCloneWizardOpen] = useState(false)
    const [cloneProgressOpen, setCloneProgressOpen] = useState(false)
    const [cloneTaskId, setCloneTaskId] = useState<number | null>(null)
    const [cloneProgress, setCloneProgress] = useState<CloneTaskProgress | null>(null)
    const [loadingAllIds, setLoadingAllIds] = useState(false)
    const [loadingRepos, setLoadingRepos] = useState(false)

    // ── 下载相关状态 ──
    const [downloadWizardOpen, setDownloadWizardOpen] = useState(false)
    const [downloadProgressOpen, setDownloadProgressOpen] = useState(false)
    const [downloadTaskId, setDownloadTaskId] = useState<number | null>(null)
    const [downloadProgress, setDownloadProgress] = useState<DownloadTaskProgress | null>(null)

    const translateTaskIdRef = useRef<number | null>(null)

    const polling = usePolling(async () => {
        const taskId = translateTaskIdRef.current
        if (!taskId) {
            polling.stop()
            return
        }
        try {
            const res = await api.getTaskProgress(taskId)
            if (res.success) {
                setTranslateProgress({
                    status: res.status,
                    totalItems: res.totalItems,
                    completedItems: res.completedItems,
                    failedItems: res.failedItems,
                    pendingItems: res.pendingItems,
                    descTotal: res.descTotal,
                    descCompleted: res.descCompleted,
                    descFailed: res.descFailed,
                    readmeTotal: res.readmeTotal,
                    readmeCompleted: res.readmeCompleted,
                    readmeFailed: res.readmeFailed,
                    progress: res.progress,
                })
                if (res.status === 'COMPLETED' || res.status === 'FAILED') {
                    polling.stop()
                    const result = await api.fetchStarList({
                        page: currentPage,
                        size: pageSize,
                        ...buildFilters(),
                    })
                    setPageResult(result)
                }
            }
        } catch {
            /* ignore polling errors */
        }
    }, 2000)

    const handleRetryFailed = useCallback(async () => {
        if (!translateTaskId) return
        try {
            const result = await api.retryFailed(translateTaskId)
            if (result.success && result.taskId) {
                setTranslateTaskId(result.taskId)
                setTranslateProgress({ ...INITIAL_TASK_PROGRESS })
                translateTaskIdRef.current = result.taskId
                polling.start()
            } else {
                message.info(result.message || '没有失败项')
            }
        } catch {
            message.error('重试失败')
        }
    }, [translateTaskId, polling])

    const handleCloseTranslateModal = useCallback(() => {
        polling.stop()
        setTranslateModalVisible(false)
        setTranslateTaskId(null)
        setTranslateProgress(null)
    }, [polling])

    // ── 克隆进度轮询 ──
    const cloneTaskIdRef = useRef<number | null>(null)
    const clonePolling = usePolling(async () => {
        const taskId = cloneTaskIdRef.current
        if (!taskId) { clonePolling.stop(); return }
        try {
            const res = await getCloneTaskProgress(taskId)
            if (res.success) {
                setCloneProgress(res)
                if (res.status === 'COMPLETED' || res.status === 'FAILED' || res.status === 'PARTIAL') {
                    clonePolling.stop()
                }
            }
        } catch { /* ignore */ }
    }, 2000)

    const handleCloneTaskCreated = useCallback((taskId: number) => {
        setCloneTaskId(taskId)
        setCloneProgressOpen(true)
        cloneTaskIdRef.current = taskId
        clonePolling.start()
    }, [clonePolling])

    const handleRetryCloneFailed = useCallback(async () => {
        if (!cloneTaskId) return
        try {
            const result = await retryCloneFailed(cloneTaskId)
            if (result.success) {
                setCloneProgress(null)
                cloneTaskIdRef.current = cloneTaskId
                clonePolling.start()
            } else {
                message.info(result.message || '没有失败项')
            }
        } catch { message.error('重试失败') }
    }, [cloneTaskId, clonePolling])

    const handleRetryCloneItem = useCallback(async (fullName: string) => {
        if (!cloneTaskId) return
        try {
            const result = await retryCloneItem(cloneTaskId, fullName)
            if (result.success) {
                message.success(result.message || '已重置')
                // 刷新进度
                const progress = await getCloneTaskProgress(cloneTaskId)
                setCloneProgress(progress)
            } else {
                message.info(result.message || '重试失败')
            }
        } catch { message.error('重试失败') }
    }, [cloneTaskId])

    const handleDeleteCloneTask = useCallback(async () => {
        if (!cloneTaskId) return
        try {
            const result = await deleteCloneTask(cloneTaskId)
            if (result.success) {
                message.success(result.message || '任务已删除')
                clonePolling.stop()
                setCloneProgressOpen(false)
                setCloneProgress(null)
                setCloneTaskId(null)
            } else {
                message.error(result.message || '删除失败')
            }
        } catch { message.error('删除失败') }
    }, [cloneTaskId, clonePolling])

    // ── 下载进度轮询 ──
    const downloadTaskIdRef = useRef<number | null>(null)
    const downloadPolling = usePolling(async () => {
        const taskId = downloadTaskIdRef.current
        if (!taskId) { downloadPolling.stop(); return }
        try {
            const res = await getDownloadTaskProgress(taskId)
            if (res.success) {
                setDownloadProgress(res)
                if (res.status === 'COMPLETED' || res.status === 'FAILED' || res.status === 'PARTIAL') {
                    downloadPolling.stop()
                }
            }
        } catch { /* ignore */ }
    }, 2000)

    const handleDownloadTaskCreated = useCallback((taskId: number) => {
        setDownloadTaskId(taskId)
        setDownloadProgressOpen(true)
        downloadTaskIdRef.current = taskId
        downloadPolling.start()
    }, [downloadPolling])

    const handleRetryDownloadFailed = useCallback(async () => {
        if (!downloadTaskId) return
        try {
            const result = await retryDownloadFailed(downloadTaskId)
            if (result.success) {
                setDownloadProgress(null)
                downloadTaskIdRef.current = downloadTaskId
                downloadPolling.start()
            } else {
                message.info(result.message || '没有失败项')
            }
        } catch { message.error('重试失败') }
    }, [downloadTaskId, downloadPolling])

    const handleRetryDownloadItem = useCallback(async (fullName: string) => {
        if (!downloadTaskId) return
        try {
            const result = await retryDownloadItem(downloadTaskId, fullName)
            if (result.success) {
                message.success(result.message || '已重置')
                const progress = await getDownloadTaskProgress(downloadTaskId)
                setDownloadProgress(progress)
            } else {
                message.info(result.message || '重试失败')
            }
        } catch { message.error('重试失败') }
    }, [downloadTaskId])

    const handleDeleteDownloadTask = useCallback(async () => {
        if (!downloadTaskId) return
        try {
            const result = await deleteDownloadTask(downloadTaskId)
            if (result.success) {
                message.success(result.message || '任务已删除')
                downloadPolling.stop()
                setDownloadProgressOpen(false)
                setDownloadProgress(null)
                setDownloadTaskId(null)
            } else {
                message.error(result.message || '删除失败')
            }
        } catch { message.error('删除失败') }
    }, [downloadTaskId, downloadPolling])

    // ── 跨页全选 ──
    const handleSelectAllPages = useCallback(async () => {
        setLoadingAllIds(true)
        try {
            const ids = await fetchAllStarIds(buildFilters())
            setSelectedRepoIds(ids)
            message.success(`已选择 ${ids.length} 个仓库`)
        } catch {
            message.error('获取仓库列表失败')
        } finally {
            setLoadingAllIds(false)
        }
    }, [buildFilters])

    const handleDeselectAll = useCallback(() => {
        setSelectedRepoIds([])
    }, [])

    const { records: repos } = pageResult

    // ── 打开克隆向导 ──
    const handleOpenCloneWizard = useCallback(async () => {
        // 检查选中的仓库是否都在当前页
        const currentPageIds = repos.map((r) => r.id)
        const missingIds = selectedRepoIds.filter((id) => !currentPageIds.includes(id))

        if (missingIds.length > 0) {
            // 有跨页选中的仓库，需要获取完整信息
            setLoadingRepos(true)
            try {
                const allRepos = await fetchReposByIds(selectedRepoIds)
                setSelectedReposForClone(allRepos)
            } catch {
                message.error('获取仓库信息失败')
                return
            } finally {
                setLoadingRepos(false)
            }
        } else {
            // 所有选中的仓库都在当前页
            setSelectedReposForClone(repos.filter((r) => selectedRepoIds.includes(r.id)))
        }
        setCloneWizardOpen(true)
    }, [selectedRepoIds, repos])

    // ── 打开下载向导 ──
    const handleOpenDownloadWizard = useCallback(async () => {
        const currentPageIds = repos.map((r) => r.id)
        const missingIds = selectedRepoIds.filter((id) => !currentPageIds.includes(id))

        if (missingIds.length > 0) {
            setLoadingRepos(true)
            try {
                const allRepos = await fetchReposByIds(selectedRepoIds)
                setSelectedReposForClone(allRepos)
            } catch {
                message.error('获取仓库信息失败')
                return
            } finally {
                setLoadingRepos(false)
            }
        } else {
            setSelectedReposForClone(repos.filter((r) => selectedRepoIds.includes(r.id)))
        }
        setDownloadWizardOpen(true)
    }, [selectedRepoIds, repos])

    const renderTranslateProgress = () => (
        <TranslateProgressModal
            open={translateModalVisible}
            progress={translateProgress}
            onClose={handleCloseTranslateModal}
            onRetryFailed={handleRetryFailed}
        />
    )

    // (已移除废弃的单独批量翻译入口 handleBatchTranslate)

    const handleExport = useCallback(async () => {
        try {
            const blob = await api.exportStarsUrls(buildFilters())
            const url = window.URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `stars_export_${dayjs().format('YYYYMMDD_HHmmss')}.txt`
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
            window.URL.revokeObjectURL(url)
        } catch {
            message.error('导出URL失败')
        }
    }, [keyword, languageStr, sortBy, sortOrder, dateField, startDateStr, endDateStr, untranslatedOnly, buildFilters])

    const handleExportMd = useCallback(async () => {
        try {
            const params = new URLSearchParams()
            if (keyword) params.set('keyword', keyword)
            if (languageStr) params.set('language', languageStr)
            if (sortBy) params.set('sortBy', sortBy)
            if (sortOrder) params.set('sortOrder', sortOrder)
            if (dateField) params.set('dateField', dateField)
            if (startDateStr) params.set('startDate', startDateStr)
            if (endDateStr) params.set('endDate', endDateStr)
            if (untranslatedOnly) params.set('untranslatedOnly', 'true')
            const totalCount = pageResult?.total ?? 0
            if (totalCount === 0) {
                message.warning('没有匹配的仓库可导出')
                return
            }
            params.set('maxCount', String(totalCount))
            const resp = await fetch(`/export/md?${params.toString()}`)
            if (!resp.ok) {
                const errText = await resp.text().catch(() => '')
                message.error(`导出失败: HTTP ${resp.status}${errText ? ' — ' + errText.substring(0, 200) : ''}`)
                return
            }
            const blob = await resp.blob()
            const url = window.URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `stars_export_${dayjs().format('YYYYMMDD_HHmmss')}.md`
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
            window.URL.revokeObjectURL(url)
        } catch {
            message.error('导出MD失败')
        }
    }, [keyword, languageStr, sortBy, sortOrder, dateField, startDateStr, endDateStr, untranslatedOnly, pageResult?.total])

    const languageSelectOptions = useMemo(
        () => (languageOptions || []).map((lang) => ({ label: `${lang.language} (${lang.count})`, value: lang.language })),
        [languageOptions],
    )

    const hasActiveFilters =
        keyword.trim() !== '' ||
        languageStr !== '' ||
        dateField !== undefined ||
        !!startDateStr ||
        !!endDateStr ||
        untranslatedOnly

    return (
        <div>
            <div
                style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 24,
                    flexWrap: 'wrap',
                    gap: 8,
                }}
            >
                <Title level={3} style={{ margin: 0 }}>
                    Star 仓库列表
                </Title>
                <Segmented
                    value={viewMode}
                    onChange={(val) => setUrlParam('view', val === 'grid' ? null : (val as string), false)}
                    options={[
                        { value: 'grid', icon: <AppstoreOutlined /> },
                        { value: 'list', icon: <UnorderedListOutlined /> },
                    ]}
                />
            </div>

            <StarStatsBar overview={overview} loading={initialLoading} />

            <Card style={{ marginBottom: 20 }}>
                <Space orientation='vertical' size='middle' style={{ width: '100%' }}>
                    <Row gutter={[8, 12]} align='middle' style={{ flexWrap: 'wrap' }}>
                        <Col xs={24} sm={12} md={8} lg={6}>
                            <Input.Search
                                placeholder='搜索仓库名、描述、作者...'
                                defaultValue={keyword}
                                onSearch={(val) => setUrlParam('keyword', val || null)}
                                onChange={(e) => {
                                    if (!e.target.value) setUrlParam('keyword', null)
                                }}
                                allowClear
                            />
                        </Col>
                        <Col xs={24} sm={12} md={10} lg={7}>
                            <Select
                                mode='multiple'
                                placeholder='筛选语言'
                                value={selectedLanguages}
                                onChange={(vals) => setUrlParam('languages', vals.length > 0 ? vals.join(',') : null)}
                                options={languageSelectOptions}
                                allowClear
                                showSearch
                                maxTagCount={3}
                                filterOption={(input, option) => (option?.label as string)?.toLowerCase().includes(input.toLowerCase())}
                                style={{ width: '100%' }}
                            />
                        </Col>
                        <Col xs={12} sm={8} md={6} lg={4}>
                            <Select
                                placeholder='排序字段'
                                value={sortBy}
                                onChange={(val) => setUrlParam('sortBy', val || null)}
                                options={SORT_BY_OPTIONS}
                                style={{ width: '100%' }}
                            />
                        </Col>
                        <Col xs={12} sm={8} md={6} lg={3}>
                            <Select
                                placeholder='排序方向'
                                value={sortOrder}
                                onChange={(val) => setUrlParam('sortOrder', val || null)}
                                options={SORT_ORDER_OPTIONS}
                                style={{ width: '100%' }}
                            />
                        </Col>
                    </Row>
                    {/* 激活的筛选条件摘要 */}
                    {hasActiveFilters && (
                        <Row style={{ marginTop: 4 }}>
                            <Col span={24}>
                                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                                    <Text type='secondary' style={{ fontSize: 12 }}>当前筛选：</Text>
                                    {keyword && (
                                        <Tag closable onClose={() => setUrlParam('keyword', null)} color='blue'>
                                            关键词: {keyword}
                                        </Tag>
                                    )}
                                    {languageStr && (
                                        <Tag closable onClose={() => setUrlParam('languages', null)} color='green'>
                                            语言: {languageStr}
                                        </Tag>
                                    )}
                                    {timeFilterSummary && (
                                        <Tag closable onClose={() => setUrlParams({ dateField: null, startDate: null, endDate: null, timePreset: null })} color='purple'>
                                            时间: {timeFilterSummary}
                                        </Tag>
                                    )}
                                    {untranslatedOnly && (
                                        <Tag closable onClose={() => setUrlParam('untranslatedOnly', null)} color='orange'>
                                            仅未翻译
                                        </Tag>
                                    )}
                                    <Button size='small' icon={<ClearOutlined />} onClick={clearFilters} type='link' style={{ padding: '0 4px' }}>
                                        清除全部
                                    </Button>
                                </div>
                            </Col>
                        </Row>
                    )}
                    <Row gutter={[8, 8]} style={{ marginTop: hasActiveFilters ? 4 : 8 }}>
                        <Col span={24}>
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                                {hasActiveFilters && (
                                    <Button icon={<ClearOutlined />} onClick={clearFilters}>
                                        清除
                                    </Button>
                                )}
                                <Button icon={<TranslationOutlined />} onClick={() => setTranslatePanelOpen(true)}>
                                    翻译管理
                                </Button>
                                <Button
                                    icon={<CopyOutlined />}
                                    onClick={handleOpenCloneWizard}
                                    disabled={selectedRepoIds.length === 0}
                                    loading={loadingRepos}
                                >
                                    批量克隆 {selectedRepoIds.length > 0 ? `(${selectedRepoIds.length})` : ''}
                                </Button>
                                <Button
                                    icon={<DownloadOutlined />}
                                    onClick={handleOpenDownloadWizard}
                                    disabled={selectedRepoIds.length === 0}
                                >
                                    批量下载 {selectedRepoIds.length > 0 ? `(${selectedRepoIds.length})` : ''}
                                </Button>
                                <Button icon={<DownloadOutlined />} onClick={handleExportMd}>
                                    导出MD
                                </Button>
                                <Button type='primary' icon={<DownloadOutlined />} onClick={handleExport}>
                                    导出链接
                                </Button>
                                <Switch
                                    checked={untranslatedOnly}
                                    onChange={(checked) => setUrlParam('untranslatedOnly', checked ? 'true' : null)}
                                    checkedChildren='仅未翻译'
                                    unCheckedChildren='全部'
                                />
                            </div>
                        </Col>
                    </Row>
                    <Collapse
                        ghost
                        size='small'
                        defaultActiveKey={dateFilterExpanded ? ['date-filter'] : undefined}
                        items={[
                            {
                                key: 'date-filter',
                                label: (
                                    <span style={{ fontSize: 13, color: '#666' }}>
                                        <CaretDownOutlined style={{ marginRight: 4 }} />
                                        时间筛选
                                        {timeFilterSummary && (
                                            <Tag color='blue' style={{ marginLeft: 8, fontSize: 12 }}>
                                                {timeFilterSummary}
                                            </Tag>
                                        )}
                                    </span>
                                ),
                                children: (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                        <div>
                                            <Text type='secondary' style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
                                                快捷选择
                                            </Text>
                                            <Segmented
                                                value={timePreset || '不限'}
                                                onChange={(val) => handleTimePreset(val as string)}
                                                options={TIME_PRESETS.map((p) => ({ label: p.label, value: p.value || '不限' }))}
                                                size='small'
                                            />
                                        </div>
                                        <div>
                                            <Text type='secondary' style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
                                                自定义范围
                                            </Text>
                                            <Row gutter={[12, 12]} align='middle'>
                                                <Col xs={24} sm={8} md={6} lg={5}>
                                                    <Select
                                                        placeholder='选择时间字段'
                                                        value={dateField}
                                                        onChange={handleDateFieldChange}
                                                        allowClear
                                                        options={DATE_FIELD_OPTIONS}
                                                        style={{ width: '100%' }}
                                                    />
                                                </Col>
                                                <Col xs={12} sm={8} md={6} lg={5}>
                                                    <DatePicker
                                                        placeholder='起始日期'
                                                        format='YYYY年MM月DD日'
                                                        value={startDate}
                                                        onChange={handleStartDateChange}
                                                        disabled={!dateField}
                                                        allowClear
                                                        style={{ width: '100%' }}
                                                    />
                                                </Col>
                                                <Col xs={12} sm={8} md={6} lg={5}>
                                                    <DatePicker
                                                        placeholder='结束日期'
                                                        format='YYYY年MM月DD日'
                                                        value={endDate}
                                                        onChange={handleEndDateChange}
                                                        disabled={!dateField}
                                                        allowClear
                                                        style={{ width: '100%' }}
                                                    />
                                                </Col>
                                            </Row>
                                            {!dateField && (
                                                <Text type='secondary' style={{ fontSize: 12, marginTop: 8, display: 'block' }}>
                                                    请先选择时间字段，再指定日期范围
                                                </Text>
                                            )}
                                        </div>
                                    </div>
                                ),
                            },
                        ]}
                    />
                </Space>
            </Card>

            <StarRepoView
                repos={repos}
                pageResult={pageResult}
                viewMode={viewMode}
                loading={loading}
                hasActiveFilters={hasActiveFilters}
                currentPage={currentPage}
                pageSize={pageSize}
                onClearFilters={clearFilters}
                onPageChange={(page, size) => {
                    const currentSize = parseInt(searchParams.get('size') || '36', 10)
                    if (size !== currentSize) {
                        // pageSize 变化时，同时更新 size 和 page，使用单次状态更新
                        setUrlParams({ size: String(size), page: '1' })
                    } else {
                        setUrlParam('page', String(page), false)
                    }
                }}
                selectedIds={selectedRepoIds}
                onSelectionChange={setSelectedRepoIds}
                onSelectAllPages={handleSelectAllPages}
                onDeselectAll={handleDeselectAll}
                loadingAllIds={loadingAllIds}
            />
            {renderTranslateProgress()}

            {/* 克隆向导 */}
            <CloneWizardModal
                open={cloneWizardOpen}
                onClose={() => setCloneWizardOpen(false)}
                selectedRepos={selectedReposForClone}
                onTaskCreated={handleCloneTaskCreated}
            />

            {/* 克隆进度 */}
            <CloneProgressModal
                open={cloneProgressOpen}
                progress={cloneProgress}
                onClose={() => { clonePolling.stop(); setCloneProgressOpen(false) }}
                onRetryFailed={handleRetryCloneFailed}
                onRetryItem={handleRetryCloneItem}
                onDelete={handleDeleteCloneTask}
            />

            {/* 下载向导 */}
            <DownloadWizardModal
                open={downloadWizardOpen}
                onClose={() => setDownloadWizardOpen(false)}
                selectedRepos={selectedReposForClone}
                onTaskCreated={handleDownloadTaskCreated}
            />

            {/* 下载进度 */}
            <DownloadProgressModal
                open={downloadProgressOpen}
                progress={downloadProgress}
                onClose={() => { downloadPolling.stop(); setDownloadProgressOpen(false) }}
                onRetryFailed={handleRetryDownloadFailed}
                onRetryItem={handleRetryDownloadItem}
                onDelete={handleDeleteDownloadTask}
            />

            {/* 翻译管理面板 */}
            <TranslatePanel
                open={translatePanelOpen}
                onClose={() => setTranslatePanelOpen(false)}
                filters={buildFilters()}
                hasActiveFilters={hasActiveFilters}
                onRefreshList={() => {
                    const fetchList = async () => {
                        const res = await api.fetchStarList({
                            page: currentPage,
                            size: pageSize,
                            ...buildFilters(),
                        })
                        setPageResult(res)
                    }
                    fetchList().catch(() => {})
                }}
            />
        </div>
    )
}
