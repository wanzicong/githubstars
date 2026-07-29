/**
 * 共享类型定义 — 前后端 API 交互的公共类型契约。
 *
 * @callers
 *   - @githubstars/backend — 确保 API 返回值符合类型
 *   - @githubstars/frontend — 确保 API 调用类型安全
 *
 * @depends 无
 */

// ===================== API 通用响应 =====================

/** 分页请求参数 */
export interface PaginationParams {
    page?: number;
    size?: number;
}

/** 分页响应（与后端 findPage 返回格式一致） */
export interface PaginatedResponse<T> {
    records: T[];
    total: number;
    size: number;
    current: number;
    pages: number;
}

/** API 统一响应包装（与后端 ResponseInterceptor 一致） */
export interface ApiResponse<T = unknown> {
    success: boolean;
    data?: T;
    message?: string;
    meta?: Record<string, unknown>;
}

// ===================== 星标仓库 =====================

/** GitHub 仓库基本信息（前后端共用字段） */
export interface GitHubRepoBase {
    id: number;
    fullName: string;
    description: string | null;
    language: string | null;
    stargazersCount: number;
    forksCount: number;
    htmlUrl: string;
    homepage: string | null;
    topics: string[];
    license: string | null;
    createdAt: string;
    updatedAt: string;
    pushedAt: string;
}

// ===================== GitHub Issues =====================

/** Issues 列表状态筛选 */
export type GithubIssueState = "open" | "closed" | "all";

/** Issues 排序字段 */
export type GithubIssueSort = "created" | "updated" | "comments";

/** Issues 排序方向 */
export type GithubIssueOrder = "asc" | "desc";

/** Issue 标签 */
export interface GithubIssueLabel {
    name: string;
    color: string;
    description: string | null;
}

/** Issue 用户摘要 */
export interface GithubIssueUser {
    login: string;
    avatarUrl: string;
    htmlUrl: string;
}

/** GitHub Reactions 汇总 */
export interface GithubIssueReactions {
    totalCount: number;
    plusOne: number;
    minusOne: number;
    laugh: number;
    hooray: number;
    confused: number;
    heart: number;
    rocket: number;
    eyes: number;
}

/** GitHub Issue 列表项 */
export interface GithubIssue {
    id: number;
    number: number;
    state: Exclude<GithubIssueState, "all">;
    stateReason: string | null;
    title: string;
    htmlUrl: string;
    user: GithubIssueUser | null;
    labels: GithubIssueLabel[];
    assignees: GithubIssueUser[];
    comments: number;
    locked: boolean;
    milestoneTitle: string | null;
    createdAt: string;
    updatedAt: string;
    closedAt: string | null;
}

/** Issue 评论 */
export interface GithubIssueComment {
    id: number;
    body: string;
    htmlUrl: string;
    user: GithubIssueUser | null;
    authorAssociation: string;
    reactions: GithubIssueReactions;
    createdAt: string;
    updatedAt: string;
}

/** GitHub Issue 详情（含正文和首批评论） */
export interface GithubIssueDetail extends GithubIssue {
    body: string;
    authorAssociation: string;
    activeLockReason: string | null;
    reactions: GithubIssueReactions;
    commentItems: GithubIssueComment[];
    commentsTruncated: boolean;
}

/** 后端 GitHub Issues 查询参数 */
export interface GithubIssueQueryParams {
    state?: GithubIssueState;
    query?: string;
    sort?: GithubIssueSort;
    order?: GithubIssueOrder;
    page?: number;
    perPage?: number;
}

/** 前端仓库 Issues 查询参数 */
export interface GithubIssueListParams extends GithubIssueQueryParams {
    repoId: number;
}

/** 前端 Issue 详情查询参数 */
export interface GithubIssueDetailParams {
    repoId: number;
    issueNumber: number;
}

/** GitHub Issues 分页结果 */
export interface GithubIssueListResult {
    items: GithubIssue[];
    totalCount: number;
    incompleteResults: boolean;
    page: number;
    perPage: number;
}

// ===================== 同步状态 =====================

/** 同步操作状态 */
export type SyncStatus = "idle" | "running" | "completed" | "failed";

/** 同步日志概要 */
export interface SyncLogBrief {
    id: number;
    status: SyncStatus;
    startedAt: string;
    finishedAt: string | null;
    addedCount: number;
    updatedCount: number;
    deletedCount: number;
}

// ===================== 分类 =====================

/** 分类树节点（后端返回的完整分类信息） */
export interface CategoryNode {
    id: number;
    name: string;
    parentId: number | null;
    sortOrder: number;
    icon: string | null;
    description: string | null;
    repoCount: number;
    createdAt: string;
    updatedAt: string;
    children: CategoryNode[];
}

/** 分类下的仓库信息（简化版，用于分类仓库列表） */
export interface CategoryRepo {
    id: number;
    repoName: string;
    fullName: string;
    description: string | null;
    language: string | null;
    ownerName: string;
    ownerAvatarUrl: string;
    htmlUrl: string;
    starsCount: number;
    forksCount: number;
    isFork: boolean;
    isArchived: boolean;
    starredAt: string | null;
    repoUpdatedAt: string | null;
}

/** 分类仓库列表查询参数 */
export interface CategoryReposParams {
    categoryId: number;
    page?: number;
    size?: number;
    keyword?: string;
    language?: string;
    sortBy?: string;
    sortOrder?: string;
}

/** 分类排序项 */
export interface CategorySortItem {
    id: number;
    sortOrder: number;
}

// ===================== 统计 =====================

/** 语言统计项 */
export interface LanguageStat {
    language: string;
    count: number;
    percentage: number;
}
