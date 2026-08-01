import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/** 待翻译记录（每个仓库一行，含待翻译的原文） */
export interface PendingLocalizationRecord {
    repoId: number;
    fullName: string | null;
    description: string | null;
    readme: string | null;
}

export interface PendingLocalizationResult {
    success: true;
    total: number;
    records: PendingLocalizationRecord[];
}

export interface UpdateLocalizationResult {
    success: true;
    updated: number;
    updatedRepoIds: number[];
    skippedRepoIds: number[];
}

/**
 * 仓库中文化数据接口 —— 只做"取原文 / 写译文"，不执行翻译。
 *
 * 翻译动作由智能体完成：智能体调 {@link findPending} 取未翻译原文，
 * 自行产出译文后调 {@link updateTranslations} 批量写回。
 * 项目已从"任务式后端翻译"迁移为此模式，translation_task 表已废弃。
 */
@Injectable()
export class RepositoryLocalizationService {
    private readonly logger = new Logger(RepositoryLocalizationService.name);

    constructor(private readonly prisma: PrismaService) {}

    /**
     * 查询未中文化的仓库原文。
     *
     * 一个仓库只要描述或 README 任一未翻译即返回；原文缺失的字段返回 null，
     * 由智能体跳过该字段。README 未抓取（readmeFetched=false 且 readmeOriginal 为空）
     * 的仓库不返回，避免智能体拿到空原文。
     */
    async findPending(limit = 50, includeDescription = true, includeReadme = true): Promise<PendingLocalizationResult> {
        if (!includeDescription && !includeReadme) {
            return { success: true, total: 0, records: [] };
        }

        // description 分支：有原文但未翻译；readme 分支：已抓到原文但未翻译。
        // notIn: [''] 排除空串原文：not:null 会匹配空串，空原文不可翻译，
        // 否则会产生 description/readme 全为 null 的无效记录
        let where: object;
        if (includeDescription && includeReadme) {
            where = {
                OR: [
                    { description: { not: null, notIn: [''] }, descriptionCn: null },
                    { readmeCn: null, readmeOriginal: { not: null, notIn: [''] } },
                ],
            };
        } else if (includeDescription) {
            where = { description: { not: null, notIn: [''] }, descriptionCn: null };
        } else {
            where = { readmeCn: null, readmeOriginal: { not: null, notIn: [''] } };
        }

        const repos = await this.prisma.githubRepo.findMany({
            where,
            orderBy: { starsCount: 'desc' },
            take: limit,
            select: {
                id: true,
                fullName: true,
                description: true,
                descriptionCn: true,
                readmeOriginal: true,
                readmeCn: true,
            },
        });

        const records: PendingLocalizationRecord[] = repos.map((repo) => ({
            repoId: Number(repo.id),
            fullName: repo.fullName,
            description: includeDescription && repo.description && !repo.descriptionCn ? repo.description : null,
            readme: includeReadme && repo.readmeOriginal && !repo.readmeCn ? repo.readmeOriginal : null,
        }));

        this.logger.log(`查询待翻译仓库: 命中 ${records.length} 条 (limit=${limit}, desc=${includeDescription}, readme=${includeReadme})`);
        return { success: true, total: records.length, records };
    }

    /**
     * 批量写入译文。只更新，不做翻译。
     *
     * 每条 item 必须至少包含 descriptionCn 或 readmeCn 之一；
     * 无有效字段或仓库不存在的计入 skipped。传了 readmeCn 即视为已抓取并翻译，置 readmeFetched=true。
     */
    async updateTranslations(
        items: Array<{ repoId: number; descriptionCn?: string; readmeCn?: string }>,
    ): Promise<UpdateLocalizationResult> {
        const updatedRepoIds: number[] = [];
        const skippedRepoIds: number[] = [];

        for (const item of items) {
            const data: { descriptionCn?: string; readmeCn?: string; readmeFetched?: boolean; updatedAt: Date } = {
                updatedAt: new Date(),
            };
            if (item.descriptionCn !== undefined && item.descriptionCn !== '') data.descriptionCn = item.descriptionCn;
            if (item.readmeCn !== undefined && item.readmeCn !== '') {
                data.readmeCn = item.readmeCn;
                data.readmeFetched = true;
            }

            if (data.descriptionCn === undefined && data.readmeCn === undefined) {
                skippedRepoIds.push(item.repoId);
                continue;
            }

            try {
                await this.prisma.githubRepo.update({ where: { id: item.repoId }, data });
                updatedRepoIds.push(item.repoId);
            } catch (error) {
                // 仓库不存在（P2025）等单条失败不阻塞整批
                skippedRepoIds.push(item.repoId);
                this.logger.warn(`译文更新失败 repoId=${item.repoId}: ${error instanceof Error ? error.message : String(error)}`);
            }
        }

        this.logger.log(`批量写入译文: 成功 ${updatedRepoIds.length} 条, 跳过 ${skippedRepoIds.length} 条`);
        return { success: true, updated: updatedRepoIds.length, updatedRepoIds, skippedRepoIds };
    }
}
