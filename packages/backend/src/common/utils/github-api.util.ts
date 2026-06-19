/**
 * GitHub API ??????
 * ? github-api.service.ts ????????????????
 */

import type { MappedRepoData } from '../../github/repo-data.interface'

/** Link header ???? */
export interface PaginationLinks {
    first?: string
    prev?: string
    next?: string
    last?: string
}

/** ?? GitHub API ??? */
export function buildGithubHeaders(token: string, accept = 'application/vnd.github.v3+json'): Record<string, string> {
    const headers: Record<string, string> = { Accept: accept, 'User-Agent': 'GithubStars-Manager' }
    if (token) headers['Authorization'] = `Bearer ${token}`
    return headers
}

/** ? GitHub starred API ??????? DB ?? */
export function mapStarredItem(item: Record<string, any>): MappedRepoData | null {
    const repo = item.repo || {}
    if (!repo || !repo.full_name) return null
    const owner = repo.owner || {}
    const license = repo.license || {}
    return {
        repoName: repo.name || '',
        fullName: repo.full_name || '',
        description: repo.description || null,
        language: repo.language || null,
        ownerName: owner.login || '',
        ownerAvatarUrl: owner.avatar_url || '',
        htmlUrl: repo.html_url || '',
        homepage: repo.homepage || null,
        starsCount: repo.stargazers_count || 0,
        forksCount: repo.forks_count || 0,
        watchersCount: repo.watchers_count || 0,
        openIssuesCount: repo.open_issues_count || 0,
        topics: JSON.stringify(Array.isArray(repo.topics) ? repo.topics : []),
        licenseName: license.name || null,
        isFork: !!repo.fork,
        isArchived: !!repo.archived,
        repoCreatedAt: repo.created_at ? new Date(repo.created_at) : null,
        repoUpdatedAt: repo.updated_at ? new Date(repo.updated_at) : null,
        repoPushedAt: repo.pushed_at ? new Date(repo.pushed_at) : null,
        starredAt: item.starred_at ? new Date(item.starred_at) : null,
    }
}

/** ?? GitHub API Link header */
export function parseLinkHeader(linkHeader: string): PaginationLinks {
    const links: PaginationLinks = {}
    if (!linkHeader || linkHeader.trim() === '') return links
    const parts = linkHeader.split(',')
    for (const part of parts) {
        const trimmed = part.trim()
        const match = trimmed.match(/<([^>]+)>;\s*rel="([^"]+)"/)
        if (!match) continue
        const url = match[1]
        const rel = match[2].toLowerCase()
        switch (rel) {
            case 'first': links.first = url; break
            case 'prev': links.prev = url; break
            case 'next': links.next = url; break
            case 'last': links.last = url; break
        }
    }
    return links
}

/** ?????????? */
export function estimateTotalPages(links: PaginationLinks, currentPage: number): number {
    if (links.last) {
        try {
            const url = new URL(links.last)
            const pageParam = url.searchParams.get('page')
            if (pageParam) {
                const total = parseInt(pageParam, 10)
                if (!isNaN(total) && total > 0) return total
            }
        } catch { /* URL ???? */ }
    }
    if (!links.next) return currentPage
    return currentPage
}

/** Promise ???? */
export function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
}
