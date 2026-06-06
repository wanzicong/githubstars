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
  categoryNames: string[]
}

export interface Category {
  id: number
  name: string
  description: string | null
  sortOrder: number
  repoCount: number
  createdAt: string
  updatedAt: string
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
  categoryIds?: string
  sortBy?: string
  sortOrder?: string
  dateField?: string
  startMonth?: string
  endMonth?: string
}

export interface ApiResponse<T = unknown> {
  success: boolean
  message?: string
  data?: T
  [key: string]: unknown
}
