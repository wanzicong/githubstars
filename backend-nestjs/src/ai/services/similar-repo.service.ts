import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '../../config/config.service';
import { GithubRepoService } from '../../github/services/github-repo.service';
import { GithubApiService } from '../../github/services/github-api.service';

const MAX_RESULTS = 20;
const MIN_STARS = 100;

@Injectable()
export class SimilarRepoService {
    private readonly logger = new Logger(SimilarRepoService.name);
    constructor(
        private readonly config: ConfigService,
        private readonly githubRepo: GithubRepoService,
        private readonly githubApi: GithubApiService,
    ) {}

    /**
     * 调用 DeepSeek API（P1-11 FIX: 加入 system message 角色提示）
     *
     * @param prompt 用户提示词
     * @param systemMsg 可选的系统角色消息
     * @returns AI 返回的文本内容，失败返回 null
     */
    private async callDeepSeek(prompt: string, systemMsg?: string): Promise<string | null> {
        const apiKey = await this.config.getValue('deepseek.api_key');
        const apiUrl = await this.config.getValueDefault('deepseek.api_url', 'https://api.deepseek.com/v1/chat/completions');
        const model = await this.config.getValueDefault('deepseek.model', 'deepseek-chat');
        if (!apiKey) return null;
        const msgs: any[] = [];
        if (systemMsg) msgs.push({ role: 'system', content: systemMsg });
        msgs.push({ role: 'user', content: prompt });
        try {
            const res = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
                body: JSON.stringify({ model, temperature: 0.5, max_tokens: 2048, messages: msgs }),
            });
            if (!res.ok) return null;
            const data = (await res.json()) as any;
            return data.choices?.[0]?.message?.content?.trim() || null;
        } catch {
            return null;
        }
    }

    /**
     * 解析仓库的 topics 字段（JSON 字符串 -> 字符串数组）
     *
     * @param topicsStr topics JSON 字符串
     * @returns topics 字符串数组，解析失败返回空数组
     */
    private parseTopics(topicsStr: string | null): string[] {
        if (!topicsStr) return [];
        try {
            return JSON.parse(topicsStr);
        } catch {
            return [];
        }
    }

    /**
     * 通过 AI 从仓库描述和 README 中提取搜索关键词（P1-11 FIX: 加入 system message）
     *
     * 请求 DeepSeek 提取 3~5 个英文搜索关键词，用于 GitHub Search API 检索相似仓库。
     * 若 AI 提取失败，回退为从仓库名中提取关键词。
     *
     * @param repo 仓库信息对象
     * @returns 搜索关键词数组
     */
    private async extractKeywords(repo: any): Promise<string[]> {
        const desc = String(repo.descriptionCn || repo.description || '');
        const readme = String(repo.readmeCn || repo.readmeOriginal || '').substring(0, 600);
        const prompt = `提取 3~5 个英文搜索关键词。只返回 JSON 数组:\n\n项目名: ${repo.fullName}\n描述: ${desc}\nREADME: ${readme || '无'}\n\n输出: ["keyword1", "keyword2"]`;
        try {
            const result = await this.callDeepSeek(prompt, '你是GitHub项目推荐专家。只返回要求格式的JSON，不说任何废话。');
            if (result) {
                const cleaned = result
                    .replace(/^```json\s*/i, '')
                    .replace(/^```\s*/i, '')
                    .replace(/```$/i, '')
                    .trim();
                const keywords = JSON.parse(cleaned) as string[];
                if (Array.isArray(keywords) && keywords.length > 0) return keywords;
            }
        } catch {
            this.logger.warn('AI关键词提取失败');
        }
        return [(repo.repoName || repo.fullName || '').replace(/[-_.].*/, '')];
    }

    /**
     * 通过 GitHub Search API 搜索仓库并转换为统一格式（P1-12 FIX: pushed:>= 而非 pushed:>）
     *
     * 搜索最近 3 个月内推送过且超过 {MIN_STARS} star 的仓库。
     * 同时计算一个综合评分（score）用于排序。
     *
     * @param query 搜索关键词
     * @returns 格式化后的仓库列表
     */
    private async searchAndConvert(query: string): Promise<any[]> {
        const d = new Date();
        d.setMonth(d.getMonth() - 3);
        const dateStr = d.toISOString().split('T')[0];
        const fullQuery = `${query} stars:>=${MIN_STARS} pushed:>=${dateStr}`;
        const items = await this.githubApi.searchRepos(fullQuery, 'stars', 'desc', 10);
        return items.map((item: any) => ({
            fullName: item.full_name || '',
            description: item.description || '',
            language: item.language || '',
            stars: item.stargazers_count || 0,
            forks: item.forks_count || 0,
            htmlUrl: item.html_url || '',
            pushedAt: item.pushed_at || '',
            aiReason: '',
            score: Math.log10((item.stargazers_count || 0) + 1) * 10 + Math.log10((item.forks_count || 0) + 1) * 2,
        }));
    }

    /**
     * 为搜索结果生成 AI 推荐理由（P1-12 FIX: 加入 system message）
     *
     * 取前 10 个结果，请求 DeepSeek 为每个仓库生成一句推荐理由。
     * 理由写入对应仓库对象的 aiReason 字段。
     *
     * @param repos 搜索结果列表
     * @param source 源仓库信息
     */
    private async enrichWithAI(repos: any[], source: any) {
        if (!repos.length) return;
        const top = repos.slice(0, 10);
        let list = top.map((r, i) => `${i}. ${r.fullName} ⭐${r.stars} - ${r.language} - ${r.description.substring(0, 100)}`).join('\n');
        const prompt = `源项目: ${source.fullName} (${source.descriptionCn || source.description || ''})\n\n相似项目:\n${list}\n\n为每个项目写一句推荐理由，返回 JSON 数组: ["理由1", "理由2"]`;
        try {
            const result = await this.callDeepSeek(prompt, '你是GitHub项目推荐专家。只返回要求格式的JSON，不说任何废话。');
            if (result) {
                const reasons = JSON.parse(
                    result
                        .replace(/^```json\s*/i, '')
                        .replace(/```$/i, '')
                        .trim(),
                ) as string[];
                if (Array.isArray(reasons))
                    top.forEach((r, i) => {
                        r.aiReason = reasons[i] || '';
                    });
            }
        } catch {
            this.logger.warn('AI推荐理由生成失败');
        }
    }

    /**
     * 查找与指定仓库相似的项目
     *
     * 流程：提取关键词 → 通过 GitHub Search API 搜索 → 补充 topic 搜索 → 排序评分 → AI 生成推荐理由。
     * 每次搜索最多返回 {MAX_RESULTS} 个结果，最多 {MIN_STARS} star 以上。
     *
     * @param repoId 源仓库 ID
     * @returns 相似仓库列表（含评分和 AI 推荐理由）
     */
    async findSimilar(repoId: number): Promise<any[]> {
        this.logger.log('查找相似仓库: repoId=' + repoId);
        const source = await this.githubRepo.findById(repoId);
        if (!source) {
            this.logger.warn('源仓库未找到: repoId=' + repoId);
            return [];
        }
        const seen = new Set<string>();
        seen.add(source.fullName || '');
        const keywords = await this.extractKeywords(source);
        let allResults: any[] = [];

        for (const kw of keywords) {
            if (allResults.length >= MAX_RESULTS * 2) break;
            const q = kw + (source.language ? ` language:${source.language}` : '');
            for (const r of await this.searchAndConvert(q)) {
                if (!seen.has(r.fullName)) {
                    seen.add(r.fullName);
                    allResults.push(r);
                }
            }
        }

        if (allResults.length < MAX_RESULTS) {
            const topics = this.parseTopics(source.topics);
            for (const topic of topics.slice(0, 3)) {
                if (allResults.length >= MAX_RESULTS) break;
                for (const r of await this.searchAndConvert(`topic:${topic}`)) {
                    if (!seen.has(r.fullName)) {
                        seen.add(r.fullName);
                        allResults.push(r);
                    }
                }
            }
        }

        allResults.sort((a, b) => b.score - a.score);
        const topResults = allResults.slice(0, MAX_RESULTS);
        if (topResults.length > 0) await this.enrichWithAI(topResults, source);
        this.logger.log('相似仓库查找完成: repoId=' + repoId + ', resultCount=' + topResults.length);
        return topResults;
    }
}
