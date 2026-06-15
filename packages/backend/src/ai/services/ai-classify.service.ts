import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '../../config/config.service';
import { PrismaService } from '../../prisma/prisma.service';
import { GithubRepoService } from '../../github/services/github-repo.service';
import { CategoryService } from '../../category/category.service';

@Injectable()
export class AiClassifyService {
    private readonly logger = new Logger(AiClassifyService.name);
    constructor(
        private readonly config: ConfigService,
        private readonly prisma: PrismaService,
        private readonly githubRepo: GithubRepoService,
        private readonly categoryService: CategoryService,
    ) {}

    /**
     * 调用 DeepSeek API 发送分类请求
     *
     * 从系统配置读取 API 信息，发送 chat completions 请求，并清理返回结果中的 markdown 代码块标记。
     *
     * @param prompt 用户提示词
     * @param systemMsg 可选的系统角色消息
     * @returns AI 返回的 JSON 字符串（已清理 markdown 标记），失败返回 null
     */
    private async callDeepSeek(prompt: string, systemMsg?: string): Promise<string | null> {
        const apiKey = await this.config.getValue('deepseek.api_key');
        const apiUrl = await this.config.getValueDefault('deepseek.api_url', 'https://api.deepseek.com/v1/chat/completions');
        const model = await this.config.getValueDefault('deepseek.model', 'deepseek-chat');
        if (!apiKey) {
            this.logger.error('DeepSeek API Key 未配置，无法执行 AI 分类');
            return null;
        }
        const msgs: any[] = [];
        if (systemMsg) msgs.push({ role: 'system', content: systemMsg });
        msgs.push({ role: 'user', content: prompt });
        try {
            const res = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
                body: JSON.stringify({ model, temperature: 0.3, max_tokens: 4096, messages: msgs }),
            });
            if (!res.ok) {
                this.logger.error('DeepSeek API 返回非 200: status=' + res.status);
                return null;
            }
            const data = await res.json();
            let content = data.choices?.[0]?.message?.content?.trim() || null;
            if (content)
                content = content
                    .replace(/^```json\s*/i, '')
                    .replace(/^```\s*/i, '')
                    .replace(/```$/i, '')
                    .trim();
            return content;
        } catch (e) {
            this.logger.error('DeepSeek 分类 API 调用异常: ' + (e instanceof Error ? e.message : String(e)));
            return null;
        }
    }

    /**
     * 解析 AI 返回的分类结果 JSON
     *
     * 将 AI 返回的 JSON 字符串解析为 {分类名: [仓库ID数组]} 映射，
     * 同时进行索引校验（越界忽略）和类型转换（BigInt -> Number）。
     *
     * @param jsonStr AI 返回的原始 JSON 字符串
     * @param repos 原始仓库列表（用于索引校验）
     * @returns 分类名到仓库 ID 数组的映射，解析失败返回兜底分类
     */
    private parseResponse(jsonStr: string | null, repos: any[]): Record<string, number[]> {
        if (!jsonStr) return { 分类失败: [] };
        try {
            const parsed = JSON.parse(jsonStr) as Record<string, (number | string)[]>;
            const result: Record<string, number[]> = {};
            for (const [name, indices] of Object.entries(parsed)) {
                if (!Array.isArray(indices) || !indices.length) continue;
                const ids: number[] = [];
                for (const idx of indices) {
                    const i = typeof idx === 'number' ? idx : parseInt(String(idx), 10);
                    if (!isNaN(i) && i >= 0 && i < repos.length) ids.push(Number(repos[i].id));
                }
                if (ids.length) result[name] = ids;
            }
            if (!Object.keys(result).length) result['未能分类'] = repos.map((r) => Number(r.id));
            return result;
        } catch (e) {
            this.logger.error('AI 分类结果 JSON 解析失败: ' + (e instanceof Error ? e.message : String(e)));
            return { 解析失败: [], 未能分类: repos.map((r) => Number(r.id)) };
        }
    }

    /**
     * 构建普通分类提示词（P1-13 FIX: 使用 repoName 而非 fullName）
     *
     * 将仓库列表格式化为可供 AI 分类的文本，限制分类数量不超过 topN。
     *
     * @param repos 仓库列表
     * @param topN 最大分类数量
     * @returns 分类提示词字符串
     */
    private buildPrompt(repos: any[], topN: number): string {
        const list = repos
            .map((r, i) => {
                const name = r.repoName || (r.fullName ? r.fullName.split('/').pop() : '');
                const desc = String(r.descriptionCn || r.description || '').substring(0, 200);
                return `${i}. **${name}** | ${r.language || '未知'} | ${desc}${r.topics ? ' | Tags:' + r.topics : ''}`;
            })
            .join('\n');
        return `将以下项目归类到不超过 ${topN} 个分类。只返回 JSON（不要 markdown 代码块）：\n{"分类名1": [序号], "分类名2": [序号]}\n\n${list}`;
    }

    /**
     * 构建智能分类提示词（P1-9 FIX: 只收集 level===2 的分类名；P1-10 FIX: 优先匹配现有分类）
     *
     * 从数据库加载现有 L2 分类名作为提示，引导 AI 优先归入已有分类。
     *
     * @param repos 仓库列表
     * @returns 智能分类提示词字符串
     */
    private async buildSmartPrompt(repos: any[]): Promise<string> {
        const all = await this.categoryService.listAll();
        // P1-9: 仅 L2 分类
        const names: string[] = [];
        for (const cat of all) {
            if (cat.level === 2) names.push(cat.name);
            if (cat.children) for (const child of cat.children) if (child.level === 2) names.push(child.name);
        }
        const catsHint = names.length > 0 ? `\n现有分类（优先匹配）：${names.join('、')}\n` : '';
        const list = repos
            .map((r, i) => {
                const desc = String(r.descriptionCn || r.description || '').substring(0, 200);
                return `${i}. **${r.fullName}** | ${r.language || '未知'} | ${desc}`;
            })
            .join('\n');
        // P1-10: 优先匹配强调
        return `请对这些 GitHub 项目进行智能分类。${catsHint}\n
【重要】优先将项目归入现有分类。只有当前分类都不匹配时，才创建新分类。

只返回 JSON：\n{"分类名1": [序号], "分类名2": [序号]}\n\n${list}`;
    }

    /**
     * 执行普通分类（无需考虑现有分类体系）
     *
     * 流程：查询仓库 → 构建提示词 → 调用 DeepSeek → 解析结果 → 保存分类。
     *
     * @param repoIds 仓库 ID 列表
     * @param topN 最大分类数量（默认 8）
     * @returns 分类结果，包含分类映射和分类总数
     */
    async classify(repoIds: number[], topN = 8) {
        if (!repoIds?.length) return { success: false, message: '没有需要分类的仓库' };
        this.logger.log('开始普通分类: repoCount=' + repoIds.length + ', topN=' + topN);
        // FIX: 批量查询替代循环 N+1 查询
        const repos = await this.prisma.githubRepo.findMany({ where: { id: { in: repoIds.map(BigInt) } } });
        if (!repos.length) return { success: false, message: '没有找到仓库' };
        const prompt = this.buildPrompt(repos, topN);
        const result = await this.callDeepSeek(prompt, '你是GitHub项目推荐专家。只返回要求格式的JSON，不说任何废话。');
        const cats = this.parseResponse(result, repos);
        if (cats && !cats['分类失败']) {
            try {
                await this.categoryService.saveAiClassifyResult(cats);
                this.logger.log('普通分类结果已保存: categoryCount=' + Object.keys(cats).length);
            } catch (e) {
                this.logger.error('保存分类结果失败: ' + (e instanceof Error ? e.message : String(e)));
                return { success: false, message: '保存失败: ' + (e instanceof Error ? e.message : String(e)), categories: cats };
            }
        }
        return { success: true, categories: cats, totalClassified: Object.values(cats).reduce((s, ids) => s + ids.length, 0) };
    }

    /**
     * 执行智能分类（兼容现有分类体系）
     *
     * 与普通分类的区别：提示词中会包含现有 L2 分类名，引导 AI 优先匹配。
     * 同时统计匹配到已有分类 vs 新建分类的数量。
     *
     * @param repoIds 仓库 ID 列表
     * @returns 分类映射、匹配数、新建数
     */
    async smartClassify(repoIds: number[]) {
        if (!repoIds?.length) return { success: false, message: '没有需要分类的仓库' };
        this.logger.log('开始智能分类: repoCount=' + repoIds.length);
        // FIX: 批量查询替代循环 N+1 查询
        const repos = await this.prisma.githubRepo.findMany({ where: { id: { in: repoIds.map(BigInt) } } });
        if (!repos.length) return { success: false, message: '没有找到仓库' };
        const prompt = await this.buildSmartPrompt(repos);
        const result = await this.callDeepSeek(prompt, '你是GitHub项目推荐专家。只返回要求格式的JSON，不说任何废话。');
        const assignments = this.parseResponse(result, repos);
        if (assignments && !assignments['分类失败']) {
            try {
                await this.categoryService.applySmartClassifyResult(assignments);
                this.logger.log('智能分类结果已应用: categoryCount=' + Object.keys(assignments).length);
            } catch (e) {
                this.logger.error('应用智能分类结果失败: ' + (e instanceof Error ? e.message : String(e)));
                return { success: false, message: '保存失败: ' + (e instanceof Error ? e.message : String(e)), assignments };
            }
        }
        const allCats = await this.categoryService.listAll();
        const allNames = allCats.flatMap((c) => [c.name, ...(c.children || []).map((ch) => ch.name)]);
        let matchCount = 0,
            newCount = 0;
        for (const name of Object.keys(assignments)) {
            if (allNames.includes(name)) matchCount++;
            else newCount++;
        }
        this.logger.log('智能分类完成: matchCount=' + matchCount + ', newCount=' + newCount);
        return { success: true, assignments, matchCount, newCount };
    }
}
