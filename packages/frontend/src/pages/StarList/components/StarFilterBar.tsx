import { Input, Select, Row, Col } from 'antd'
import type { LanguageStatsDTO } from '../../../types'

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

export interface StarFilterBarProps {
    keyword: string
    selectedLanguages: string[]
    sortBy: string
    sortOrder: string
    languageOptions: LanguageStatsDTO[]
    onParamChange: (key: string, value: string | null) => void
}

/** Star 列表顶部筛选栏：关键词 + 语言 + 排序 */
export default function StarFilterBar({
    keyword,
    selectedLanguages,
    sortBy,
    sortOrder,
    languageOptions,
    onParamChange,
}: StarFilterBarProps) {
    const languageSelectOptions = (languageOptions || []).map((lang) => ({
        label: `${lang.language} (${lang.count})`,
        value: lang.language,
    }))

    return (
        <Row gutter={[8, 12]} align='middle' style={{ flexWrap: 'wrap' }}>
            <Col xs={24} sm={12} md={8} lg={6}>
                <Input.Search
                    placeholder='搜索仓库名、描述、作者...'
                    defaultValue={keyword}
                    onSearch={(val) => onParamChange('keyword', val || null)}
                    onChange={(e) => {
                        if (!e.target.value) onParamChange('keyword', null)
                    }}
                    allowClear
                />
            </Col>
            <Col xs={24} sm={12} md={10} lg={7}>
                <Select
                    mode='multiple'
                    placeholder='筛选语言'
                    value={selectedLanguages}
                    onChange={(vals) => onParamChange('languages', vals.length > 0 ? vals.join(',') : null)}
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
                    onChange={(val) => onParamChange('sortBy', val || null)}
                    options={SORT_BY_OPTIONS}
                    style={{ width: '100%' }}
                />
            </Col>
            <Col xs={12} sm={8} md={6} lg={3}>
                <Select
                    placeholder='排序方向'
                    value={sortOrder}
                    onChange={(val) => onParamChange('sortOrder', val || null)}
                    options={SORT_ORDER_OPTIONS}
                    style={{ width: '100%' }}
                />
            </Col>
        </Row>
    )
}
