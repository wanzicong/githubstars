/**
 * 测试数据工厂
 * 每个函数返回可插入数据库的对象，支持 overrides 定制字段。
 * 所有数据在事务中创建，afterEach 回滚自动清理。
 */
import { PrismaService } from '../../src/prisma/prisma.service'

// ========== GithubRepo ==========

export interface RepoFixture {
  id?: number
  repoName: string
  fullName: string
  description: string | null
  descriptionCn: string | null
  readmeOriginal: string | null
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
  topics: string
  licenseName: string | null
  isFork: boolean
  isArchived: boolean
  repoCreatedAt: Date
  repoUpdatedAt: Date
  repoPushedAt: Date
  starredAt: Date
  createdAt: Date
  updatedAt: Date
}

let _repoSeq = 0
export function createRepoFixture(overrides?: Partial<RepoFixture>): RepoFixture {
  _repoSeq++
  const seq = _repoSeq
  const now = new Date()
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
  }
}

export async function insertRepo(prisma: PrismaService, overrides?: Partial<RepoFixture>) {
  const repo = createRepoFixture(overrides)
  await prisma.githubRepo.create({
    data: { ...repo, descriptionCn: repo.descriptionCn ?? undefined, readmeOriginal: repo.readmeOriginal ?? undefined, readmeCn: repo.readmeCn ?? undefined },
  })
  return repo
}

// ========== Category ==========

export interface CategoryFixture {
  id?: bigint
  name: string
  description: string | null
  sortOrder: number
  parentId: bigint | null
  level: number
  createdAt: Date
  updatedAt: Date
}

let _catSeq = 0
export function createCategoryFixture(overrides?: Partial<CategoryFixture>): CategoryFixture {
  _catSeq++
  const now = new Date()
  return {
    name: `test-category-${_catSeq}`,
    description: null,
    sortOrder: _catSeq,
    parentId: null,
    level: 1,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

export async function insertCategory(prisma: PrismaService, overrides?: Partial<CategoryFixture>) {
  const cat = createCategoryFixture(overrides)
  return prisma.category.create({ data: cat })
}

// ========== TranslationTask ==========

export async function insertTranslationTask(prisma: PrismaService, overrides?: any) {
  return prisma.translationTask.create({
    data: {
      status: 'PENDING',
      totalItems: 1,
      completedItems: 0,
      failedItems: 0,
      descTotal: 0, descCompleted: 0, descFailed: 0,
      readmeTotal: 0, readmeCompleted: 0, readmeFailed: 0,
      createdAt: new Date(),
      ...overrides,
    },
  })
}

export async function insertTranslationTaskItem(prisma: PrismaService, overrides: {
  taskId: bigint; repoId: bigint; fullName: string; translateType: 'description' | 'readme'
  status?: string
}) {
  return prisma.translationTaskItem.create({
    data: { status: 'PENDING', retryCount: 0, createdAt: new Date(), ...overrides },
  })
}

// ========== SyncLog ==========

export async function insertSyncLog(prisma: PrismaService, overrides?: any) {
  return prisma.syncLog.create({
    data: {
      syncType: 'manual', status: 'SUCCESS', totalCount: 10, syncedCount: 10,
      startedAt: new Date(), finishedAt: new Date(), createdAt: new Date(),
      ...overrides,
    },
  })
}
