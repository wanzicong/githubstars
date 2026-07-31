import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import { Card, Typography, Space, App, Segmented } from 'antd'
import { AppstoreOutlined, UnorderedListOutlined } from '@ant-design/icons'
import dayjs from '../../config/setupDayjs'
import * as api from '../../api'
import { fetchAllStarIds, fetchReposByIds } from '../../api/stars'
import { checkLearnRepos, quickAddLearn } from '../../api/learn'
import { StarStatsBar } from '../../components/stars'
import { StarRepoView } from '../../components/stars'
import CloneWizardModal from '../../components/clone/CloneWizardModal'
import CloneProgressModal from '../../components/clone/CloneProgressModal'
import DownloadWizardModal from '../../components/download/DownloadWizardModal'
import DownloadProgressModal from '../../components/download/DownloadProgressModal'
import type { GithubRepo, OverviewStatsDTO, LanguageStatsDTO, CategoryNode } from '../../types'
import type { CloneTaskProgress } from '../../api/clone'
import { getCloneTaskProgress, retryCloneFailed, retryCloneItem, deleteCloneTask } from '../../api/clone'
import type { DownloadTaskProgress } from '../../api/download'
import { getDownloadTaskProgress, retryDownloadFailed, retryDownloadItem, deleteDownloadTask } from '../../api/download'
import { usePolling } from '../../hooks/usePolling'
import { useStarListParams, TIME_PRESETS, DATE_FIELD_OPTIONS } from './hooks/useStarListParams'
import { useStarListInfinite } from './hooks/useStarListInfinite'
import StarFilterBar from './components/StarFilterBar'
import StarAdvancedFilter, { type StarAdvancedFilterHandle } from './components/StarAdvancedFilter'
import { findCategoryLabel } from './components/categoryTreeUtils'
import StarActionBar from './components/StarActionBar'

const { Title } = Typography

export default function StarList() {
    const { message } = App.useApp()
    const location = useLocation()

    const params = useStarListParams()
    const { keyword, languageStr, selectedLanguages, sortBy, sortOrder,
        dateField, pageSize, startDateStr, endDateStr,
        startDate, endDate, viewMode, timePreset, categoryId,
        setUrlParam, setUrlParams, clearFilters } = params

    const buildFilters = useCallback(() => ({
        keyword: keyword || undefined,
        language: languageStr || undefined,
        sortBy: sortBy || undefined,
        sortOrder: sortOrder || undefined,
        dateField: dateField || undefined,
        startDate: startDateStr || undefined,
        endDate: endDateStr || undefined,
        categoryId: categoryId ?? undefined,
    }), [keyword, languageStr, sortBy, sortOrder, dateField, startDateStr, endDateStr, categoryId])

    // 筛选条件签名：任一变化时 hook 内重置 page=1
    const filterKey = [
        keyword, languageStr, sortBy, sortOrder, dateField,
        startDateStr, endDateStr, categoryId,
    ].map(v => v ?? '').join('|')

    const list = useStarListInfinite(filterKey, buildFilters, pageSize)
    const { repos, total, loading, loadingMore, error, hasMore, loadMore, reload } = list

    // ── 更多筛选展开区 ──
    // 高级条件（自定义日期、分类）已激活时自动展开，其余情况默认收起
    const advancedActive = !!((startDateStr || endDateStr) && !timePreset) || categoryId !== null
    const [advancedOpen, setAdvancedOpen] = useState(advancedActive)
    const advancedRef = useRef<StarAdvancedFilterHandle>(null)
    const [categoryTreeNodes, setCategoryTreeNodes] = useState<CategoryNode[]>([])

    const handleCategoryTreeLoaded = useCallback((tree: CategoryNode[]) => {
        setCategoryTreeNodes(tree)
    }, [])

    const categoryLabel = useMemo(
        () => (categoryId ? findCategoryLabel(categoryTreeNodes, categoryId) : null),
        [categoryTreeNodes, categoryId],
    )

    const advancedCount = (startDateStr || endDateStr ? 1 : 0) + (categoryId ? 1 : 0)

    const toggleAdvanced = useCallback(() => setAdvancedOpen((v) => !v), [])
    const collapseAdvanced = useCallback(() => setAdvancedOpen(false), [])
    /** 主行选择"自定义…"：展开高级筛选并聚焦起始日期 */
    const handleCustomTime = useCallback(() => {
        setAdvancedOpen(true)
        setTimeout(() => advancedRef.current?.focusStartDate(), 0)
    }, [])

    // 时间筛选摘要（预设 + 自定义范围）
    const timeFilterSummary = useMemo(() => {
        if (!dateField && !timePreset) return ''
        const fieldLabel = DATE_FIELD_OPTIONS.find((item) => item.value === dateField)?.label
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
            return `${fieldLabel || 'Star 时间'} · ${presetLabel}${rangeSuffix}`
        }
        if (fieldLabel && rangeText) return `${fieldLabel} · ${rangeText}`
        if (fieldLabel) return fieldLabel
        return ''
    }, [dateField, timePreset, startDate, endDate])

    const [overview, setOverview] = useState<OverviewStatsDTO | null>(null)
    const [languageOptions, setLanguageOptions] = useState<LanguageStatsDTO[]>([])
    const [initialLoading, setInitialLoading] = useState(true)
    const [exportingMd, setExportingMd] = useState(false)
    const [exportingUrls, setExportingUrls] = useState(false)

    // ── 学习清单状态映射（repoId → learnRecordId）──
    const [learnMap, setLearnMap] = useState<Record<number, number>>({})

    // repos 变化时批量查询学习状态
    useEffect(() => {
        if (repos.length === 0) return
        let cancelled = false
        const run = async () => {
            const map = await checkLearnRepos(repos.map((r) => r.id))
            if (!cancelled) setLearnMap((prev) => ({ ...prev, ...map }))
        }
        run()
        return () => { cancelled = true }
    }, [repos])

    /** 加入学习清单 */
    const handleAddLearn = useCallback(async (repoId: number) => {
        try {
            const record = await quickAddLearn(repoId)
            setLearnMap((prev) => ({ ...prev, [repoId]: record.id }))
        } catch {
            message.error('加入学习清单失败')
        }
    }, [message])

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

    // 路由返回时刷新（从详情页返回列表）
    const prevPathnameRef = useRef(location.pathname)
    useEffect(() => {
        if (prevPathnameRef.current !== location.pathname) {
            prevPathnameRef.current = location.pathname
            reload()
        }
    }, [location.pathname, reload])

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

    /** 跨页选择时，若选中仓库不在已加载列表则拉取完整信息 */
    const resolveSelectedRepos = useCallback(async (): Promise<GithubRepo[] | null> => {
        const loadedIds = repos.map((r) => r.id)
        const missingIds = selectedRepoIds.filter((id) => !loadedIds.includes(id))
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

    const handleExportMd = useCallback(async () => {
        if (total === 0) {
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
                    categoryId,
                    maxCount: total,
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
    }, [keyword, languageStr, sortBy, sortOrder, dateField, startDateStr, endDateStr, categoryId, total, message])

    const hasActiveFilters =
        keyword.trim() !== '' ||
        languageStr !== '' ||
        dateField !== undefined ||
        !!startDateStr ||
        !!endDateStr ||
        categoryId !== null

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
                    onChange={(val) => setUrlParam('view', val === 'grid' ? null : (val as string))}
                    options={[
                        { value: 'grid', icon: <AppstoreOutlined /> },
                        { value: 'list', icon: <UnorderedListOutlined /> },
                    ]}
                />
            </div>

            <StarStatsBar overview={overview} loading={initialLoading} />

            <Card style={{ marginBottom: 20 }}>
                <Space orientation='vertical' size={0} style={{ width: '100%' }}>
                    <StarFilterBar
                        keyword={keyword}
                        selectedLanguages={selectedLanguages}
                        sortBy={sortBy}
                        sortOrder={sortOrder}
                        dateField={dateField}
                        timePreset={timePreset}
                        hasCustomRange={!!(startDateStr || endDateStr)}
                        languageOptions={languageOptions}
                        advancedCount={advancedCount}
                        advancedOpen={advancedOpen}
                        onToggleAdvanced={toggleAdvanced}
                        onParamChange={setUrlParam}
                        setUrlParams={setUrlParams}
                        onCustomTime={handleCustomTime}
                    />
                    {advancedOpen && (
                        <StarAdvancedFilter
                            ref={advancedRef}
                            dateField={dateField}
                            startDate={startDate}
                            endDate={endDate}
                            startDateStr={startDateStr}
                            endDateStr={endDateStr}
                            categoryId={categoryId}
                            setUrlParams={setUrlParams}
                            onClearFilters={clearFilters}
                            onCollapse={collapseAdvanced}
                            onCategoryTreeLoaded={handleCategoryTreeLoaded}
                        />
                    )}
                    <StarActionBar
                        keyword={keyword}
                        languageStr={languageStr}
                        timeFilterSummary={timeFilterSummary}
                        categoryLabel={categoryLabel}
                        hasActiveFilters={hasActiveFilters}
                        selectedCount={selectedRepoIds.length}
                        loadingRepos={loadingRepos}
                        exportingMd={exportingMd}
                        exportingUrls={exportingUrls}
                        onClearFilters={clearFilters}
                        onRemoveFilter={handleRemoveFilter}
                        onOpenCloneWizard={handleOpenCloneWizard}
                        onOpenDownloadWizard={handleOpenDownloadWizard}
                        onExportMd={handleExportMd}
                        onExportUrls={handleExport}
                    />
                </Space>
            </Card>

            <StarRepoView
                repos={repos}
                total={total}
                viewMode={viewMode}
                loading={loading}
                loadingMore={loadingMore}
                error={error}
                hasMore={hasMore}
                onLoadMore={loadMore}
                hasActiveFilters={hasActiveFilters}
                onClearFilters={clearFilters}
                selectedIds={selectedRepoIds}
                onSelectionChange={setSelectedRepoIds}
                onSelectAllPages={handleSelectAllPages}
                onDeselectAll={handleDeselectAll}
                loadingAllIds={loadingAllIds}
                learnMap={learnMap}
                onAddLearn={handleAddLearn}
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

        </div>
    )
}
