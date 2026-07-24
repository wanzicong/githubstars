import { useState, useEffect, useCallback, useRef } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import { Card, Typography, Space, App, Segmented } from 'antd'
import { AppstoreOutlined, UnorderedListOutlined } from '@ant-design/icons'
import dayjs from '../../config/setupDayjs'
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
import { useStarListParams } from './hooks/useStarListParams'
import { INITIAL_TASK_PROGRESS, type TaskProgress } from '../../constants'
import StarFilterBar from './components/StarFilterBar'
import StarTimeFilter from './components/StarTimeFilter'
import StarActionBar from './components/StarActionBar'

const { Title } = Typography

export default function StarList() {
    const { message } = App.useApp()
    const [searchParams] = useSearchParams()
    const location = useLocation()

    const params = useStarListParams()
    const { keyword, languageStr, selectedLanguages, sortBy, sortOrder,
        dateField, currentPage, pageSize, startDateStr, endDateStr,
        startDate, endDate, untranslatedOnly, viewMode, timePreset,
        setUrlParam, setUrlParams, clearFilters } = params

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
    const [exportingMd, setExportingMd] = useState(false)
    const [exportingUrls, setExportingUrls] = useState(false)

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
        currentPage, pageSize, keyword, languageStr, sortBy, sortOrder,
        dateField, startDateStr, endDateStr, untranslatedOnly,
        location.pathname, // 从详情页返回列表时触发刷新
        buildFilters, message,
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

    const polling = usePolling(async ({ stop }) => {
        const taskId = translateTaskIdRef.current
        if (!taskId) {
            stop()
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
                    stop()
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
    }, [translateTaskId, polling, message])

    const handleCloseTranslateModal = useCallback(() => {
        polling.stop()
        setTranslateModalVisible(false)
        setTranslateTaskId(null)
        setTranslateProgress(null)
    }, [polling])

    // ── 克隆进度轮询 ──
    const cloneTaskIdRef = useRef<number | null>(null)
    const clonePolling = usePolling(async ({ stop }) => {
        const taskId = cloneTaskIdRef.current
        if (!taskId) { stop(); return }
        try {
            const res = await getCloneTaskProgress(taskId)
            if (res.success) {
                setCloneProgress(res)
                if (res.status === 'COMPLETED' || res.status === 'FAILED' || res.status === 'PARTIAL') {
                    stop()
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
    }, [cloneTaskId, clonePolling, message])

    const handleRetryCloneItem = useCallback(async (fullName: string) => {
        if (!cloneTaskId) return
        try {
            const result = await retryCloneItem(cloneTaskId, fullName)
            if (result.success) {
                message.success(result.message || '已重置')
                const progress = await getCloneTaskProgress(cloneTaskId)
                setCloneProgress(progress)
            } else {
                message.info(result.message || '重试失败')
            }
        } catch { message.error('重试失败') }
    }, [cloneTaskId, message])

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
    }, [cloneTaskId, clonePolling, message])

    // ── 下载进度轮询 ──
    const downloadTaskIdRef = useRef<number | null>(null)
    const downloadPolling = usePolling(async ({ stop }) => {
        const taskId = downloadTaskIdRef.current
        if (!taskId) { stop(); return }
        try {
            const res = await getDownloadTaskProgress(taskId)
            if (res.success) {
                setDownloadProgress(res)
                if (res.status === 'COMPLETED' || res.status === 'FAILED' || res.status === 'PARTIAL') {
                    stop()
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
    }, [downloadTaskId, downloadPolling, message])

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
    }, [downloadTaskId, message])

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
    }, [downloadTaskId, downloadPolling, message])

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
    }, [buildFilters, message])

    const handleDeselectAll = useCallback(() => {
        setSelectedRepoIds([])
    }, [])

    const { records: repos } = pageResult

    /** 跨页选择时，若选中仓库不在当前页则拉取完整信息 */
    const resolveSelectedRepos = useCallback(async (): Promise<GithubRepo[] | null> => {
        const currentPageIds = repos.map((r) => r.id)
        const missingIds = selectedRepoIds.filter((id) => !currentPageIds.includes(id))
        if (missingIds.length === 0) {
            return repos.filter((r) => selectedRepoIds.includes(r.id))
        }
        setLoadingRepos(true)
        try {
            return await fetchReposByIds(selectedRepoIds)
        } catch {
            message.error('获取仓库信息失败')
            return null
        } finally {
            setLoadingRepos(false)
        }
    }, [selectedRepoIds, repos, message])

    const handleOpenCloneWizard = useCallback(async () => {
        const resolved = await resolveSelectedRepos()
        if (!resolved) return
        setSelectedReposForClone(resolved)
        setCloneWizardOpen(true)
    }, [resolveSelectedRepos])

    const handleOpenDownloadWizard = useCallback(async () => {
        const resolved = await resolveSelectedRepos()
        if (!resolved) return
        setSelectedReposForClone(resolved)
        setDownloadWizardOpen(true)
    }, [resolveSelectedRepos])

    const handleExport = useCallback(async () => {
        setExportingUrls(true)
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
        } finally {
            setExportingUrls(false)
        }
    }, [buildFilters, message])

    const pageTotal = pageResult.total
    const handleExportMd = useCallback(async () => {
        if (pageTotal === 0) {
            message.warning('没有匹配的仓库可导出')
            return
        }
        setExportingMd(true)
        try {
            const resp = await fetch("/api/export/md", {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    keyword,
                    language: languageStr,
                    sortBy,
                    sortOrder,
                    dateField,
                    startDate: startDateStr,
                    endDate: endDateStr,
                    untranslatedOnly,
                    maxCount: pageTotal,
                }),
            })
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
        } finally {
            setExportingMd(false)
        }
    }, [keyword, languageStr, sortBy, sortOrder, dateField, startDateStr, endDateStr, untranslatedOnly, pageTotal, message])

    const hasActiveFilters =
        keyword.trim() !== '' ||
        languageStr !== '' ||
        dateField !== undefined ||
        !!startDateStr ||
        !!endDateStr ||
        untranslatedOnly

    const handleRemoveFilter = useCallback((key: string) => {
        if (key === 'time') {
            setUrlParams({ dateField: null, startDate: null, endDate: null, timePreset: null })
        } else {
            setUrlParam(key, null)
        }
    }, [setUrlParam, setUrlParams])

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
                    <StarFilterBar
                        keyword={keyword}
                        selectedLanguages={selectedLanguages}
                        sortBy={sortBy}
                        sortOrder={sortOrder}
                        languageOptions={languageOptions}
                        onParamChange={setUrlParam}
                    />
                    <StarActionBar
                        keyword={keyword}
                        languageStr={languageStr}
                        timeFilterSummary={''}
                        untranslatedOnly={untranslatedOnly}
                        hasActiveFilters={hasActiveFilters}
                        selectedCount={selectedRepoIds.length}
                        loadingRepos={loadingRepos}
                        exportingMd={exportingMd}
                        exportingUrls={exportingUrls}
                        onClearFilters={clearFilters}
                        onRemoveFilter={handleRemoveFilter}
                        onOpenTranslatePanel={() => setTranslatePanelOpen(true)}
                        onOpenCloneWizard={handleOpenCloneWizard}
                        onOpenDownloadWizard={handleOpenDownloadWizard}
                        onExportMd={handleExportMd}
                        onExportUrls={handleExport}
                        onToggleUntranslated={(checked) => setUrlParam('untranslatedOnly', checked ? 'true' : null)}
                    />
                    <StarTimeFilter
                        dateField={dateField}
                        startDate={startDate}
                        endDate={endDate}
                        startDateStr={startDateStr}
                        endDateStr={endDateStr}
                        timePreset={timePreset}
                        setUrlParams={setUrlParams}
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
                    const currentSize = Number.parseInt(searchParams.get('size') || '36', 10)
                    if (size !== currentSize) {
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

            <TranslateProgressModal
                open={translateModalVisible}
                progress={translateProgress}
                onClose={handleCloseTranslateModal}
                onRetryFailed={handleRetryFailed}
            />

            <CloneWizardModal
                open={cloneWizardOpen}
                onClose={() => setCloneWizardOpen(false)}
                selectedRepos={selectedReposForClone}
                onTaskCreated={handleCloneTaskCreated}
            />

            <CloneProgressModal
                open={cloneProgressOpen}
                progress={cloneProgress}
                onClose={() => { clonePolling.stop(); setCloneProgressOpen(false) }}
                onRetryFailed={handleRetryCloneFailed}
                onRetryItem={handleRetryCloneItem}
                onDelete={handleDeleteCloneTask}
            />

            <DownloadWizardModal
                open={downloadWizardOpen}
                onClose={() => setDownloadWizardOpen(false)}
                selectedRepos={selectedReposForClone}
                onTaskCreated={handleDownloadTaskCreated}
            />

            <DownloadProgressModal
                open={downloadProgressOpen}
                progress={downloadProgress}
                onClose={() => { downloadPolling.stop(); setDownloadProgressOpen(false) }}
                onRetryFailed={handleRetryDownloadFailed}
                onRetryItem={handleRetryDownloadItem}
                onDelete={handleDeleteDownloadTask}
            />

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
