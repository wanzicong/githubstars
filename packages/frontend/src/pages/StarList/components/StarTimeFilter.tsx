import { useMemo, useCallback } from 'react'
import { Select, DatePicker, Collapse, Row, Col, Segmented, Typography, Tag, App } from 'antd'
import { CaretDownOutlined } from '@ant-design/icons'
import dayjs, { type Dayjs } from '../../../config/setupDayjs'
import { TIME_PRESETS } from '../hooks/useStarListParams'

const { Text } = Typography

const DATE_FIELD_OPTIONS = [
    { label: 'Star 时间', value: 'starred_at' },
    { label: '创建时间', value: 'repo_created_at' },
    { label: '更新时间', value: 'repo_updated_at' },
    { label: '推送时间', value: 'repo_pushed_at' },
]

export interface StarTimeFilterProps {
    dateField: string | undefined
    startDate: Dayjs | null
    endDate: Dayjs | null
    startDateStr: string | null
    endDateStr: string | null
    timePreset: string
    setUrlParams: (updates: Record<string, string | null | undefined>) => void
}

/** 时间筛选折叠面板：快捷预设 + 自定义日期范围 */
export default function StarTimeFilter({
    dateField,
    startDate,
    endDate,
    startDateStr,
    endDateStr,
    timePreset,
    setUrlParams,
}: StarTimeFilterProps) {
    const { message } = App.useApp()

    const handleTimePreset = useCallback((value: string) => {
        const normalized = value === '不限' ? '' : value
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
            message.warning('起始日期晚于结束日期，已自动调整')
            return
        }
        setUrlParams({ startDate: val ? val.format('YYYY-MM-DD') : null, timePreset: null })
    }, [endDate, setUrlParams, message])

    const handleEndDateChange = useCallback((val: Dayjs | null) => {
        if (val && startDate && val.isBefore(startDate, 'day')) {
            const formatted = val.format('YYYY-MM-DD')
            setUrlParams({ startDate: formatted, endDate: formatted, timePreset: null })
            message.warning('结束日期早于起始日期，已自动调整')
            return
        }
        setUrlParams({ endDate: val ? val.format('YYYY-MM-DD') : null, timePreset: null })
    }, [startDate, setUrlParams, message])

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

    return (
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
    )
}
