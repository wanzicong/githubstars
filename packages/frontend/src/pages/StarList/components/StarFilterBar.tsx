import { useCallback, useMemo } from 'react'
import { Input, Select, Button, Badge, Tooltip } from 'antd'
import { FilterOutlined, ClockCircleOutlined, SwapOutlined } from '@ant-design/icons'
import dayjs from '../../../config/setupDayjs'
import type { LanguageStatsDTO } from '../../../types'
import { TIME_PRESETS, SORT_COMBO_OPTIONS, sortComboFromParams, parseSortCombo } from '../hooks/useStarListParams'

const CUSTOM_VALUE = '__custom__'

export interface StarFilterBarProps {
    keyword: string
    selectedLanguages: string[]
    sortBy: string
    sortOrder: string
    dateField: string | undefined
    timePreset: string
    /** 是否有自定义日期范围（有则时间 Select 显示"自定义"） */
    hasCustomRange: boolean
    languageOptions: LanguageStatsDTO[]
    advancedCount: number
    advancedOpen: boolean
    onToggleAdvanced: () => void
    onParamChange: (key: string, value: string | null) => void
    setUrlParams: (updates: Record<string, string | null | undefined>) => void
    /** 选择"自定义…"时：展开更多筛选并聚焦起始日期 */
    onCustomTime: () => void
}

/** Star 列表主筛选行：搜索 + 时间预设 + 语言 + 排序（合并） + 更多筛选 */
export default function StarFilterBar({
    keyword,
    selectedLanguages,
    sortBy,
    sortOrder,
    dateField,
    timePreset,
    hasCustomRange,
    languageOptions,
    advancedCount,
    advancedOpen,
    onToggleAdvanced,
    onParamChange,
    setUrlParams,
    onCustomTime,
}: StarFilterBarProps) {
    // ── 时间预设：选中即写入 dateField + 起止日期；自定义交给高级筛选 ──
    const handleTimePreset = useCallback((value: string) => {
        if (value === CUSTOM_VALUE) { onCustomTime(); return }
        if (!value) {
            setUrlParams({ timePreset: null, dateField: null, startDate: null, endDate: null })
            return
        }
        const preset = TIME_PRESETS.find((p) => p.value === value)
        if (!preset) return
        const effectiveField = dateField || 'starred_at'
        if (preset.value === 'today') {
            const today = dayjs().format('YYYY-MM-DD')
            setUrlParams({ timePreset: value, dateField: effectiveField, startDate: today, endDate: today })
            return
        }
        if (preset.days > 0) {
            const start = dayjs().subtract(preset.days, 'day').format('YYYY-MM-DD')
            const end = dayjs().format('YYYY-MM-DD')
            setUrlParams({ timePreset: value, dateField: effectiveField, startDate: start, endDate: end })
        }
    }, [dateField, setUrlParams, onCustomTime])

    const timeOptions = useMemo(() => {
        const presets = TIME_PRESETS.map((p) => ({ label: p.label, value: p.value || '__none__' }))
        return [...presets, { label: '自定义…', value: CUSTOM_VALUE }]
    }, [])

    // Select 不接受空串 value，'不限' 用 __none__ 占位后再归一化
    const timeSelectValue = hasCustomRange && !timePreset ? CUSTOM_VALUE : (timePreset || '__none__')

    const handleTimeChange = useCallback((val: string) => {
        handleTimePreset(val === '__none__' ? '' : val)
    }, [handleTimePreset])

    const languageSelectOptions = useMemo(() => (languageOptions || []).map((lang) => ({
        label: `${lang.language} (${lang.count})`,
        value: lang.language,
    })), [languageOptions])

    const handleSortChange = useCallback((combo: string) => {
        const { sortBy: nextSortBy, sortOrder: nextSortOrder } = parseSortCombo(combo)
        setUrlParams({ sortBy: nextSortBy, sortOrder: nextSortOrder })
    }, [setUrlParams])

    return (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <Input.Search
                placeholder='搜索仓库名、描述、作者…'
                defaultValue={keyword}
                onSearch={(val) => onParamChange('keyword', val || null)}
                onChange={(e) => {
                    if (!e.target.value) onParamChange('keyword', null)
                }}
                allowClear
                style={{ flex: '1 1 220px', minWidth: 220 }}
            />
            <Select
                value={timeSelectValue}
                onChange={handleTimeChange}
                options={timeOptions}
                prefix={<ClockCircleOutlined style={{ color: 'rgba(0,0,0,0.45)' }} />}
                style={{ flex: '0 0 130px' }}
            />
            <Select
                mode='multiple'
                placeholder='语言'
                value={selectedLanguages}
                onChange={(vals) => onParamChange('languages', vals.length > 0 ? vals.join(',') : null)}
                options={languageSelectOptions}
                allowClear
                showSearch
                maxTagCount={1}
                filterOption={(input, option) => (option?.label as string)?.toLowerCase().includes(input.toLowerCase())}
                style={{ flex: '0 0 160px' }}
            />
            <Tooltip title='排序方式'>
                <Select
                    value={sortComboFromParams(sortBy, sortOrder)}
                    onChange={handleSortChange}
                    options={SORT_COMBO_OPTIONS}
                    prefix={<SwapOutlined style={{ color: 'rgba(0,0,0,0.45)' }} />}
                    style={{ flex: '0 0 150px' }}
                />
            </Tooltip>
            <Badge count={advancedCount} size='small' offset={[-4, 2]}>
                <Button icon={<FilterOutlined />} onClick={onToggleAdvanced}>
                    更多筛选{advancedOpen ? ' ▲' : ''}
                </Button>
            </Badge>
        </div>
    )
}
