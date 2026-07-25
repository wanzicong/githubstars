import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { buildPaginationResult, type PaginatedResult } from '../common/utils/pagination.util';
import type { LearnCreateDto, LearnListDto, LearnStatus, LearnUpdateDto } from './learn.dto';

/**
 * 单条学习记录视图（含 repo 摘要 + 标签列表）
 */
export interface LearnRecordView {
    id: number;
    repoId: number;
    status: LearnStatus;
    priority: string;
    notes: string | null;
    startedAt: Date | null;
    finishedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    repo: {
        id: number;
        repoName: string | null;
        fullName: string | null;
        description: string | null;
        descriptionCn: string | null;
        language: string | null;
        ownerName: string | null;
        ownerAvatarUrl: string | null;
        htmlUrl: string | null;
        starsCount: number;
        forksCount: number;
        starredAt: Date | null;
    };
    tags: { id: number; name: string; color: string | null }[];
}

const REPO_SELECT = {
    id: true,
    repoName: true,
    fullName: true,
    description: true,
    descriptionCn: true,
    language: true,
    ownerName: true,
    ownerAvatarUrl: true,
    htmlUrl: true,
    starsCount: true,
    forksCount: true,
    starredAt: true,
} satisfies Prisma.GithubRepoSelect;

/**
 * 学习收藏服务
 *
 * 职责：
 * - 学习记录的 CRUD 与状态机（自动维护 startedAt/finishedAt）
 * - 多维度筛选（状态/优先级/分类/标签/关键字）
 * - 标签的全量替换更新（参考 category 模块的 ManageRepoCategoriesModal 模式）
 */
@Injectable()
export class LearnService {
    private readonly logger = new Logger(LearnService.name);

    constructor(private readonly prisma: PrismaService) {}

    /**
     * 分页查询学习记录
     */
    async findPage(dto: LearnListDto): Promise<PaginatedResult<LearnRecordView>> {
        const { page, size, status, priority, categoryId, tagIds, keyword, sortBy, sortOrder } = dto;
        const where = await this.buildWhere({ status, priority, categoryId, tagIds, keyword });

        const orderBy = this.buildOrderBy(sortBy, sortOrder);

        const [total, rows] = await Promise.all([
            this.prisma.learnRecord.count({ where }),
            this.prisma.learnRecord.findMany({
                where,
                include: {
                    repo: { select: REPO_SELECT },
                    tagLinks: { include: { tag: true } },
                },
                orderBy,
                skip: (page - 1) * size,
                take: size,
            }),
        ]);

        return buildPaginationResult(
            rows.map((r) => this.toView(r)),
            total,
            page,
            size,
        );
    }

    /**
     * 详情
     */
    async findOne(id: number): Promise<LearnRecordView> {
        const record = await this.prisma.learnRecord.findUnique({
            where: { id: BigInt(id) },
            include: {
                repo: { select: REPO_SELECT },
                tagLinks: { include: { tag: true } },
            },
        });
        if (!record) throw new NotFoundException(`学习记录不存在: id=${id}`);
        return this.toView(record);
    }

    /**
     * 创建（把 repo 加入学习清单）
     *
     * 同一 repoId 已存在时抛出 400（repoId 唯一约束）。
     */
    async create(dto: LearnCreateDto): Promise<LearnRecordView> {
        const repoId = BigInt(dto.repoId);
        const repo = await this.prisma.githubRepo.findUnique({ where: { id: repoId }, select: { id: true } });
        if (!repo) throw new NotFoundException(`仓库不存在: repoId=${dto.repoId}`);

        const existing = await this.prisma.learnRecord.findUnique({ where: { repoId } });
        if (existing) throw new BadRequestException(`该仓库已在学习清单中: recordId=${existing.id}`);

        await this.assertTagsExist(dto.tagIds);

        const timestamps = this.computeTimestamps(null, dto.status);

        const record = await this.prisma.learnRecord.create({
            data: {
                repoId,
                status: dto.status,
                priority: dto.priority,
                notes: dto.notes ?? null,
                ...timestamps,
                tagLinks: dto.tagIds.length
                    ? { create: dto.tagIds.map((tagId) => ({ tag: { connect: { id: BigInt(tagId) } } })) }
                    : undefined,
            },
            include: {
                repo: { select: REPO_SELECT },
                tagLinks: { include: { tag: true } },
            },
        });

        this.logger.log(`创建学习记录 id=${record.id} repoId=${dto.repoId} status=${dto.status} priority=${dto.priority}`);
        return this.toView(record);
    }

    /**
     * 一键加入学习（StarList 页书签按钮）
     *
     * 已存在则直接返回现有记录（幂等），避免前端误操作重复报错。
     */
    async quickAdd(repoId: number): Promise<LearnRecordView> {
        const existing = await this.prisma.learnRecord.findUnique({
            where: { repoId: BigInt(repoId) },
            include: { repo: { select: REPO_SELECT }, tagLinks: { include: { tag: true } } },
        });
        if (existing) return this.toView(existing);
        return this.create({ repoId, status: 'WANT', priority: 'MEDIUM', tagIds: [] });
    }

    /**
     * 批量查询一组 repoId 哪些已加入学习（StarList 卡片书签高亮）
     *
     * 返回 map: repoId -> learnRecordId
     */
    async checkRepos(repoIds: number[]): Promise<Record<number, number>> {
        if (!repoIds.length) return {};
        const rows = await this.prisma.learnRecord.findMany({
            where: { repoId: { in: repoIds.map((id) => BigInt(id)) } },
            select: { id: true, repoId: true },
        });
        const map: Record<number, number> = {};
        for (const r of rows) map[Number(r.repoId)] = Number(r.id);
        return map;
    }

    /**
     * 更新（状态/优先级/笔记/标签）
     *
     * - 状态变更时自动维护 startedAt/finishedAt
     * - tagIds 传入则全量替换（先 deleteMany 再 createMany）
     */
    async update(dto: LearnUpdateDto): Promise<LearnRecordView> {
        const id = BigInt(dto.id);
        const existing = await this.prisma.learnRecord.findUnique({ where: { id } });
        if (!existing) throw new NotFoundException(`学习记录不存在: id=${dto.id}`);

        if (dto.tagIds !== undefined) await this.assertTagsExist(dto.tagIds);

        const data: Prisma.LearnRecordUpdateInput = {};
        if (dto.priority !== undefined) data.priority = dto.priority;
        if (dto.notes !== undefined) data.notes = dto.notes;
        if (dto.status !== undefined) {
            data.status = dto.status;
            Object.assign(data, this.computeTimestamps(existing, dto.status));
        }

        await this.prisma.$transaction(async (tx) => {
            await tx.learnRecord.update({ where: { id }, data });
            if (dto.tagIds !== undefined) {
                await tx.learnTagLink.deleteMany({ where: { learnRecordId: id } });
                if (dto.tagIds.length) {
                    await tx.learnTagLink.createMany({
                        data: dto.tagIds.map((tagId) => ({ learnRecordId: id, tagId: BigInt(tagId) })),
                        skipDuplicates: true,
                    });
                }
            }
        });

        this.logger.log(
            `更新学习记录 id=${dto.id} status=${dto.status ?? '-'} priority=${dto.priority ?? '-'} tags=${dto.tagIds?.length ?? '-'}`,
        );
        return this.findOne(dto.id);
    }

    /**
     * 删除（移出学习清单）
     */
    async delete(id: number): Promise<{ success: true }> {
        const existing = await this.prisma.learnRecord.findUnique({ where: { id: BigInt(id) } });
        if (!existing) throw new NotFoundException(`学习记录不存在: id=${id}`);
        await this.prisma.learnRecord.delete({ where: { id: BigInt(id) } });
        this.logger.log(`删除学习记录 id=${id} repoId=${existing.repoId}`);
        return { success: true };
    }

    /**
     * 状态统计：各状态的记录数
     */
    async stats(): Promise<Record<LearnStatus | 'ALL', number>> {
        const rows = await this.prisma.learnRecord.groupBy({
            by: ['status'],
            _count: { _all: true },
        });
        const result: Record<string, number> = { WANT: 0, LEARNING: 0, DONE: 0, SHELVED: 0, ALL: 0 };
        for (const r of rows) {
            result[r.status] = r._count._all;
            result.ALL += r._count._all;
        }
        return result;
    }

    // ────────────────────────────────────────────────────────────
    // 私有辅助
    // ────────────────────────────────────────────────────────────

    /**
     * 构造 WHERE 子句
     *
     * 分类筛选：复用现有 category 表（含后代展开），复用 github-repo.service 的思路。
     * 标签筛选：tagIds 任一命中即可（OR 语义）。
     */
    private async buildWhere(params: {
        status?: LearnStatus;
        priority?: string;
        categoryId?: number;
        tagIds?: number[];
        keyword?: string;
    }): Promise<Prisma.LearnRecordWhereInput> {
        const where: Prisma.LearnRecordWhereInput = {};
        const andConditions: Prisma.LearnRecordWhereInput[] = [];

        if (params.status) where.status = params.status;
        if (params.priority) where.priority = params.priority;

        if (params.keyword?.trim()) {
            const kw = params.keyword.trim();
            andConditions.push({
                repo: {
                    OR: [
                        { repoName: { contains: kw } },
                        { fullName: { contains: kw } },
                        { description: { contains: kw } },
                        { descriptionCn: { contains: kw } },
                        { ownerName: { contains: kw } },
                    ],
                },
            });
        }

        if (params.categoryId) {
            const categoryIds = await this.expandCategoryIds(params.categoryId);
            andConditions.push({
                repo: { categories: { some: { categoryId: { in: categoryIds.map((c) => BigInt(c)) } } } },
            });
        }

        if (params.tagIds?.length) {
            andConditions.push({
                tagLinks: { some: { tagId: { in: params.tagIds.map((t) => BigInt(t)) } } },
            });
        }

        if (andConditions.length) where.AND = andConditions;
        return where;
    }

    /**
     * 展开分类 ID 列表：包含自身 + 所有后代
     *
     * 与 github-repo.service.ts 中 expandCategoryIds 模式一致。
     */
    private async expandCategoryIds(id: number): Promise<number[]> {
        const collect = async (parentId: number): Promise<number[]> => {
            const children = await this.prisma.category.findMany({
                where: { parentId: BigInt(parentId) },
                select: { id: true },
            });
            const childIds = children.map((c) => Number(c.id));
            if (childIds.length === 0) return [];
            const grandChildIds = await Promise.all(childIds.map(collect));
            return [...childIds, ...grandChildIds.flat()];
        };
        const descendants = await collect(id);
        return [id, ...descendants];
    }

    /**
     * 校验一组 tagIds 全部存在（任一不存在则 400）
     */
    private async assertTagsExist(tagIds: number[]): Promise<void> {
        if (!tagIds.length) return;
        const rows = await this.prisma.learnTag.findMany({
            where: { id: { in: tagIds.map((t) => BigInt(t)) } },
            select: { id: true },
        });
        const existing = new Set(rows.map((r) => Number(r.id)));
        const missing = tagIds.filter((t) => !existing.has(t));
        if (missing.length) throw new BadRequestException(`标签不存在: ${missing.join(',')}`);
    }

    /**
     * 排序映射
     */
    private buildOrderBy(
        sortBy: 'createdAt' | 'updatedAt' | 'priority' | 'starsCount' | 'starredAt',
        sortOrder: 'asc' | 'desc',
    ): Prisma.LearnRecordOrderByWithRelationInput {
        if (sortBy === 'starsCount') return { repo: { starsCount: sortOrder } };
        if (sortBy === 'starredAt') return { repo: { starredAt: sortOrder } };
        if (sortBy === 'priority') return { priority: sortOrder };
        if (sortBy === 'updatedAt') return { updatedAt: sortOrder };
        return { createdAt: sortOrder };
    }

    /**
     * 状态机时间戳计算
     *
     * - 切到 LEARNING 且 startedAt 为空 → 写入 startedAt
     * - 切到 DONE 且 finishedAt 为空 → 写入 finishedAt
     * - 切回 WANT → 清空两个时间戳
     * - 切到 SHELVED → 保留 startedAt（恢复 LEARNING 时不需要重新计时）
     */
    private computeTimestamps(
        existing: { startedAt: Date | null; finishedAt: Date | null } | null,
        newStatus: LearnStatus,
    ): { startedAt?: Date | null; finishedAt?: Date | null } {
        const result: { startedAt?: Date | null; finishedAt?: Date | null } = {};
        if (newStatus === 'LEARNING' && !existing?.startedAt) result.startedAt = new Date();
        if (newStatus === 'DONE' && !existing?.finishedAt) result.finishedAt = new Date();
        if (newStatus === 'WANT') {
            result.startedAt = null;
            result.finishedAt = null;
        }
        return result;
    }

    /**
     * ORM 行 → 视图（BigInt → number，平铺 tagLinks）
     */
    private toView(row: {
        id: bigint;
        repoId: bigint;
        status: string;
        priority: string;
        notes: string | null;
        startedAt: Date | null;
        finishedAt: Date | null;
        createdAt: Date;
        updatedAt: Date;
        repo: {
            id: bigint;
            repoName: string | null;
            fullName: string | null;
            description: string | null;
            descriptionCn: string | null;
            language: string | null;
            ownerName: string | null;
            ownerAvatarUrl: string | null;
            htmlUrl: string | null;
            starsCount: number;
            forksCount: number;
            starredAt: Date | null;
        };
        tagLinks: { tag: { id: bigint; name: string; color: string | null } }[];
    }): LearnRecordView {
        return {
            id: Number(row.id),
            repoId: Number(row.repoId),
            status: row.status as LearnStatus,
            priority: row.priority,
            notes: row.notes,
            startedAt: row.startedAt,
            finishedAt: row.finishedAt,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
            repo: { ...row.repo, id: Number(row.repo.id) },
            tags: row.tagLinks.map((l) => ({ id: Number(l.tag.id), name: l.tag.name, color: l.tag.color })),
        };
    }
}
