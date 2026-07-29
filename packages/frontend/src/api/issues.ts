import type {
    ApiResponse,
    GithubIssueDetail,
    GithubIssueDetailParams,
    GithubIssueListParams,
    GithubIssueListResult,
} from '@githubstars/shared'
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

/** 查询单个 Issue 的正文、评论和侧栏信息。 */
export async function fetchRepoIssueDetail(params: GithubIssueDetailParams): Promise<GithubIssueDetail> {
    const { data: response } = await api.post<ApiResponse<GithubIssueDetail>>('/api/stars/issue-detail', {
        id: params.repoId,
        issueNumber: params.issueNumber,
    })
    if (!response.data) {
        throw new Error(response.message || 'Issue 详情响应数据为空')
    }
    return response.data
}
