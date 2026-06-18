export interface GithubRepo {
    id: number
    repoName: string
    fullName: string
    description: string | null
    descriptionCn: string | null
    readmeCn: string | null
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
}

export interface ApiResponse<T = unknown> {
    success: boolean
    message?: string
    data?: T
    [key: string]: unknown
}

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

// ─── 翻译 ───
export interface TranslateResult {
    success: boolean
    descriptionCn?: string | null
    readmeCn?: string | null
    readmeFetched?: boolean
    message?: string
    translatedCount?: number
    total?: number
}

export interface TranslateTaskProgress {
    success: boolean
    taskId: number
    status: string
    totalItems: number
    completedItems: number
    failedItems: number
    pendingItems: number
    descTotal: number
    descCompleted: number
    descFailed: number
    readmeTotal: number
    readmeCompleted: number
    readmeFailed: number
    createdAt: string
    finishedAt: string | null
    progress: number
    completedDetails?: Array<{ fullName: string; type: string; note: string }>
    failedDetails?: Array<{ fullName: string; type: string; error: string }>
}

export interface TaskListResult {
    success: boolean
    tasks: Array<{
        id: number
        status: string
        totalItems: number
        completedItems: number
        failedItems: number
        createdAt: string
        finishedAt: string | null
    }>
}

