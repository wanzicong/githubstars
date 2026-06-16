import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/** 系统预置标签维度定义（从数据库动态加载，此处仅定义默认项） */
const SYSTEM_GROUPS = [
    { name: '📚 技术栈', color: '#1677ff', icon: 'code' },
    { name: '🏷️ 领域', color: '#52c41a', icon: 'appstore' },
    { name: '🔧 用途', color: '#fa8c16', icon: 'tool' },
    { name: '📊 状态', color: '#eb2f96', icon: 'flag' },
    { name: '👥 服务人群', color: '#722ed1', icon: 'team' },
    { name: '💡 解决什么问题', color: '#13c2c2', icon: 'bulb' },
];

@Injectable()
export class TagService {
    private readonly logger = new Logger(TagService.name);

    constructor(private readonly prisma: PrismaService) {}

    /** 确保系统预置标签维度存在（缺失则自动创建，废弃维度自动迁移清理） */
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

        // ── 清理废弃维度：生态（无标签直接删除）、自定义（迁移标签到"用途"后删除）──
        const LEGACY_GROUPS = ['🏢 生态', '✨ 自定义'];
        for (const legacyName of LEGACY_GROUPS) {
            const legacy = await this.prisma.tagGroup.findFirst({ where: { name: legacyName } });
            if (!legacy) continue;
            const tags = await this.prisma.tag.findMany({ where: { groupId: legacy.id }, select: { id: true, name: true } });
            if (tags.length > 0) {
                // 迁移标签到 🔧 用途
                const targetGroup = await this.prisma.tagGroup.findFirst({ where: { name: '🔧 用途' } });
                if (targetGroup) {
                    await this.prisma.tag.updateMany({
                        where: { groupId: legacy.id },
                        data: { groupId: targetGroup.id },
                    });
                    this.logger.log(`已将 "${legacyName}" 下 ${tags.length} 个标签迁移到 "🔧 用途": ${tags.map((t) => t.name).join(', ')}`);
                }
            }
            await this.prisma.tagGroup.delete({ where: { id: legacy.id } });
            this.logger.log(`已删除废弃维度: ${legacyName}`);
        }
    }

    /**
     * 获取所有标签维度及其标签（树形结构）
     *
     * 支持传入筛选上下文（language / keyword / contextTagIds），
     * 此时每个标签的 repoCount 将动态计算为"在当前筛选条件下同时拥有该标签的仓库数"，
     * 而非全局数量。未传筛选参数时复用已有的 repoCount 字段（性能优化）。
     *
     * @param filters.language      逗号分隔的编程语言筛选
     * @param filters.keyword       仓库名/描述全文搜索关键词
     * @param filters.contextTagIds 已选中的标签 ID 数组（作为 AND 条件叠加）
     *
     * @callers TagController.all()
     * @depends Prisma github_repo / repo_tag / tag_group / tag 表
     */
    async listAll(filters?: { language?: string; keyword?: string; contextTagIds?: number[] }) {
        await this.ensureSystemGroups();
        const groups = await this.prisma.tagGroup.findMany({ orderBy: { sortOrder: 'asc' } });
        const tags = await this.prisma.tag.findMany({ orderBy: [{ repoCount: 'desc' }, { name: 'asc' }] });

        const hasFilters = !!(filters?.language || filters?.keyword || filters?.contextTagIds?.length);

        if (!hasFilters) {
            // ── 无筛选：全局计数（已有逻辑，同步 repoCount 字段）──
            const counts = await this.prisma.repoTag.groupBy({ by: ['tagId'], _count: { tagId: true } });
            const countMap = new Map<string, number>();
            for (const c of counts) countMap.set(String(c.tagId), c._count.tagId);
            for (const tag of tags) {
                const realCount = countMap.get(String(tag.id)) || 0;
                if (Number(tag.repoCount) !== realCount) {
                    await this.prisma.tag.update({ where: { id: tag.id }, data: { repoCount: realCount } }).catch(() => {});
                }
                (tag as any).repoCount = realCount;
            }
        } else {
            // ── 有筛选：构建仓库级 WHERE 条件，聚合计算标签动态计数 ──
            const repoAND: any[] = [];

            // 编程语言筛选
            if (filters.language) {
                const languages = filters.language
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean);
                if (languages.length > 0) {
                    repoAND.push({ language: { in: languages } });
                }
            }

            // 关键词搜索
            if (filters.keyword) {
                const kw = filters.keyword.trim();
                if (kw) {
                    repoAND.push({
                        OR: [
                            { repoName: { contains: kw } },
                            { description: { contains: kw } },
                            { ownerName: { contains: kw } },
                            { fullName: { contains: kw } },
                        ],
                    });
                }
            }

            // 已选标签上下文（AND 叠加：仓库必须拥有所有 contextTagIds）
            if (filters.contextTagIds?.length) {
                for (const tagId of filters.contextTagIds) {
                    repoAND.push({ repoTags: { some: { tagId: BigInt(tagId) } } });
                }
            }

            const repoWhere = repoAND.length > 0 ? { AND: repoAND } : {};

            // 查询匹配仓库 ID 列表
            const matchingRepos = await this.prisma.githubRepo.findMany({
                where: repoWhere,
                select: { id: true },
            });
            const repoIds = matchingRepos.map((r) => r.id);

            if (repoIds.length === 0) {
                // 无匹配仓库 → 所有标签计数为 0
                for (const tag of tags) {
                    (tag as any).repoCount = 0;
                }
            } else {
                // 在匹配仓库范围内按标签聚合计数
                const counts = await this.prisma.repoTag.groupBy({
                    by: ['tagId'],
                    where: { repoId: { in: repoIds } },
                    _count: { tagId: true },
                });
                const countMap = new Map<string, number>();
                for (const c of counts) countMap.set(String(c.tagId), c._count.tagId);
                for (const tag of tags) {
                    (tag as any).repoCount = countMap.get(String(tag.id)) || 0;
                }
            }
        }

        return groups.map((g) => ({
            ...g,
            tags: tags.filter((t) => Number(t.groupId) === Number(g.id)),
        }));
    }

    /** 根据维度名称查找 groupId，找不到回退到"用途"维度 */
    async resolveGroupId(groupName: string): Promise<bigint> {
        const group = await this.prisma.tagGroup.findFirst({ where: { name: groupName } });
        if (group) return group.id;
        // 回退到"🔧 用途"
        const fallback = await this.prisma.tagGroup.findFirst({ where: { name: '🔧 用途' } });
        return fallback?.id ?? BigInt(1);
    }

    /** 获取单个标签详情 */
    async getById(id: number) {
        return this.prisma.tag.findUnique({ where: { id: BigInt(id) }, include: { group: true } });
    }

    /** 创建标签 */
    async create(name: string, groupId: number, description?: string, color?: string, icon?: string, parentId?: number) {
        const trimmed = name.trim();
        const exist = await this.prisma.tag.findFirst({ where: { name: trimmed, groupId: BigInt(groupId) } });
        if (exist) throw new Error(`标签 "${trimmed}" 在此维度下已存在`);
        return this.prisma.tag.create({
            data: {
                name: trimmed,
                groupId: BigInt(groupId),
                description: description || null,
                color: color || null,
                icon: icon || null,
                parentId: parentId ? BigInt(parentId) : null,
            },
        });
    }

    /** 创建标签维度（仅管理员使用） */
    async createGroup(name: string, color?: string, icon?: string) {
        const exist = await this.prisma.tagGroup.findUnique({ where: { name } });
        if (exist) throw new Error(`维度 "${name}" 已存在`);
        const maxSort = await this.prisma.tagGroup.findFirst({ orderBy: { sortOrder: 'desc' }, select: { sortOrder: true } });
        return this.prisma.tagGroup.create({
            data: { name, color: color || '#1677ff', icon: icon || null, sortOrder: (maxSort?.sortOrder || 0) + 1 },
        });
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
     *    → 所有标签归入"🔧 用途"维度
     * C) 旧分类格式 — { "Python": [0,1,2], "AI/ML": [0,3] }
     *    → key=标签名, value=仓库索引数组
     *
     * 维度名将匹配系统预置维度（技术栈/领域/用途/状态/服务人群/解决什么问题），
     * 匹配不上的归入"🔧 用途"。
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
                        // 无维度前缀 → 用途
                        addTag('🔧 用途', raw, repoId);
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
                        addTag('🔧 用途', name, repoIds[i]);
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
                let group = await this.prisma.tagGroup.findFirst({ where: { name: groupName } });
                // 回退：找不到目标维度时使用"🔧 用途"
                if (!group) {
                    group = await this.prisma.tagGroup.findFirst({ where: { name: '🔧 用途' } });
                }
                const groupId = group?.id ?? BigInt(1);
                tag = await this.prisma.tag.create({ data: { name: tagName, groupId, repoCount: 0 } });
                this.logger.log(`创建标签: [${groupName}] ${tagName}`);
            } else {
                // 已有标签但在"用途"维度 → 修正到正确维度
                const currentGroup = await this.prisma.tagGroup.findFirst({ where: { id: tag.groupId } });
                if (currentGroup?.name === '🔧 用途' && groupName !== '🔧 用途') {
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
                await this.prisma.repoTag
                    .upsert({
                        where: { repoId_tagId: { repoId: BigInt(repoId), tagId } },
                        create: { repoId: BigInt(repoId), tagId, source: 'ai' },
                        update: {}, // 已存在则跳过
                    })
                    .catch(() => {});
            }

            // 修正 repo_count
            const realCount = await this.prisma.repoTag.count({ where: { tagId } });
            await this.prisma.tag.update({ where: { id: tagId }, data: { repoCount: realCount } });
        }
        this.logger.log(`AI标签保存完成: ${tagMap.size} 个标签`);
    }

    /** 模糊匹配维度名 → 返回系统预置维度名（匹配不上回退"🔧 用途"） */
    private matchGroupName(input: string): string {
        const lower = input.toLowerCase();
        for (const g of SYSTEM_GROUPS) {
            const name = g.name.replace(/^[^\s]+\s/, ''); // 去掉 emoji 前缀
            if (lower.includes(name.toLowerCase()) || name.includes(lower)) return g.name;
        }
        // 英文/简写映射
        const aliasMap: Record<string, string> = {
            tech: '📚 技术栈',
            技术: '📚 技术栈',
            语言: '📚 技术栈',
            framework: '📚 技术栈',
            domain: '🏷️ 领域',
            领域: '🏷️ 领域',
            field: '🏷️ 领域',
            use: '🔧 用途',
            用途: '🔧 用途',
            usage: '🔧 用途',
            type: '🔧 用途',
            status: '📊 状态',
            状态: '📊 状态',
            state: '📊 状态',
            audience: '👥 服务人群',
            人群: '👥 服务人群',
            用户: '👥 服务人群',
            who: '👥 服务人群',
            problem: '💡 解决什么问题',
            问题: '💡 解决什么问题',
            解决: '💡 解决什么问题',
            why: '💡 解决什么问题',
        };
        for (const [key, groupName] of Object.entries(aliasMap)) {
            if (lower.includes(key)) return groupName;
        }
        return '🔧 用途';
    }

    /** 设置标签的父标签（建立层级关系） */
    async setParent(tagId: number, parentId: number | null) {
        if (parentId !== null) {
            // 防止循环引用
            let p: any = await this.prisma.tag.findUnique({ where: { id: BigInt(parentId) }, select: { parentId: true } });
            while (p) {
                if (Number(p.parentId) === tagId) throw new Error('不能将标签设为其子标签的父级，会造成循环引用');
                if (!p.parentId) break;
                p = await this.prisma.tag.findUnique({ where: { id: p.parentId }, select: { parentId: true } });
            }
        }
        await this.prisma.tag.update({ where: { id: BigInt(tagId) }, data: { parentId: parentId !== null ? BigInt(parentId) : null } });
    }

    /** 获取完整的标签树（维度 → 父标签 → 子标签） */
    async getTree() {
        await this.ensureSystemGroups();
        const groups = await this.prisma.tagGroup.findMany({ orderBy: { sortOrder: 'asc' } });
        const tags = await this.prisma.tag.findMany({ orderBy: [{ repoCount: 'desc' }, { name: 'asc' }] });
        const counts = await this.prisma.repoTag.groupBy({ by: ['tagId'], _count: { tagId: true } });
        const countMap = new Map<string, number>();
        for (const c of counts) countMap.set(String(c.tagId), c._count.tagId);

        const tagMap = new Map<string, any>();
        for (const tag of tags) {
            const realCount = countMap.get(String(tag.id)) || 0;
            const node = { ...tag, repoCount: realCount, children: [] as any[] };
            tagMap.set(String(tag.id), node);
        }

        const roots: any[] = [];
        for (const [, node] of tagMap) {
            if (node.parentId) {
                const parent = tagMap.get(String(node.parentId));
                if (parent) parent.children.push(node);
                else roots.push(node);
            } else {
                roots.push(node);
            }
        }

        return groups.map((g) => ({
            ...g,
            tags: roots.filter((t) => Number(t.groupId) === Number(g.id)),
        }));
    }

    /**
     * 设置标签维度（TagGroup）的父维度，建立维度树形层级
     *
     * 用于建立维度间的钻取关系，例如：技术栈(父) → 领域(子) → 用途(孙)。
     * 检测循环引用，防止把维度设为其子孙的子级。
     *
     * @param groupId 当前维度 ID
     * @param parentGroupId 目标父维度 ID，传 null 解除父级
     *
     * @callers TagController.setGroupParent()
     * @depends Prisma tagGroup 表
     */
    async setGroupParent(groupId: number, parentGroupId: number | null) {
        if (parentGroupId !== null) {
            if (parentGroupId === groupId) throw new Error('维度不能将自己设为父级');
            // 沿父链向上查找，防止循环引用
            let p: any = await this.prisma.tagGroup.findUnique({ where: { id: BigInt(parentGroupId) }, select: { parentId: true } });
            const visited = new Set<number>([parentGroupId]);
            while (p && p.parentId) {
                const pid = Number(p.parentId);
                if (pid === groupId) throw new Error('不能将维度设为其子孙维度的父级，会造成循环引用');
                if (visited.has(pid)) break;
                visited.add(pid);
                p = await this.prisma.tagGroup.findUnique({ where: { id: p.parentId }, select: { parentId: true } });
            }
        }
        await this.prisma.tagGroup.update({
            where: { id: BigInt(groupId) },
            data: { parentId: parentGroupId !== null ? BigInt(parentGroupId) : null },
        });
        this.logger.log(`维度 ${groupId} 的父维度设为: ${parentGroupId ?? '(无)'}`);
    }

    /**
     * 获取维度树（按维度间的 parentId 组装）
     *
     * 返回顶级维度 + children 嵌套，每个维度内附 tags（已扁平排序）。
     * 用于前端展示树形维度结构。
     *
     * @callers TagController.groupTree()
     */
    async getGroupTree() {
        await this.ensureSystemGroups();
        const groups = await this.prisma.tagGroup.findMany({ orderBy: { sortOrder: 'asc' } });
        const tags = await this.prisma.tag.findMany({ orderBy: [{ repoCount: 'desc' }, { name: 'asc' }] });
        const counts = await this.prisma.repoTag.groupBy({ by: ['tagId'], _count: { tagId: true } });
        const countMap = new Map<string, number>();
        for (const c of counts) countMap.set(String(c.tagId), c._count.tagId);

        const groupMap = new Map<string, any>();
        for (const g of groups) {
            const groupTags = tags
                .filter((t) => Number(t.groupId) === Number(g.id))
                .map((t) => ({ ...t, repoCount: countMap.get(String(t.id)) || 0 }));
            groupMap.set(String(g.id), { ...g, tags: groupTags, children: [] as any[] });
        }

        const roots: any[] = [];
        for (const [, node] of groupMap) {
            if (node.parentId) {
                const parent = groupMap.get(String(node.parentId));
                if (parent) parent.children.push(node);
                else roots.push(node);
            } else {
                roots.push(node);
            }
        }
        return roots;
    }

    /**
     * 获取标签下钻分布：某个标签下的项目，在指定子维度下的标签分布统计
     *
     * 例如：选中"技术栈:Python"，目标子维度是"领域"，
     * 返回这 214 个 Python 项目分布在"领域"维度的各个标签下的数量。
     *
     * @param tagId 父维度下选中的标签 ID
     * @param targetGroupId 目标子维度 ID（可选，不传则返回所有其他维度的分布）
     * @returns 按维度分组的标签分布统计
     *
     * @callers TagController.getDistribution()
     */
    async getTagDistribution(tagId: number, targetGroupId?: number) {
        // 1. 找到该标签下的所有 repoId
        const sourceRepoTags = await this.prisma.repoTag.findMany({
            where: { tagId: BigInt(tagId) },
            select: { repoId: true },
        });
        const repoIds = sourceRepoTags.map((rt) => rt.repoId);
        const totalRepos = repoIds.length;

        if (!totalRepos) return { totalRepos: 0, distributions: [] };

        // 2. 拉取这些 repo 的所有其他标签关联
        const allRepoTags = await this.prisma.repoTag.findMany({
            where: {
                repoId: { in: repoIds },
                tagId: { not: BigInt(tagId) },
            },
            include: { tag: { include: { group: true } } },
        });

        // 3. 按 (groupId, tagId) 聚合计数
        const aggregator = new Map<
            string,
            {
                groupId: bigint;
                groupName: string;
                groupColor: string;
                groupIcon: string | null;
                tagId: bigint;
                tagName: string;
                tagColor: string | null;
                count: number;
            }
        >();
        for (const rt of allRepoTags) {
            const gid = String(rt.tag.groupId);
            if (targetGroupId !== undefined && targetGroupId !== null && gid !== String(targetGroupId)) continue;
            const key = `${gid}::${String(rt.tag.id)}`;
            if (!aggregator.has(key)) {
                aggregator.set(key, {
                    groupId: rt.tag.groupId,
                    groupName: rt.tag.group.name,
                    groupColor: rt.tag.group.color,
                    groupIcon: rt.tag.group.icon,
                    tagId: rt.tag.id,
                    tagName: rt.tag.name,
                    tagColor: rt.tag.color,
                    count: 0,
                });
            }
            aggregator.get(key)!.count++;
        }

        // 4. 按维度分组组装
        const groupBuckets = new Map<
            string,
            { groupId: number; groupName: string; groupColor: string; groupIcon: string | null; tags: any[] }
        >();
        for (const item of aggregator.values()) {
            const gid = String(item.groupId);
            if (!groupBuckets.has(gid)) {
                groupBuckets.set(gid, {
                    groupId: Number(item.groupId),
                    groupName: item.groupName,
                    groupColor: item.groupColor,
                    groupIcon: item.groupIcon,
                    tags: [],
                });
            }
            groupBuckets.get(gid)!.tags.push({
                tagId: Number(item.tagId),
                tagName: item.tagName,
                tagColor: item.tagColor,
                count: item.count,
                percentage: Math.round((item.count / totalRepos) * 100),
            });
        }

        // 每个维度内按 count 降序
        const distributions = Array.from(groupBuckets.values()).map((g) => ({
            ...g,
            tags: g.tags.sort((a, b) => b.count - a.count),
        }));

        return { totalRepos, distributions };
    }
}
