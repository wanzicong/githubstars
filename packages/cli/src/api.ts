/**
 * GitHub Stars API 客户端
 */

import { getConfig } from './config.js';

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  taskId?: number;
}

export interface PaginatedResult<T> {
  records: T[];
  total: number;
  size: number;
  current: number;
  pages: number;
}

export interface GithubRepo {
  id: number;
  repoName: string | null;
  fullName: string | null;
  description: string | null;
  descriptionCn: string | null;
  language: string | null;
  ownerName: string | null;
  starsCount: number;
  forksCount: number;
  htmlUrl: string | null;
  translationStatus?: {
    description: string;
    readme: string;
  };
}

export interface SyncStatus {
  syncing: boolean;
  status: string;
  lastSyncTime: string | null;
  lastSyncCount: number;
  totalRepos: number;
  lastSuccessTime: string | null;
  lastSuccessCount: number;
}

export interface SyncLog {
  id: number;
  syncType: string | null;
  status: string | null;
  totalCount: number | null;
  syncedCount: number | null;
  startedAt: string | null;
  finishedAt: string | null;
  errorMessage: string | null;
  createdAt: string | null;
}

export interface CloneTask {
  taskId: number;
  status: string;
  targetDir: string;
  concurrency: number;
  mirrorSource: string;
  totalItems: number;
  completedItems: number;
  failedItems: number;
  createdAt: string | null;
  startedAt: string | null;
  finishedAt: string | null;
}

export interface DownloadTask {
  taskId: number;
  status: string;
  targetDir: string;
  concurrency: number;
  totalItems: number;
  completedItems: number;
  failedItems: number;
  totalBytes: number;
  downloadedBytes: number;
  createdAt: string | null;
  startedAt: string | null;
  finishedAt: string | null;
}

export interface OverviewStats {
  totalRepos: number;
  totalStars: number;
  totalForks: number;
  languages: number;
  owners: number;
}

export interface LanguageStats {
  language: string;
  count: number;
}

export interface Category {
  id: number;
  name: string;
  parentId: number | null;
  sortOrder: number;
  icon: string | null;
  description: string | null;
  children?: Category[];
}

class ApiClient {
  private baseUrl: string = '';

  constructor() {
    this.loadBaseUrl();
  }

  private loadBaseUrl() {
    const config = getConfig();
    this.baseUrl = config.baseUrl || 'http://localhost:10002';
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    options?: { timeout?: number }
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const timeout = options?.timeout || 30000;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new Error(`HTTP ${response.status}: ${errorText || response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`请求超时 (${timeout / 1000}s)`);
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  // ==================== 同步相关 ====================

  async getSyncStatus(): Promise<SyncStatus> {
    return this.request<SyncStatus>('GET', '/api/sync/status');
  }

  async startSync(): Promise<ApiResponse> {
    return this.request<ApiResponse>('POST', '/api/sync/manual');
  }

  async getSyncLogs(page = 1, size = 10): Promise<PaginatedResult<SyncLog>> {
    return this.request<PaginatedResult<SyncLog>>('GET', `/api/sync/logs?page=${page}&size=${size}`);
  }

  // ==================== Star 列表 ====================

  async getStarList(params: {
    page?: number;
    size?: number;
    keyword?: string;
    language?: string;
    sortBy?: string;
    sortOrder?: string;
    dateField?: string;
    startDate?: string;
    endDate?: string;
    untranslatedOnly?: boolean;
  }): Promise<PaginatedResult<GithubRepo>> {
    return this.request<PaginatedResult<GithubRepo>>('POST', '/api/stars/list', params);
  }

  async getStarDetail(id: number): Promise<GithubRepo> {
    return this.request<GithubRepo>('GET', `/api/stars/${id}`);
  }

  async exportStarUrls(params: {
    keyword?: string;
    language?: string;
    sortBy?: string;
    sortOrder?: string;
  }): Promise<string> {
    const response = await fetch(`${this.baseUrl}/api/stars/export`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    return response.text();
  }

  // ==================== 克隆相关 ====================

  async createCloneTask(params: {
    repoIds: number[];
    targetDir: string;
    concurrency?: number;
    shallow?: boolean;
    mirrorSource?: string;
  }): Promise<ApiResponse> {
    return this.request<ApiResponse>('POST', '/api/clone', params, { timeout: 60000 });
  }

  async getCloneTaskProgress(taskId: number): Promise<CloneTask & { failedDetails?: Array<{ fullName: string; error: string }> }> {
    return this.request('GET', `/api/clone/${taskId}/progress`);
  }

  async getCloneTaskList(): Promise<{ tasks: CloneTask[] }> {
    return this.request('GET', '/api/clone');
  }

  async retryCloneFailed(taskId: number): Promise<ApiResponse> {
    return this.request<ApiResponse>('POST', `/api/clone/${taskId}/retry`);
  }

  async retryCloneItem(taskId: number, fullName: string): Promise<ApiResponse> {
    return this.request<ApiResponse>('POST', `/api/clone/${taskId}/retry-item`, { fullName });
  }

  async deleteCloneTask(taskId: number): Promise<ApiResponse> {
    return this.request<ApiResponse>('DELETE', `/api/clone/${taskId}`);
  }

  async resetCloneTask(taskId: number): Promise<ApiResponse> {
    return this.request<ApiResponse>('POST', `/api/clone/${taskId}/reset`);
  }

  async getRecentCloneDirectories(): Promise<{ directories: string[] }> {
    return this.request('GET', '/api/clone/directories');
  }

  // ==================== 下载相关 ====================

  async createDownloadTask(params: {
    repoIds: number[];
    targetDir: string;
    concurrency?: number;
    mirrorSource?: string;
    extractArchive?: boolean;
    deleteArchiveAfterExtract?: boolean;
  }): Promise<ApiResponse> {
    return this.request<ApiResponse>('POST', '/api/download', params, { timeout: 60000 });
  }

  async getDownloadTaskProgress(taskId: number): Promise<DownloadTask> {
    return this.request<DownloadTask>('GET', `/api/download/${taskId}/progress`);
  }

  async getDownloadTaskList(): Promise<{ tasks: DownloadTask[] }> {
    return this.request('GET', '/api/download');
  }

  async retryDownloadFailed(taskId: number): Promise<ApiResponse> {
    return this.request<ApiResponse>('POST', `/api/download/${taskId}/retry`);
  }

  async retryDownloadItem(taskId: number, fullName: string): Promise<ApiResponse> {
    return this.request<ApiResponse>('POST', `/api/download/${taskId}/retry-item`, { fullName });
  }

  async deleteDownloadTask(taskId: number): Promise<ApiResponse> {
    return this.request<ApiResponse>('DELETE', `/api/download/${taskId}`);
  }

  // ==================== 统计相关 ====================

  async getOverviewStats(): Promise<OverviewStats> {
    return this.request<OverviewStats>('GET', '/api/stats/overview');
  }

  async getLanguageStats(): Promise<LanguageStats[]> {
    return this.request<LanguageStats[]>('GET', '/api/stats/languages');
  }

  async getOwnerStats(limit = 20): Promise<Array<{ ownerName: string; count: number }>> {
    return this.request('GET', `/api/stats/owners?limit=${limit}`);
  }

  async getTimelineStats(dateField = 'starred_at'): Promise<Array<{ date: string; count: number }>> {
    return this.request('GET', `/api/stats/timeline?dateField=${dateField}`);
  }

  // ==================== 分类相关 ====================

  async getCategoryTree(): Promise<Category[]> {
    return this.request<Category[]>('GET', '/api/categories/tree');
  }

  async createCategory(params: {
    name: string;
    parentId?: number;
    icon?: string;
    description?: string;
  }): Promise<ApiResponse> {
    return this.request<ApiResponse>('POST', '/api/categories', params);
  }

  async updateCategory(id: number, params: {
    name?: string;
    parentId?: number;
    icon?: string;
    description?: string;
    sortOrder?: number;
  }): Promise<ApiResponse> {
    return this.request<ApiResponse>('PUT', `/api/categories/${id}`, params);
  }

  async deleteCategory(id: number): Promise<ApiResponse> {
    return this.request<ApiResponse>('DELETE', `/api/categories/${id}`);
  }

  async addRepoToCategory(categoryId: number, repoIds: number[]): Promise<ApiResponse> {
    return this.request<ApiResponse>('POST', `/api/categories/${categoryId}/repos`, { repoIds });
  }

  async removeRepoFromCategory(categoryId: number, repoIds: number[]): Promise<ApiResponse> {
    return this.request<ApiResponse>('DELETE', `/api/categories/${categoryId}/repos`, { repoIds });
  }

  // ==================== 配置相关 ====================

  async getConfig(key: string): Promise<{ key: string; value: string | null }> {
    return this.request('GET', `/api/config/${key}`);
  }

  async setConfig(key: string, value: string): Promise<ApiResponse> {
    return this.request<ApiResponse>('PUT', `/api/config/${key}`, { value });
  }

  async getAllConfigs(): Promise<Array<{ key: string; value: string | null; description: string | null }>> {
    return this.request('GET', '/api/config');
  }

  // ==================== 批量获取 ====================

  async getStarByIds(ids: number[]): Promise<GithubRepo[]> {
    return this.request<GithubRepo[]>('POST', '/api/stars/by-ids', { ids });
  }

  async getStarIds(params?: {
    keyword?: string;
    language?: string;
    sortBy?: string;
    sortOrder?: string;
  }): Promise<number[]> {
    return this.request<number[]>('POST', '/api/stars/ids', params);
  }

  // ==================== Trending ====================

  async getTrendingList(params?: {
    language?: string;
    since?: string;
  }): Promise<Array<{
    repoName: string;
    ownerName: string;
    description: string | null;
    language: string | null;
    stars: number;
    forks: number;
    url: string;
  }>> {
    const queryParams = new URLSearchParams();
    if (params?.language) queryParams.set('language', params.language);
    if (params?.since) queryParams.set('since', params.since);
    return this.request('GET', `/api/trending?${queryParams.toString()}`);
  }

  async fetchTrending(params?: {
    language?: string;
    since?: string;
  }): Promise<ApiResponse> {
    return this.request<ApiResponse>('POST', '/api/trending/fetch', params);
  }

  // ==================== 作者 ====================

  async getAuthorList(params?: {
    page?: number;
    size?: number;
    keyword?: string;
  }): Promise<PaginatedResult<{
    ownerName: string;
    repoCount: number;
    totalStars: number;
  }>> {
    return this.request('POST', '/api/authors', params);
  }

  async getAuthorDetail(ownerName: string): Promise<{
    ownerName: string;
    repos: GithubRepo[];
    stats: {
      repoCount: number;
      totalStars: number;
      languages: string[];
    };
  }> {
    return this.request('GET', `/api/authors/${encodeURIComponent(ownerName)}`);
  }

  async getAuthorRepos(ownerName: string, params?: {
    page?: number;
    size?: number;
  }): Promise<PaginatedResult<GithubRepo>> {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.set('page', String(params.page));
    if (params?.size) queryParams.set('size', String(params.size));
    return this.request('GET', `/api/authors/${encodeURIComponent(ownerName)}/repos?${queryParams.toString()}`);
  }

  // ==================== 导出 ====================

  async exportMarkdown(params?: {
    keyword?: string;
    language?: string;
    sortBy?: string;
    sortOrder?: string;
    maxCount?: number;
  }): Promise<Blob> {
    const response = await fetch(`${this.baseUrl}/api/export/md`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params || {}),
    });

    if (!response.ok) {
      throw new Error(`导出失败: HTTP ${response.status}`);
    }

    return response.blob();
  }
}

export const api = new ApiClient();
