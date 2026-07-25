import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { LearnTagCreateDto, LearnTagUpdateDto } from './learn.dto';

export interface LearnTagView {
    id: number;
    name: string;
    color: string | null;
    /** 当前被多少学习记录使用 */
    usageCount: number;
    createdAt: Date;
    updatedAt: Date;
}

/**
 * 学习标签服务
 *
 * 标签是平铺结构（无层级），全部用户级共享。
 */
@Injectable()
export class LearnTagService {
    private readonly logger = new Logger(LearnTagService.name);

    constructor(private readonly prisma: PrismaService) {}

    /** 标签列表（按使用频次倒序，再按名称升序） */
    async list(): Promise<LearnTagView[]> {
        const rows = await this.prisma.learnTag.findMany({
            include: { _count: { select: { tagLinks: true } } },
            orderBy: [{ name: 'asc' }],
        });
        const views = rows.map((r) => ({
            id: Number(r.id),
            name: r.name,
            color: r.color,
            usageCount: r._count.tagLinks,
            createdAt: r.createdAt,
            updatedAt: r.updatedAt,
        }));
        views.sort((a, b) => b.usageCount - a.usageCount || a.name.localeCompare(b.name));
        return views;
    }

    /** 新建标签（重名抛 400） */
    async create(dto: LearnTagCreateDto): Promise<LearnTagView> {
        const existing = await this.prisma.learnTag.findUnique({ where: { name: dto.name } });
        if (existing) throw new BadRequestException(`标签已存在: ${dto.name}`);
        const row = await this.prisma.learnTag.create({
            data: { name: dto.name, color: dto.color ?? null },
        });
        this.logger.log(`创建学习标签 id=${row.id} name=${row.name}`);
        return { id: Number(row.id), name: row.name, color: row.color, usageCount: 0, createdAt: row.createdAt, updatedAt: row.updatedAt };
    }

    /** 更新标签 */
    async update(dto: LearnTagUpdateDto): Promise<LearnTagView> {
        const existing = await this.prisma.learnTag.findUnique({ where: { id: BigInt(dto.id) } });
        if (!existing) throw new NotFoundException(`标签不存在: id=${dto.id}`);
        if (dto.name && dto.name !== existing.name) {
            const dup = await this.prisma.learnTag.findUnique({ where: { name: dto.name } });
            if (dup) throw new BadRequestException(`标签名已被占用: ${dto.name}`);
        }
        const row = await this.prisma.learnTag.update({
            where: { id: BigInt(dto.id) },
            data: {
                name: dto.name ?? existing.name,
                color: dto.color !== undefined ? dto.color : existing.color,
            },
            include: { _count: { select: { tagLinks: true } } },
        });
        this.logger.log(`更新学习标签 id=${row.id} name=${row.name}`);
        return {
            id: Number(row.id),
            name: row.name,
            color: row.color,
            usageCount: row._count.tagLinks,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
        };
    }

    /** 删除标签（tag_link 级联删除） */
    async delete(id: number): Promise<{ success: true }> {
        const existing = await this.prisma.learnTag.findUnique({ where: { id: BigInt(id) } });
        if (!existing) throw new NotFoundException(`标签不存在: id=${id}`);
        await this.prisma.learnTag.delete({ where: { id: BigInt(id) } });
        this.logger.log(`删除学习标签 id=${id} name=${existing.name}`);
        return { success: true };
    }
}
