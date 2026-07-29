export interface GithubRepo {
    id: number
    repoName: string
    fullName: string
    description: string | null
    descriptionCn: string | null
    readmeCn: string | null
    readmeOriginal: string | null
    readmeFetched: boolean
    language: string | null
    ownerName: string
    ownerAvatarUrl: string
    htmlUrl: string
    homepage: string | null
    starsCount: number
    forksCount: number
    watchersCount: number
    openIssuesCount: number
    topics: string | null
    licenseName: string | null
    isFork: boolean
    isArchived: boolean
    repoSize: number | null
    defaultBranch: string | null
    visibility: string | null
    repoCreatedAt: string | null
    repoUpdatedAt: string | null
    repoPushedAt: string | null
    starredAt: string | null
    /** 翻译状态 (NestJS 增强字段) */
    translationStatus?: {
        description: 'completed' | 'pending' | 'none'
        readme: 'completed' | 'pending' | 'none'
    }
}

export interface SyncLog {
    id: number
    syncType: string
    status: string
    totalCount: number
    syncedCount: number
    startedAt: string | null
    finishedAt: string | null
    errorMessage: string | null
}

export interface SyncStatus {
    syncing: boolean
    status: string
    lastSyncTime: string | null
    lastSyncCount: number
    totalRepos: number
    lastSuccessTime: string | null
    lastSuccessCount: number
}

export interface LanguageStatsDTO {
    language: string
    count: number
    percentage: number
}

export interface OverviewStatsDTO {
    totalRepos: number
    totalStars: number
    totalForks: number
    totalLanguages: number
    totalOwners: number
}

export interface OwnerStatsDTO {
    ownerName: string
    ownerAvatarUrl: string
    count: number
}

export interface AuthorDTO {
    ownerName: string
    ownerAvatarUrl: string
    repoCount: number
    totalStars: number
    topLanguage: string | null
    lastStarredAt: string | null
}

export interface AuthorListParams {
    page?: number
    size?: number
    keyword?: string
}

export interface AuthorRepoParams {
    page?: number
    size?: number
    sortBy?: string
    sortOrder?: string
}

export interface TimelineStatsDTO {
    month: string
    count: number
}

export interface PageResult<T> {
    records: T[]
    total: number
    size: number
    current: number
    pages: number
}

export interface StarListParams {
    page?: number
    size?: number
    keyword?: string
    language?: string
    sortBy?: string
    sortOrder?: string
    dateField?: string
    startDate?: string
    endDate?: string
    untranslatedOnly?: boolean
    /** 分类筛选：分类 ID，后端自动展开含后代分类 */
    categoryId?: number
}

export interface ApiResponse<T = unknown> {
    success: boolean
    message?: string
    data?: T
    [key: string]: unknown
}

// ─── GitHub Issues（前后端共享契约）───
export type {
    GithubIssue,
    GithubIssueLabel,
    GithubIssueListParams,
    GithubIssueListResult,
    GithubIssueOrder,
    GithubIssueQueryParams,
    GithubIssueSort,
    GithubIssueState,
    GithubIssueUser,
} from '@githubstars/shared'

// ─── 日志 ───
export interface LogFile {
    name: string
    size: number
    mtime: string
}

// ─── 配置 ───
export interface ConfigItem {
    id: number
    configKey: string
    configValue: string
    displayValue: string
    description: string
    sensitive: boolean
}

// ─── GitHub 搜索 ───
export interface GithubSearchRepo {
    id: number
    fullName: string
    description: string
    descriptionCn?: string | null
    language: string
    starsCount: number
    forksCount: number
    htmlUrl: string
    ownerName: string
    ownerAvatarUrl: string
    topics: string[]
    pushedAt: string
}

export interface SearchReposParams {
    keyword?: string
    language?: string
    sort?: string
    page?: number
    perPage?: number
}

export interface SearchReposResult {
    success: boolean
    total: number
    repos: GithubSearchRepo[]
    page: number
    perPage: number
}

// ─── Trending ───
export interface TrendingResult {
    success: boolean
    since: string
    total: number
    repos: GithubSearchRepo[]
    dateRange: string
}

// ─── Similar ───
export interface SimilarRepo {
    fullName: string
    description: string
    language: string
    stars: number
    forks: number
    htmlUrl: string
    pushedAt: string
    aiReason: string
    score: number
}

export interface SimilarResult {
    success: boolean
    repos: SimilarRepo[]
    count: number
}

// ─── 分类（从共享类型包导入）───
export type {
  CategoryNode,
  CategoryRepo,
  CategoryReposParams,
  CategorySortItem,
  PaginatedResponse,
} from '@githubstars/shared'

export interface CategorySaveParams {
    id?: number
    name: string
    parentId?: number | null
    sortOrder?: number
    icon?: string
    description?: string
}

// ── 学习收藏 ──

export type LearnStatus = 'WANT' | 'LEARNING' | 'DONE' | 'SHELVED'
export type LearnPriority = 'LOW' | 'MEDIUM' | 'HIGH'

export interface LearnTag {
    id: number
    name: string
    color: string | null
    usageCount?: number
    createdAt?: string
    updatedAt?: string
}

export interface LearnRepoBrief {
    id: number
    repoName: string | null
    fullName: string | null
    description: string | null
    descriptionCn: string | null
    language: string | null
    ownerName: string | null
    ownerAvatarUrl: string | null
    htmlUrl: string | null
    starsCount: number
    forksCount: number
    starredAt: string | null
}

export interface LearnRecord {
    id: number
    repoId: number
    status: LearnStatus
    priority: LearnPriority
    notes: string | null
    startedAt: string | null
    finishedAt: string | null
    createdAt: string
    updatedAt: string
    repo: LearnRepoBrief
    tags: LearnTag[]
}

export interface LearnListParams {
    page?: number
    size?: number
    status?: LearnStatus
    priority?: LearnPriority
    categoryId?: number
    tagIds?: number[]
    keyword?: string
    sortBy?: 'createdAt' | 'updatedAt' | 'priority' | 'starsCount' | 'starredAt'
    sortOrder?: 'asc' | 'desc'
}

export interface LearnListResult {
    records: LearnRecord[]
    total: number
    size: number
    current: number
    pages: number
}

export interface LearnStats {
    WANT: number
    LEARNING: number
    DONE: number
    SHELVED: number
    ALL: number
}

export interface LearnSaveParams {
    id?: number
    repoId?: number
    status?: LearnStatus
    priority?: LearnPriority
    notes?: string | null
    tagIds?: number[]
}
