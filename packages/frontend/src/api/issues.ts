import type {
    ApiResponse,
    GithubIssueDetail,
    GithubIssueListResult,
    GithubIssueOrder,
    GithubIssueSort,
    GithubIssueState,
} from '@githubstars/shared'
import api from './request'

/** 按 fullName 查询 Issues 的请求参数 */
export type IssuesByNameParams = {
    owner: string
    repo: string
    state?: GithubIssueState
    query?: string
    sort?: GithubIssueSort
    order?: GithubIssueOrder
    page?: number
    perPage?: number
}

/** 按 fullName 查询 Issue 详情的请求参数 */
export type IssueDetailByNameParams = {
    owner: string
    repo: string
    issueNumber: number
}

/**
 * 按 owner/repo 分页查询 GitHub Issues（统一数据源，无需本地入库）。
 */
export async function fetchRepoIssues(params: IssuesByNameParams): Promise<GithubIssueListResult> {
    const { data: response } = await api.post<ApiResponse<GithubIssueListResult>>('/api/github/issues', {
        owner: params.owner,
        repo: params.repo,
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

/** 按 owner/repo 查询单个 Issue 的正文、评论和侧栏信息。 */
export async function fetchRepoIssueDetail(params: IssueDetailByNameParams): Promise<GithubIssueDetail> {
    const { data: response } = await api.post<ApiResponse<GithubIssueDetail>>('/api/github/issue-detail', {
        owner: params.owner,
        repo: params.repo,
        issueNumber: params.issueNumber,
    })
    if (!response.data) {
        throw new Error(response.message || 'Issue 详情响应数据为空')
    }
    return response.data
}
