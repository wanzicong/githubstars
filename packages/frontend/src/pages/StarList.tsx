import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useSearchParams, useLocation } from 'react-router-dom'
import {
    Card,
    Input,
    Select,
    Button,
    Row,
    Col,
    Tag,
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
} from '@ant-design/icons'
import dayjs from '../setupDayjs'
import * as statsApi from '../api/stats'
import * as starsApi from '../api/stars'
import * as translateApi from '../api/translate'
import RepoCard from '../components/RepoCard'
import RepoRow from '../components/RepoRow'
import TranslatePanel from '../components/TranslatePanel'
import type { GithubRepo, OverviewStatsDTO, LanguageStatsDTO, PageResult } from '../types'

const { Title, Text } = Typography

const SORT_BY_OPTIONS = [
    { label: 'Star 数量', value: 'stars_count' },
    { label: 'Star 时间', value: 'starred_at' },
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


export default function StarList() {
    const [searchParams, setSearchParams] = useSearchParams()
    const location = useLocation()

    const keyword = searchParams.get('keyword') || ''
    const languageStr = searchParams.get('languages') || ''
    const selectedLanguages = languageStr ? languageStr.split(',') : []
    const sortBy = searchParams.get('sortBy') || 'stars_count'
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

    const setUrlParam = useCallback(
        (key: string, value: string | null | undefined, resetPage = true) => {
            setSearchParams((prev) => {
                const next = new URLSearchParams(prev)
                if (value === undefined || value === null || value === '') next.delete(key)
                else next.set(key, value)
                if (resetPage && key !== 'page') next.delete('page')
                return next
            })
        },
        [setSearchParams],
    )

    const setUrlParams = useCallback(
        (updates: Record<string, string | null | undefined>) => {
            setSearchParams((prev) => {
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
        },
        [setSearchParams],
    )

    const handleTimePreset = useCallback(
        (value: string) => {
            const normalized = value === '不限' ? '' : value
            if (!normalized) {
                setUrlParams({ timePreset: null, dateField: null, startDate: null, endDate: null })
                return
            }
            const preset = TIME_PRESETS.find((p) => p.value === normalized)
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
        },
        [dateField, setUrlParams],
    )

    const handleDateFieldChange = useCallback(
        (val: string | undefined) => {
            if (!val) {
                setUrlParams({ dateField: null, startDate: null, endDate: null, timePreset: null })
                return
            }
            setUrlParams({ dateField: val, timePreset: null })
        },
        [setUrlParams],
    )

    const handleStartDateChange = useCallback(
        (val: dayjs.Dayjs | null) => {
            if (val && endDate && val.isAfter(endDate, 'day')) {
                const formatted = val.format('YYYY-MM-DD')
                setUrlParams({ startDate: formatted, endDate: formatted, timePreset: null })
                message.warning('起始日期不能晚于结束日期，已自动对齐')
                return
            }
            setUrlParams({ startDate: val ? val.format('YYYY-MM-DD') : null, timePreset: null })
        },
        [endDate, setUrlParams],
    )

    const handleEndDateChange = useCallback(
        (val: dayjs.Dayjs | null) => {
            if (val && startDate && val.isBefore(startDate, 'day')) {
                const formatted = val.format('YYYY-MM-DD')
                setUrlParams({ startDate: formatted, endDate: formatted, timePreset: null })
                message.warning('结束日期不能早于起始日期，已自动对齐')
                return
            }
            setUrlParams({ endDate: val ? val.format('YYYY-MM-DD') : null, timePreset: null })
        },
        [startDate, setUrlParams],
    )

    const dateFieldLabel = DATE_FIELD_OPTIONS.find((item) => item.value === dateField)?.label
    const timeFilterSummary = useMemo(() => {
        if (!dateField && !timePreset) return ''
        const presetLabel = TIME_PRESETS.find((item) => item.value === timePreset)?.label
        const rangeText =
            startDate && endDate
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
    const [loading, setLoading] = useState(true)
    const [initialLoading, setInitialLoading] = useState(true)
    // ── 首次加载概览和语言统计（仅一次）──
    useEffect(() => {
        const loadMeta = async () => {
            try {
                const [overviewRes, langRes] = await Promise.allSettled([
                    statsApi.fetchOverviewStats(),
                    statsApi.fetchLanguageStats(),
                ])
                if (overviewRes.status === 'fulfilled') setOverview(overviewRes.value)
                if (langRes.status === 'fulfilled') setLanguageOptions(langRes.value)
            } catch {
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
                const result = await starsApi.fetchStarList({
                    page: currentPage,
                    size: pageSize,
                    keyword: keyword || undefined,
                    language: languageStr || undefined,
                    sortBy: sortBy || undefined,
                    sortOrder: sortOrder || undefined,
                    dateField: dateField || undefined,
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

    const handleClearFilters = useCallback(() => {
        setUrlParams({
            keyword: null,
            languages: null,
            timePreset: null,
            sortBy: 'stars_count',
            sortOrder: 'desc',
            dateField: null,
            startDate: null,
            endDate: null,
            untranslatedOnly: null,
        })
    }, [setUrlParams])

    const [translatePanelOpen, setTranslatePanelOpen] = useState(false)
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
    const startPolling = useCallback(
        (taskId: number) => {
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
                        if (res.status === 'COMPLETED' || res.status === 'FAILED') {
                            stopPolling()
                            const result = await starsApi.fetchStarList({
                                page: currentPage,
                                size: pageSize,
                                keyword: keyword || undefined,
                                language: languageStr || undefined,
                                sortBy: sortBy || undefined,
                                sortOrder: sortOrder || undefined,
                                dateField: dateField || undefined,
                                startDate: startDateStr || undefined,
                                endDate: endDateStr || undefined,
                            })
                            setPageResult(result)
                        }
                    }
                } catch {}
            }, 2000)
        },
        [currentPage, pageSize, keyword, languageStr, sortBy, sortOrder, dateField, startDateStr, endDateStr, untranslatedOnly],
    )

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

    const renderTranslateProgress = () => {
        if (!translateProgress) return null
        const {
            status,
            totalItems,
            completedItems,
            failedItems,
            progress,
            descTotal,
            descCompleted,
            descFailed,
            readmeTotal,
            readmeCompleted,
            readmeFailed,
        } = translateProgress
        const isRunning = status === 'PENDING' || status === 'PROCESSING'
        const isDone = status === 'COMPLETED' || status === 'FAILED'
        return (
            <Modal
                title='翻译进度'
                open={translateModalVisible}
                onCancel={isRunning ? undefined : handleCloseTranslateModal}
                footer={
                    isDone ? (
                        <Space>
                            {failedItems > 0 && (
                                <Button icon={<ReloadOutlined />} onClick={handleRetryFailed}>
                                    重试失败 ({failedItems}项)
                                </Button>
                            )}
                            <Button type='primary' onClick={handleCloseTranslateModal}>
                                关闭
                            </Button>
                        </Space>
                    ) : null
                }
                maskClosable={!isRunning}
                closable={!isRunning}
            >
                <div style={{ textAlign: 'center', padding: '16px 0' }}>
                    <Spin spinning={isRunning} size='large'>
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
                                type='circle'
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
                        type='info'
                        showIcon
                        message={
                            <div style={{ fontSize: 13 }}>
                                <div>
                                    描述翻译：{descCompleted}/{descTotal} 完成{failedItems > 0 ? `，${descFailed} 失败` : ''}
                                </div>
                                <div>
                                    README 翻译：{readmeCompleted}/{readmeTotal} 完成{failedItems > 0 ? `，${readmeFailed} 失败` : ''}
                                </div>
                            </div>
                        }
                    />
                </div>
            </Modal>
        )
    }

    // (已移除废弃的单独批量翻译入口 handleBatchTranslate)

    const handleExport = useCallback(async () => {
        try {
            const blob = await starsApi.exportStarsUrls({
                keyword: keyword || undefined,
                language: languageStr || undefined,
                sortBy: sortBy || undefined,
                sortOrder: sortOrder || undefined,
                dateField: dateField || undefined,
                startDate: startDateStr || undefined,
                endDate: endDateStr || undefined,
                untranslatedOnly: untranslatedOnly || undefined,
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
    }, [keyword, languageStr, sortBy, sortOrder, dateField, startDateStr, endDateStr, untranslatedOnly])

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
        () => languageOptions.map((lang) => ({ label: `${lang.language} (${lang.count})`, value: lang.language })),
        [languageOptions],
    )
    const hasActiveFilters =
        keyword.trim() !== '' ||
        languageStr !== '' ||
        dateField !== undefined ||
        !!startDateStr ||
        !!endDateStr ||
        untranslatedOnly

    const { records: repos } = pageResult

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

            <Spin spinning={initialLoading}>
                <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
                    <Col xs={12} sm={6}>
                        <Card size='small'>
                            <Statistic
                                title='总仓库数'
                                value={overview?.totalRepos ?? 0}
                                prefix={<GithubOutlined style={{ color: '#1677ff' }} />}
                            />
                        </Card>
                    </Col>
                    <Col xs={12} sm={6}>
                        <Card size='small'>
                            <Statistic
                                title='总 Star 数'
                                value={overview?.totalStars ?? 0}
                                prefix={<StarFilled style={{ color: '#faad14' }} />}
                            />
                        </Card>
                    </Col>
                    <Col xs={12} sm={6}>
                        <Card size='small'>
                            <Statistic
                                title='总 Fork 数'
                                value={overview?.totalForks ?? 0}
                                prefix={<ForkOutlined style={{ color: '#52c41a' }} />}
                            />
                        </Card>
                    </Col>
                    <Col xs={12} sm={6}>
                        <Card size='small'>
                            <Statistic
                                title='语言种类'
                                value={overview?.totalLanguages ?? 0}
                                prefix={
                                    <Tag color='purple' style={{ marginRight: 0 }}>
                                        #
                                    </Tag>
                                }
                            />
                        </Card>
                    </Col>
                </Row>
            </Spin>

            <Card style={{ marginBottom: 20 }}>
                <Space direction='vertical' size='middle' style={{ width: '100%' }}>
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
                                    <Button size='small' icon={<ClearOutlined />} onClick={handleClearFilters} type='link' style={{ padding: '0 4px' }}>
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
                                    <Button icon={<ClearOutlined />} onClick={handleClearFilters}>
                                        清除
                                    </Button>
                                )}
                                <Button icon={<TranslationOutlined />} onClick={() => setTranslatePanelOpen(true)}>
                                    翻译管理
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

            <Spin spinning={loading}>
                {repos.length > 0 ? (
                    viewMode === 'list' ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {repos.map((repo) => (
                                <RepoRow key={repo.id} repo={repo} />
                            ))}
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
                        <Empty
                            description={
                                loading ? '加载中...' : pageResult.total === 0 ? '暂无仓库数据，请先同步' : '筛选无结果，请尝试调整筛选条件'
                            }
                        >
                            {hasActiveFilters && (
                                <Button type='primary' onClick={handleClearFilters}>
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
                                const currentSize = parseInt(searchParams.get('size') || '36', 10)
                                if (size !== currentSize) {
                                    // size 变化时重置到第 1 页（setUrlParam 在 key !== 'page' 时自动重置 page）
                                    setUrlParam('size', String(size), false)
                                    // 显式重置 page 为 1（避免 currentSize 恰好等于 default 导致逻辑跳进 else 分支）
                                    setUrlParam('page', '1', false)
                                } else {
                                    setUrlParam('page', String(page), false)
                                }
                            }}
                        />
                    </div>
                )}
            </Spin>
            {renderTranslateProgress()}

            {/* 翻译管理面板 */}
            <TranslatePanel
                open={translatePanelOpen}
                onClose={() => setTranslatePanelOpen(false)}
                filters={{
                    keyword: keyword || undefined,
                    language: languageStr || undefined,
                    sortBy: sortBy || undefined,
                    sortOrder: sortOrder || undefined,
                    dateField: dateField || undefined,
                    startDate: startDateStr || undefined,
                    endDate: endDateStr || undefined,
                    untranslatedOnly: untranslatedOnly || undefined,
                }}
                hasActiveFilters={hasActiveFilters}
                onRefreshList={() => {
                    const fetchList = async () => {
                        const res = await starsApi.fetchStarList({
                            page: currentPage,
                            size: pageSize,
                            keyword: keyword || undefined,
                            language: languageStr || undefined,
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
