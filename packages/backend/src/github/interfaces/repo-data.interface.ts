/**
 * 仓库数据类型接口
 *
 * 定义 GitHub API 返回数据映射到 DB 后的类型，
 * 以及 upsertRepo 操作的强类型入参，消除 `any` 类型。
 */

/** DB 映射后的仓库数据，匹配 GithubRepo 表字段 */
export interface MappedRepoData {
    repoName: string;
    fullName: string;
    description: string | null;
    language: string | null;
    ownerName: string;
    ownerAvatarUrl: string;
    htmlUrl: string;
    homepage: string | null;
    starsCount: number;
    forksCount: number;
    watchersCount: number;
    openIssuesCount: number;
    topics: string;
    licenseName: string | null;
    isFork: boolean;
    isArchived: boolean;
    repoCreatedAt: Date | null;
    repoUpdatedAt: Date | null;
    repoPushedAt: Date | null;
    starredAt: Date | null;
}

/** upsertRepo 操作的入参类型 */
export interface UpsertRepoInput extends MappedRepoData {
    createdAt?: Date;
    updatedAt?: Date;
    descriptionCn?: string | null;
    readmeCn?: string | null;
    readmeOriginal?: string | null;
    readmeFetched?: boolean;
}
