import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/** 系统预置标签维度定义 */
const SYSTEM_GROUPS = [
    { name: '📚 技术栈', color: '#1677ff', icon: 'code' },
    { name: '🏷️ 领域', color: '#52c41a', icon: 'appstore' },
    { name: '🔧 用途', color: '#fa8c16', icon: 'tool' },
    { name: '📊 状态', color: '#eb2f96', icon: 'flag' },
    { name: '👥 服务人群', color: '#722ed1', icon: 'team' },
    { name: '💡 解决什么问题', color: '#13c2c2', icon: 'bulb' },
    { name: '🏢 生态', color: '#faad14', icon: 'bank' },
    { name: '✨ 自定义', color: '#ff85c0', icon: 'star' },
];

@Injectable()
export class TagService {
    private readonly logger = new Logger(TagService.name);

    constructor(private readonly prisma: PrismaService) {}

    /** 确保系统预置标签维度存在（缺失则自动创建） */
    async ensureSystemGroups() {
        const existing = await this.prisma.tagGroup.findMany({ select: { name: true } });
        const existingNames = new Set(existing.map((g) => g.name));
        for (let i = 0; i < SYSTEM_GROUPS.length; i++) {
            const g = SYSTEM_GROUPS[i];
            if (!existingNames.has(g.name)) {
                await this.prisma.tagGroup.create({
                    data: { name: g.name, color: g.color, icon: g.icon, sortOrder: i + 1, isSystem: true },
                });
                this.logger.log(`自动创建系统标签维度: ${g.name}`);
            }
        }
    }

    /** 获取所有标签维度及其标签（树形结构） */
    async listAll() {
        await this.ensureSystemGroups();
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

    /** 根据维度名称查找 groupId，找不到返回自定义维度 ID */
    async resolveGroupId(groupName: string): Promise<bigint> {
        const group = await this.prisma.tagGroup.findFirst({ where: { name: groupName } });
        if (group) return group.id;
        // 回退到"✨ 自定义"
        const fallback = await this.prisma.tagGroup.findFirst({ where: { name: '✨ 自定义' } });
        return fallback?.id ?? BigInt(1);
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

    /** 删除标签（若有子标签，先解除父子关系） */
    async delete(id: number) {
        // 解除子标签的 parentId 引用
        await this.prisma.tag.updateMany({ where: { parentId: BigInt(id) }, data: { parentId: null } });
        await this.prisma.repoTag.deleteMany({ where: { tagId: BigInt(id) } });
        await this.prisma.tag.delete({ where: { id: BigInt(id) } });
    }

    /** 按关键词搜索标签 */
    async search(keyword: string) {
        const trimmed = keyword.trim();
        if (!trimmed) return [];
        const tags = await this.prisma.tag.findMany({
            where: { name: { contains: trimmed } },
            include: { group: true },
            orderBy: { repoCount: 'desc' },
            take: 50,
        });
        return tags.map((t) => ({
            id: Number(t.id),
            name: t.name,
            color: t.color,
            icon: t.icon,
            groupId: Number(t.groupId),
            groupName: t.group.name,
            repoCount: Number(t.repoCount),
        }));
    }

    /** 删除所有 repoCount 为 0 的空标签 */
    async deleteEmpty() {
        const emptyTags = await this.prisma.tag.findMany({ where: { repoCount: 0 }, select: { id: true, name: true } });
        if (!emptyTags.length) return { deleted: 0, names: [] as string[] };
        const ids = emptyTags.map((t) => t.id);
        // 解除这些标签的子标签引用
        await this.prisma.tag.updateMany({ where: { parentId: { in: ids } }, data: { parentId: null } });
        await this.prisma.repoTag.deleteMany({ where: { tagId: { in: ids } } });
        await this.prisma.tag.deleteMany({ where: { id: { in: ids } } });
        this.logger.log(`已删除 ${ids.length} 个空标签: ${emptyTags.map((t) => t.name).join(', ')}`);
        return { deleted: ids.length, names: emptyTags.map((t) => t.name) };
    }

    /** 删除全部标签（重置标签体系，同时清空仓库关联） */
    async deleteAll() {
        const count = await this.prisma.tag.count();
        await this.prisma.repoTag.deleteMany();
        await this.prisma.tag.deleteMany();
        this.logger.log(`已删除全部 ${count} 个标签`);
        return { deleted: count };
    }

    /** 删除标签维度（含其下所有标签） */
    async deleteGroup(id: number) {
        const tags = await this.prisma.tag.findMany({ where: { groupId: BigInt(id) }, select: { id: true } });
        const tagIds = tags.map((t) => t.id);
        if (tagIds.length > 0) {
            await this.prisma.tag.updateMany({ where: { parentId: { in: tagIds } }, data: { parentId: null } });
            await this.prisma.repoTag.deleteMany({ where: { tagId: { in: tagIds } } });
            await this.prisma.tag.deleteMany({ where: { groupId: BigInt(id) } });
        }
        await this.prisma.tagGroup.delete({ where: { id: BigInt(id) } });
        this.logger.log(`已删除标签维度 id=${id} 及其 ${tagIds.length} 个标签`);
        return { deleted: tagIds.length };
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

    /**
     * 批量保存 AI 标签结果（原子操作）
     *
     * 支持三种格式：
     * A) 带维度前缀 — { "0": ["技术栈:Python","领域:AI/ML"], "1": ["用途:CLI Tool"] }
     *    → 解析 "维度名:标签名"，自动创建/匹配标签到对应维度
     * B) 无维度前缀 — { "0": ["Python","AI/ML"], "1": ["TypeScript"] }
     *    → 所有标签归入"✨ 自定义"维度
     * C) 旧分类格式 — { "Python": [0,1,2], "AI/ML": [0,3] }
     *    → key=标签名, value=仓库索引数组
     *
     * 维度名将匹配系统预置维度（技术栈/领域/用途/状态/服务人群/解决什么问题/生态/自定义），
     * 匹配不上的归入"✨ 自定义"。
     */
    async saveAiTagResult(repoIds: number[], tagAssignments: Record<string, string[]>) {
        this.logger.log(`保存AI标签结果: repoCount=${repoIds.length}, entries=${Object.keys(tagAssignments).length}`);

        // 判断格式：如果 key 是纯数字（如 "0"），则是 Agent 格式
        const keys = Object.keys(tagAssignments);
        const isAgentFormat = keys.length > 0 && /^\d+$/.test(keys[0]);

        // 中间结构：{ tagName, groupName } → repoId[]
        const tagMap = new Map<string, { groupName: string; tagName: string; repoIds: Set<number> }>();

        const addTag = (groupName: string, tagName: string, repoId: number) => {
            const key = `${groupName}::${tagName}`;
            if (!tagMap.has(key)) {
                tagMap.set(key, { groupName, tagName, repoIds: new Set() });
            }
            tagMap.get(key)!.repoIds.add(repoId);
        };

        if (isAgentFormat) {
            // Agent 格式: {"0": ["技术栈:Python", "领域:AI/ML"]}
            for (const [idxStr, tagEntries] of Object.entries(tagAssignments)) {
                const idx = parseInt(idxStr, 10);
                if (isNaN(idx) || idx < 0 || idx >= repoIds.length || !Array.isArray(tagEntries)) continue;
                const repoId = repoIds[idx];
                for (const entry of tagEntries) {
                    const raw = String(entry).trim();
                    if (!raw) continue;
                    // 解析 "维度:标签名" 或纯 "标签名"
                    const colonIdx = raw.indexOf(':');
                    if (colonIdx > 0) {
                        const groupPart = raw.substring(0, colonIdx).trim();
                        const tagPart = raw.substring(colonIdx + 1).trim();
                        if (!tagPart) continue;
                        // 匹配系统预置维度（模糊匹配）
                        const matchedGroup = this.matchGroupName(groupPart);
                        addTag(matchedGroup, tagPart, repoId);
                    } else {
                        // 无维度前缀 → 自定义
                        addTag('✨ 自定义', raw, repoId);
                    }
                }
            }
            this.logger.log(`Agent格式解析: ${tagMap.size} 个标签（含维度）`);
        } else {
            // 旧格式: {"Python": [0,1]}
            for (const [tagName, indices] of Object.entries(tagAssignments)) {
                if (!indices.length) continue;
                const name = String(tagName).trim();
                if (!name) continue;
                for (const idx of indices) {
                    const i = parseInt(String(idx), 10);
                    if (!isNaN(i) && i >= 0 && i < repoIds.length) {
                        addTag('✨ 自定义', name, repoIds[i]);
                    }
                }
            }
        }

        if (!tagMap.size) {
            this.logger.warn('没有有效的标签数据可保存');
            return;
        }

        // ── 第一步：批量清除旧 AI 标签 ──
        const repoBigInts = repoIds.map((id) => BigInt(id));
        await this.prisma.repoTag.deleteMany({
            where: { repoId: { in: repoBigInts }, source: 'ai' },
        });
        this.logger.log(`已清除 ${repoIds.length} 个仓库的旧 AI 标签`);

        // ── 第二步：逐个标签写入 ──
        for (const [, { groupName, tagName, repoIds: ids }] of tagMap) {
            // 查找或创建标签
            let tag = await this.prisma.tag.findFirst({ where: { name: tagName } });
            if (!tag) {
                const group = await this.prisma.tagGroup.findFirst({ where: { name: groupName } });
                const groupId = group?.id ?? BigInt(6);
                tag = await this.prisma.tag.create({ data: { name: tagName, groupId, repoCount: 0 } });
                this.logger.log(`创建标签: [${groupName}] ${tagName}`);
            } else {
                // 已有标签但在"自定义"维度 → 修正到正确维度
                const currentGroup = await this.prisma.tagGroup.findFirst({ where: { id: tag.groupId } });
                if (currentGroup?.name === '✨ 自定义' && groupName !== '✨ 自定义') {
                    const correctGroup = await this.prisma.tagGroup.findFirst({ where: { name: groupName } });
                    if (correctGroup) {
                        await this.prisma.tag.update({ where: { id: tag.id }, data: { groupId: correctGroup.id } });
                        this.logger.log(`标签维度修正: ${tagName} → ${groupName}`);
                    }
                }
            }

            // 批量写入 repo_tag 关联
            const tagId = tag.id;
            for (const repoId of ids) {
                await this.prisma.repoTag.upsert({
                    where: { repoId_tagId: { repoId: BigInt(repoId), tagId } },
                    create: { repoId: BigInt(repoId), tagId, source: 'ai' },
                    update: {}, // 已存在则跳过
                }).catch(() => {});
            }

            // 修正 repo_count
            const realCount = await this.prisma.repoTag.count({ where: { tagId } });
            await this.prisma.tag.update({ where: { id: tagId }, data: { repoCount: realCount } });
        }
        this.logger.log(`AI标签保存完成: ${tagMap.size} 个标签`);
    }

    /** 模糊匹配维度名 → 返回系统预置维度名（匹配不上返回"✨ 自定义"） */
    private matchGroupName(input: string): string {
        const lower = input.toLowerCase();
        for (const g of SYSTEM_GROUPS) {
            const name = g.name.replace(/^[^\s]+\s/, ''); // 去掉 emoji 前缀
            if (lower.includes(name.toLowerCase()) || name.includes(lower)) return g.name;
        }
        // 英文/简写映射
        const aliasMap: Record<string, string> = {
            'tech': '📚 技术栈', '技术': '📚 技术栈', '语言': '📚 技术栈', 'framework': '📚 技术栈',
            'domain': '🏷️ 领域', '领域': '🏷️ 领域', 'field': '🏷️ 领域',
            'use': '🔧 用途', '用途': '🔧 用途', 'usage': '🔧 用途', 'type': '🔧 用途',
            'status': '📊 状态', '状态': '📊 状态', 'state': '📊 状态',
            'audience': '👥 服务人群', '人群': '👥 服务人群', '用户': '👥 服务人群', 'who': '👥 服务人群',
            'problem': '💡 解决什么问题', '问题': '💡 解决什么问题', '解决': '💡 解决什么问题', 'why': '💡 解决什么问题',
            'eco': '🏢 生态', '生态': '🏢 生态', 'platform': '🏢 生态',
        };
        for (const [key, groupName] of Object.entries(aliasMap)) {
            if (lower.includes(key)) return groupName;
        }
        return '✨ 自定义';
    }
}
