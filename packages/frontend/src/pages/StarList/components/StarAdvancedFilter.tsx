import { useEffect, useState, useCallback, forwardRef, useImperativeHandle, useRef } from 'react'
import { Select, DatePicker, TreeSelect, Button, App } from 'antd'
import type { PickerRef } from '@rc-component/picker/es/interface'
import type { Dayjs } from '../../../config/setupDayjs'
import type { CategoryNode } from '../../../types'
import { fetchCategoryTree } from '../../../api'
import { DATE_FIELD_OPTIONS } from '../hooks/useStarListParams'
import { toTreeSelectData, type CategoryTreeOption } from './categoryTreeUtils'

export interface StarAdvancedFilterHandle {
    /** 聚焦起始日期选择框（主行选择"自定义…"时调用） */
    focusStartDate: () => void
}

export interface StarAdvancedFilterProps {
    dateField: string | undefined
    startDate: Dayjs | null
    endDate: Dayjs | null
    startDateStr: string | null
    endDateStr: string | null
    categoryId: number | null
    setUrlParams: (updates: Record<string, string | null | undefined>) => void
    onClearFilters: () => void
    onCollapse: () => void
    /** 分类树加载完成后上抛（index 用于摘要 Tag 展示分类名） */
    onCategoryTreeLoaded: (tree: CategoryNode[]) => void
}

/** 更多筛选展开区：时间字段 + 自定义日期范围 + 仓库分类 */
const StarAdvancedFilter = forwardRef<StarAdvancedFilterHandle, StarAdvancedFilterProps>(function StarAdvancedFilter({
    dateField,
    startDate,
    endDate,
    startDateStr,
    endDateStr,
    categoryId,
    setUrlParams,
    onClearFilters,
    onCollapse,
    onCategoryTreeLoaded,
}, ref) {
    const { message } = App.useApp()
    const [categoryTree, setCategoryTree] = useState<CategoryTreeOption[]>([])
    const startPickerRef = useRef<PickerRef>(null)

    useImperativeHandle(ref, () => ({
        focusStartDate: () => startPickerRef.current?.focus(),
    }), [])

    // 加载分类树（仅挂载时一次，分类变化频率低）
    useEffect(() => {
        let cancelled = false
        const load = async () => {
            try {
                const tree = await fetchCategoryTree()
                if (cancelled) return
                setCategoryTree(toTreeSelectData(tree))
                onCategoryTreeLoaded(tree)
            } catch {
                /* 分类加载失败不阻塞其他筛选 */
            }
        }
        load()
        return () => { cancelled = true }
    }, [onCategoryTreeLoaded])

    const handleDateFieldChange = useCallback((val: string | undefined) => {
        if (!val) { setUrlParams({ dateField: null, startDate: null, endDate: null, timePreset: null }); return }
        setUrlParams({ dateField: val, timePreset: null })
    }, [setUrlParams])

    // 选了日期但没选字段时自动落到 starred_at，避免"先选字段"的交互卡点
    const withEffectiveField = useCallback((updates: Record<string, string | null | undefined>) => {
        setUrlParams(dateField ? updates : { ...updates, dateField: 'starred_at' })
    }, [dateField, setUrlParams])

    const handleStartDateChange = useCallback((val: Dayjs | null) => {
        if (val && endDate && val.isAfter(endDate, 'day')) {
            const formatted = val.format('YYYY-MM-DD')
            withEffectiveField({ startDate: formatted, endDate: formatted, timePreset: null })
            message.warning('起始日期晚于结束日期，已自动调整')
            return
        }
        withEffectiveField({ startDate: val ? val.format('YYYY-MM-DD') : null, timePreset: null })
    }, [endDate, withEffectiveField, message])

    const handleEndDateChange = useCallback((val: Dayjs | null) => {
        if (val && startDate && val.isBefore(startDate, 'day')) {
            const formatted = val.format('YYYY-MM-DD')
            withEffectiveField({ startDate: formatted, endDate: formatted, timePreset: null })
            message.warning('结束日期早于起始日期，已自动调整')
            return
        }
        withEffectiveField({ endDate: val ? val.format('YYYY-MM-DD') : null, timePreset: null })
    }, [startDate, withEffectiveField, message])

    const hasAnyAdvanced = !!(startDateStr || endDateStr || categoryId)

    const labelStyle = { width: 60, flex: 'none' as const, color: 'rgba(0,0,0,0.45)', fontSize: 13 }

    return (
        <div style={{ marginTop: 12, borderTop: '1px dashed #e8e8e8', paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={labelStyle}>时间字段</span>
                <Select
                    placeholder='选择时间字段'
                    value={dateField}
                    onChange={handleDateFieldChange}
                    allowClear
                    options={DATE_FIELD_OPTIONS}
                    style={{ width: 170 }}
                />
                <span style={{ ...labelStyle, width: 'auto' }}>自定义</span>
                <DatePicker
                    ref={startPickerRef as React.Ref<never>}
                    placeholder='起始日期'
                    format='YYYY年MM月DD日'
                    value={startDate}
                    onChange={handleStartDateChange}
                    allowClear
                    style={{ width: 170 }}
                />
                <span style={{ color: 'rgba(0,0,0,0.45)' }}>~</span>
                <DatePicker
                    placeholder='结束日期'
                    format='YYYY年MM月DD日'
                    value={endDate}
                    onChange={handleEndDateChange}
                    allowClear
                    style={{ width: 170 }}
                />
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={labelStyle}>仓库分类</span>
                <TreeSelect
                    placeholder='筛选分类（含子分类）'
                    value={categoryId ?? undefined}
                    onChange={(val) => setUrlParams({ categoryId: val ? String(val) : null })}
                    treeData={categoryTree}
                    allowClear
                    showSearch
                    treeDefaultExpandAll={false}
                    treeNodeFilterProp='title'
                    style={{ width: 220 }}
                />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                {hasAnyAdvanced && <Button onClick={onClearFilters}>重 置</Button>}
                <Button onClick={onCollapse}>收 起 ▲</Button>
            </div>
        </div>
    )
})

export default StarAdvancedFilter
