import { Injectable, Logger } from '@nestjs/common';
import { TagService } from '../tag/tag.service';

/**
 * 提示词管理服务
 *
 * 职责：集中管理所有 AI/Agent 相关的提示词构建逻辑。
 * 提示词中涉及的标签维度、标签列表等信息统一从数据库动态加载，
 * 不在提示词中硬编码维度名称或示例。
 *
 * 维度元数据（描述和示例标签）作为轻量配置存放在本服务中，
 * 便于后续迁移到数据库字段或系统配置表。
 *
 * @callers
 *   - AgentTagService.processBatch() — Agent 打标签提示词
 *
 * @depends
 *   - TagService.listAll() — 从数据库获取完整的标签维度+标签树
 */
@Injectable()
export class PromptService {
    private readonly logger = new Logger(PromptService.name);

    constructor(private readonly tagService: TagService) {}

    /**
     * 维度元信息映射（key = 去掉 emoji 后的维度名）
     *
     * 这是本服务唯一的"配置级"硬编码。维度名称和标签列表均从数据库加载，
     * 仅描述和示例标签作为元信息在此维护，便于后续迁移到 system_config 表或 tag_group 扩展字段。
     */
    private readonly DIMENSION_META: Record<string, { desc: string; examples: string }> = {
        '技术栈': { desc: '编程语言、框架、运行时、数据库', examples: 'Python, React, Docker, PostgreSQL' },
        '领域': { desc: '应用领域、行业方向', examples: 'AI/ML, 安全, 金融, DevOps, 游戏' },
        '用途': { desc: '项目类型/形态', examples: 'CLI工具, 库/SDK, Web应用, 桌面应用, 爬虫' },
        '状态': { desc: '关注程度/使用状态', examples: '活跃关注, 学习参考, 已归档, 待评估' },
        '服务人群': { desc: '目标用户群体', examples: '开发者, 企业, 个人用户, 学生' },
        '解决问题': { desc: '项目解决的核心痛点', examples: '自动化, 数据分析, 效率提升, 可视化' },
    };

    /** 维度简称 → 维度全名映射（Agent 输出解析用） */
    private readonly SHORTHAND_MAP: Record<string, string> = {
        '技术栈': '技术栈', '领域': '领域', '用途': '用途',
        '状态': '状态', '服务人群': '服务人群', '解决问题': '解决问题',
    };

    /**
     * 去掉维度名中的 emoji 前缀，返回纯文本名称
     */
    private stripEmoji(name: string): string {
        return name.replace(/^[^\w一-鿿]+/, '').trim();
    }

    /**
     * 获取维度简称列表（用于 Agent 输出格式约束）
     */
    getDimensionShorthands(): string[] {
        return Object.keys(this.SHORTHAND_MAP);
    }

    /**
     * 根据维度简称查找完整维度名（含 emoji）
     */
    async resolveFullGroupName(shorthand: string): Promise<string | null> {
        const base = this.SHORTHAND_MAP[shorthand];
        if (!base) return null;
        const groups = await this.tagService.listAll();
        const match = groups.find((g: any) => this.stripEmoji(g.name) === base);
        return match?.name ?? null;
    }

    /**
     * 动态构建标签体系表格提示词
     *
     * 从数据库加载所有标签维度及标签列表，生成 Agent 可理解的维度说明表格。
     * 维度名称和标签数据完全来自数据库，仅描述和示例标签从 DIMENSION_META 补充。
     *
     * @returns Markdown 格式的维度说明表格，用于嵌入 Agent 系统提示词
     */
    async buildTagDimensionTable(): Promise<string> {
        const groups = await this.tagService.listAll();

        if (!groups.length) {
            this.logger.warn('标签体系为空，使用默认提示词');
            return '（暂无标签体系，请先执行 Agent 智能打标签）';
        }

        const rows: string[] = [];
        for (const g of groups) {
            const groupData = g as any;
            const baseName = this.stripEmoji(groupData.name);
            const meta = this.DIMENSION_META[baseName] || {
                desc: `${baseName}相关`,
                examples: groupData.tags?.slice(0, 3).map((t: any) => t.name).join(', ') || '—',
            };
            // 取该维度下 repoCount 最高的 3 个标签作为示例
            const topTags = (groupData.tags || [])
                .slice(0, 3)
                .map((t: any) => t.name)
                .join(', ') || meta.examples;
            rows.push(`| ${baseName} | ${meta.desc} | ${topTags} |`);
        }

        return [
            '## 标签维度（每个标签格式: "维度简称:标签名"，维度简称用下表左列）',
            '| 维度简称 | 含义 | 现有标签示例（来自数据库） |',
            '|---------|------|---------------------------|',
            ...rows,
        ].join('\n');
    }

    /**
     * 构建完整的 Agent 打标签系统提示词
     *
     * @param repoIndexText 仓库索引列表文本（序号. 仓库名 (语言, ⭐Star数) [ID:xxx]）
     * @param repoCount 仓库数量
     * @param tagSystem 现有标签体系文本（由 AgentTagService 构建）
     * @returns 完整的 Agent 系统提示词
     */
    async buildAgentTagPrompt(
        repoIndexText: string,
        repoCount: number,
        tagSystem: string,
    ): Promise<string> {
        const dimensionTable = await this.buildTagDimensionTable();
        const shorthands = this.getDimensionShorthands().join('/');

        return `你是 GitHub 项目分类专家。为以下 ${repoCount} 个项目打标签（每个项目 2-6 个标签）。

                ⚠️ 你只有 2 个工具可用，不要尝试 Read/Write/Grep/WebSearch/ToolSearch 等其他工具。

                ## 工具
                - get_repo_details(repoIds): 批量获取项目描述/README/Topics/语言，一次传入所有ID
                - search_tags(keyword): 搜索现有标签，匹配后优先复用

                ## 现有标签体系（供 search_tags 查询）
                ${tagSystem}

                ${dimensionTable}

                ## 项目列表（索引从 0 起）
                ${repoIndexText}

                ## 规则
                1. **先查后判**：用 get_repo_details 一次性获取全部项目详情
                2. **优先复用**：用 search_tags 按关键词搜索已有标签，匹配则复用，避免创建语义重复标签
                3. **维度必标**：每个标签格式为 "维度简称:标签名"，维度简称只限: ${shorthands}
                4. **覆盖≥3个维度**：每个项目至少覆盖 技术栈 + 领域 + 用途，其余维度按实际情况选填
                5. **信息不足时**：描述/README 为空的项目，仅根据语言、Topics、项目名判断，标签宁少勿滥
                6. **同维度上限**：同一项目的同一维度下标签 ≤ 2 个，避免标签堆砌
                7. **新建标签**：中文命名，2-6字。无法归入现有维度时优先归入"用途"
                8. **只输出 JSON**，其他文字一律不要：
                \`\`\`
                {"0":["技术栈:Python","领域:AI/ML","用途:库/SDK"],"1":["技术栈:Rust","领域:系统工具","用途:CLI工具"]}
                \`\`\`
                9. **自查清单**（输出前逐项确认）：每个项目≥3个维度？格式是"简称:名称"？维度简称在${shorthands}之中？无多余文字？`;
                    }
}
