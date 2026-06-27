/**
 * 测试数据工厂
 * 每个函数返回可插入数据库的对象，支持 overrides 定制字段。
 * 所有数据在事务中创建，afterEach 回滚自动清理。
 */
import { PrismaService } from '../../src/prisma/prisma.service';

// ========== GithubRepo ==========

export interface RepoFixture {
    id?: number;
    repoName: string;
    fullName: string;
    description: string | null;
    descriptionCn: string | null;
    readmeOriginal: string | null;
    readmeCn: string | null;
    readmeFetched: boolean;
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
    repoCreatedAt: Date;
    repoUpdatedAt: Date;
    repoPushedAt: Date;
    starredAt: Date;
    createdAt: Date;
    updatedAt: Date;
}

let _repoSeq = 0;
export function createRepoFixture(overrides?: Partial<RepoFixture>): RepoFixture {
    _repoSeq++;
    const seq = _repoSeq;
    const now = new Date();
    return {
        repoName: `test-repo-${seq}`,
        fullName: `test-owner/test-repo-${seq}`,
        description: `Test description ${seq}`,
        descriptionCn: null,
        readmeOriginal: null,
        readmeCn: null,
        readmeFetched: false,
        language: 'TypeScript',
        ownerName: 'test-owner',
        ownerAvatarUrl: 'https://avatar.example.com/test.png',
        htmlUrl: `https://github.com/test-owner/test-repo-${seq}`,
        homepage: null,
        starsCount: 100,
        forksCount: 10,
        watchersCount: 5,
        openIssuesCount: 3,
        topics: '["test","fixture"]',
        licenseName: 'MIT',
        isFork: false,
        isArchived: false,
        repoCreatedAt: new Date('2023-01-01'),
        repoUpdatedAt: new Date('2024-06-01'),
        repoPushedAt: new Date('2024-06-01'),
        starredAt: now,
        createdAt: now,
        updatedAt: now,
        ...overrides,
    };
}

export async function insertRepo(prisma: PrismaService, overrides?: Partial<RepoFixture>) {
    const repo = createRepoFixture(overrides);
    const created = await prisma.githubRepo.create({
        data: {
            ...repo,
            descriptionCn: repo.descriptionCn ?? undefined,
            readmeOriginal: repo.readmeOriginal ?? undefined,
            readmeCn: repo.readmeCn ?? undefined,
        },
        select: { id: true },
    });
    return { ...repo, id: Number(created.id) };
}
