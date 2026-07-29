import type { ApiResponse, GithubIssueListParams, GithubIssueListResult } from '@githubstars/shared'
import api from './request'

/**
 * 分页查询指定 Star 仓库的 GitHub Issues。
 *
 * 请求由后端代理，前端不会接触 GitHub Token。
 */
export async function fetchRepoIssues(params: GithubIssueListParams): Promise<GithubIssueListResult> {
    const { data: response } = await api.post<ApiResponse<GithubIssueListResult>>('/api/stars/issues', {
        id: params.repoId,
        state: params.state,
        query: params.query,
        sort: params.sort,
        order: params.order,
        page: params.page,
        perPage: params.perPage,
    })
    if (!response.data) {
        throw new Error(response.message || 'Issues 响应数据为空')
    }
    return response.data
}
