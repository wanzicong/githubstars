import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TagService {
    private readonly logger = new Logger(TagService.name);

    constructor(private readonly prisma: PrismaService) {}

    /** 获取所有标签维度及其标签（树形结构） */
    async listAll() {
        const groups = await this.prisma.tagGroup.findMany({ orderBy: { sortOrder: 'asc' } });
        const tags = await this.prisma.tag.findMany({ orderBy: [{ repoCount: 'desc' }, { name: 'asc' }] });
        const counts = await this.prisma.repoTag.groupBy({ by: ['tagId'], _count: { tagId: true } });
        const countMap = new Map<string, number>();
        for (const c of counts) countMap.set(String(c.tagId), c._count.tagId);
        // 同步 repo_count
        for (const tag of tags) {
            const realCount = countMap.get(String(tag.id)) || 0;
            if (Number(tag.repoCount) !== realCount) {
                await this.prisma.tag.update({ where: { id: tag.id }, data: { repoCount: realCount } }).catch(() => {});
            }
            (tag as any).repoCount = realCount;
        }
        return groups.map((g) => ({
            ...g,
            tags: tags.filter((t) => Number(t.groupId) === Number(g.id)),
        }));
    }

    /** 获取单个标签详情 */
    async getById(id: number) {
        return this.prisma.tag.findUnique({ where: { id: BigInt(id) }, include: { group: true } });
    }

    /** 创建标签 */
    async create(name: string, groupId: number, description?: string, color?: string, icon?: string) {
        const trimmed = name.trim();
        const exist = await this.prisma.tag.findFirst({ where: { name: trimmed, groupId: BigInt(groupId) } });
        if (exist) throw new Error(`标签 "${trimmed}" 在此维度下已存在`);
        return this.prisma.tag.create({
            data: { name: trimmed, groupId: BigInt(groupId), description: description || null, color: color || null, icon: icon || null },
        });
    }

    /** 创建标签维度（仅管理员使用） */
    async createGroup(name: string, color?: string, icon?: string) {
        const exist = await this.prisma.tagGroup.findUnique({ where: { name } });
        if (exist) throw new Error(`维度 "${name}" 已存在`);
        const maxSort = await this.prisma.tagGroup.findFirst({ orderBy: { sortOrder: 'desc' }, select: { sortOrder: true } });
        return this.prisma.tagGroup.create({ data: { name, color: color || '#1677ff', icon: icon || null, sortOrder: (maxSort?.sortOrder || 0) + 1 } });
    }

    /** 更新标签 */
    async update(id: number, data: { name?: string; description?: string; color?: string; icon?: string }) {
        const updateData: any = { updatedAt: new Date() };
        if (data.name) updateData.name = data.name.trim();
        if (data.description !== undefined) updateData.description = data.description;
        if (data.color) updateData.color = data.color;
        if (data.icon !== undefined) updateData.icon = data.icon;
        await this.prisma.tag.update({ where: { id: BigInt(id) }, data: updateData });
    }

    /** 删除标签 */
    async delete(id: number) {
        await this.prisma.repoTag.deleteMany({ where: { tagId: BigInt(id) } });
        await this.prisma.tag.delete({ where: { id: BigInt(id) } });
    }

    /** 为仓库添加标签 */
    async addRepoTag(repoId: number, tagId: number, source: string = 'manual') {
        const exist = await this.prisma.repoTag.findUnique({ where: { repoId_tagId: { repoId: BigInt(repoId), tagId: BigInt(tagId) } } });
        if (exist) return exist;
        const result = await this.prisma.repoTag.create({ data: { repoId: BigInt(repoId), tagId: BigInt(tagId), source } });
        await this.prisma.tag.update({ where: { id: BigInt(tagId) }, data: { repoCount: { increment: 1 } } });
        return result;
    }

    /** 移除仓库的标签 */
    async removeRepoTag(repoId: number, tagId: number) {
        await this.prisma.repoTag.deleteMany({ where: { repoId: BigInt(repoId), tagId: BigInt(tagId) } });
        await this.prisma.tag.update({ where: { id: BigInt(tagId) }, data: { repoCount: { decrement: 1 } } });
    }

    /** 获取仓库的所有标签 */
    async getRepoTags(repoId: number) {
        const relations = await this.prisma.repoTag.findMany({
            where: { repoId: BigInt(repoId) },
            include: { tag: { include: { group: true } } },
            orderBy: { createdAt: 'asc' },
        });
        return relations.map((r) => ({
            id: Number(r.tag.id),
            name: r.tag.name,
            color: r.tag.color,
            icon: r.tag.icon,
            groupName: r.tag.group.name,
            groupColor: r.tag.group.color,
            source: r.source,
        }));
    }

    /** 批量保存AI标签结果（原子操作） */
    async saveAiTagResult(repoIds: number[], tagAssignments: Record<string, string[]>) {
        this.logger.log(`保存AI标签结果: repoCount=${repoIds.length}, tagCount=${Object.keys(tagAssignments).length}`);
        await this.prisma.$transaction(async (tx) => {
            // 先清除这些仓库的所有 AI 来源标签
            for (const repoId of repoIds) {
                await tx.repoTag.deleteMany({ where: { repoId: BigInt(repoId), source: 'ai' } });
            }
            // 逐个应用新标签
            for (const [tagName, indices] of Object.entries(tagAssignments)) {
                if (!indices.length) continue;
                // 查找或创建标签（默认放到"自定义"维度，groupId=6）
                let tag = await tx.tag.findFirst({ where: { name: tagName } });
                if (!tag) {
                    tag = await tx.tag.create({ data: { name: tagName, groupId: BigInt(6), repoCount: 0 } });
                }
                for (const idx of indices) {
                    const i = parseInt(String(idx), 10);
                    if (!isNaN(i) && i >= 0 && i < repoIds.length) {
                        const repoId = repoIds[i];
                        await tx.repoTag.create({
                            data: { repoId: BigInt(repoId), tagId: tag.id, source: 'ai' },
                        }).catch(() => {}); // skip duplicates
                        await tx.tag.update({ where: { id: tag.id }, data: { repoCount: { increment: 1 } } });
                    }
                }
            }
        });
        this.logger.log('AI标签结果保存完成');
    }
}
