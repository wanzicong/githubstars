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

// ===================== 同步状态 =====================

/** 同步操作状态 */
export type SyncStatus = 'idle' | 'running' | 'completed' | 'failed';

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

/** 分类树节点 */
export interface CategoryNode {
  id: number;
  name: string;
  parentId: number | null;
  children: CategoryNode[];
  repoCount?: number;
}

// ===================== 统计 =====================

/** 语言统计项 */
export interface LanguageStat {
  language: string;
  count: number;
  percentage: number;
}

// ===================== 翻译状态 =====================

/** 翻译任务状态 */
export type TranslationTaskStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'PARTIAL';

/** 单仓库翻译状态 */
export interface TranslationStatus {
  descriptionTranslated: boolean;
  readmeFetched: boolean;
  readmeTranslated: boolean;
  descriptionCn: string | null;
  readmeCn: string | null;
}
