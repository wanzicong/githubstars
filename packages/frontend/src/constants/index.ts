/**
 * 共享常量 — 避免各页面重复定义
 */

/** GitHub 语言选项（搜索/趋势页共享） */
export const LANGUAGE_OPTIONS = [
    { value: '', label: '全部语言' },
    { value: 'JavaScript', label: 'JavaScript' },
    { value: 'TypeScript', label: 'TypeScript' },
    { value: 'Python', label: 'Python' },
    { value: 'Java', label: 'Java' },
    { value: 'Go', label: 'Go' },
    { value: 'Rust', label: 'Rust' },
    { value: 'C++', label: 'C++' },
    { value: 'C', label: 'C' },
    { value: 'C#', label: 'C#' },
    { value: 'Ruby', label: 'Ruby' },
    { value: 'PHP', label: 'PHP' },
    { value: 'Swift', label: 'Swift' },
    { value: 'Kotlin', label: 'Kotlin' },
    { value: 'Vue', label: 'Vue' },
    { value: 'Shell', label: 'Shell' },
    { value: 'Dockerfile', label: 'Dockerfile' },
]

// ─── 分页 ───

/** StarList 默认每页条数 */
export const DEFAULT_PAGE_SIZE = 36
export const PAGE_SIZE_OPTIONS_SMALL = [36, 72, 144]

/** AuthorList 默认每页条数 */
export const AUTHOR_PAGE_SIZE = 24
export const PAGE_SIZE_OPTIONS_MEDIUM = [12, 24, 48, 96]

/** AuthorDetail 每页条数 */
export const AUTHOR_DETAIL_PAGE_SIZE = 12

// ─── 轮询 ───

/** 默认轮询间隔（毫秒） */
export const POLLING_INTERVAL_MS = 2000

// ─── 仓库活跃度 ───

/** 仓库未更新天数阈值：warning=橙色, danger=红色 */
export const STALE_THRESHOLD_WARNING_DAYS = 30
export const STALE_THRESHOLD_DANGER_DAYS = 180

// ─── 克隆 ───

/** 克隆并发数选项 */
export const CLONE_CONCURRENCY_OPTIONS = [
    { value: 5, label: '5 个并发' },
    { value: 10, label: '10 个并发' },
    { value: 20, label: '20 个并发' },
    { value: 50, label: '50 个并发' },
    { value: 80, label: '80 个并发' },
]

/** 默认克隆并发数 */
export const DEFAULT_CLONE_CONCURRENCY = 5

// ─── 下载 ───

/** 下载并发数选项 */
export const DOWNLOAD_CONCURRENCY_OPTIONS = [
    { value: 3, label: '3 个并发' },
    { value: 5, label: '5 个并发' },
    { value: 10, label: '10 个并发' },
    { value: 20, label: '20 个并发' },
    { value: 50, label: '50 个并发' },
]

/** 默认下载并发数 */
export const DEFAULT_DOWNLOAD_CONCURRENCY = 5

// ─── 趋势排名 ───

/** Trending 排行榜前 3 名徽章颜色 */
export const RANK_BADGE_COLORS = ['#ff4d4f', '#ff7a45', '#ffa940']

// ─── 图表 ───

/** 图表调色板 */
export const CHART_COLORS = [
    '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF',
    '#FF9F40', '#C9CBCF', '#7BC8A4', '#E8A87C', '#6C8EBF',
    '#B85450', '#F4B400', '#4285F4', '#0F9D58', '#AB47BC',
    '#26A69A', '#EC407A', '#5C6BC0', '#8D6E63', '#29B6F6',
    '#66BB6A', '#EF5350',
]

// ─── 分类管理 ───

/** 分类仓库默认每页条数 */
export const CATEGORY_REPO_PAGE_SIZE = 20

/** 分类仓库每页条数选项 */
export const CATEGORY_REPO_PAGE_SIZE_OPTIONS = ['10', '20', '50', '100']

/** 分类树最大层级 */
export const CATEGORY_MAX_DEPTH = 2

/** 分类名称最大长度 */
export const CATEGORY_NAME_MAX_LENGTH = 50
