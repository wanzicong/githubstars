package com.github.stars.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.github.stars.entity.GithubRepo;
import com.github.stars.mapper.GithubRepoMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import javax.annotation.Resource;
import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * AI 分析总结服务
 * 将筛选出的项目集合发送给 DeepSeek 进行智能分析和汇总
 */
@Service
public class AiAnalyzeService {

    private static final Logger log = LoggerFactory.getLogger(AiAnalyzeService.class);
    private static final int MAX_REPOS = 30; // 测试阶段限制30个

    @Resource
    private GithubRepoMapper githubRepoMapper;

    @Autowired
    @Qualifier("longTimeoutRestTemplate")
    private RestTemplate restTemplate;

    @Resource
    private ObjectMapper objectMapper;

    @Resource
    private SystemConfigService configService;

    /** 分析任务结果缓存 */
    private final Map<String, String> results = new ConcurrentHashMap<>();
    private final Map<String, String> statuses = new ConcurrentHashMap<>();
    private final AtomicInteger taskCounter = new AtomicInteger(0);

    /**
     * 创建分析任务并异步执行
     * @return 任务ID
     */
    public String createAnalyzeTask(String keyword, String language, String categoryIds,
                                     String sortBy, String sortOrder) {
        String taskId = "analyze_" + taskCounter.incrementAndGet();
        statuses.put(taskId, "PROCESSING");

        // 异步执行（用 CompletableFuture 确保不阻塞）
        final String tid = taskId;
        CompletableFuture.runAsync(() -> executeAnalyze(tid, keyword, language, categoryIds, sortBy, sortOrder));

        return taskId;
    }

    /**
     * 创建趋势分析任务（分析 GitHub trending repos 的技术趋势）
     */
    public String createTrendingAnalyzeTask(String since, String language,
                                             List<Map<String, Object>> repos) {
        String taskId = "trending_" + taskCounter.incrementAndGet();
        statuses.put(taskId, "PROCESSING");
        final String tid = taskId;
        CompletableFuture.runAsync(() -> executeTrendingAnalyze(tid, since, language, repos));
        return taskId;
    }

    private void executeTrendingAnalyze(String taskId, String since, String language,
                                         List<Map<String, Object>> repos) {
        try {
            if (repos.isEmpty()) {
                results.put(taskId, "### 暂无数据\n\n当前没有趋势数据可供分析。");
                statuses.put(taskId, "COMPLETED");
                return;
            }

            StringBuilder sb = new StringBuilder();
            sb.append("你是一位顶尖的技术趋势分析师。以下是 GitHub 上 ");
            sb.append(since.equals("daily") ? "今日" : since.equals("weekly") ? "本周" : "本月");
            if (language != null && !language.isEmpty()) sb.append(" ").append(language).append(" 语言");
            sb.append("最热门的新项目（共 ").append(repos.size()).append(" 个）。\n\n");

            for (int i = 0; i < repos.size(); i++) {
                Map<String, Object> r = repos.get(i);
                sb.append(i + 1).append(". ").append(r.get("full_name")).append("\n");
                String desc = (String) r.get("description");
                if (desc != null && !desc.isEmpty()) {
                    sb.append("   描述: ").append(desc.length() > 150 ? desc.substring(0, 150) + "..." : desc).append("\n");
                }
                sb.append("   ⭐").append(r.get("stargazers_count")).append(" | 语言: ").append(r.get("language")).append("\n\n");
            }

            sb.append("请用中文输出一份趋势分析报告（Markdown格式），包含:\n");
            sb.append("### 一、热门方向\n列出 3-5 个当前最热的技术方向，每个方向一句话概括\n\n");
            sb.append("### 二、项目用途分类\n按用途分类这些新项目（如AI工具、开发框架、DevOps工具、安全、数据等）\n\n");
            sb.append("### 三、值得关注的项目\n推荐 3 个最值得关注的仓库，说明理由\n\n");
            sb.append("### 四、趋势洞察\n分析这些新项目反映的技术趋势和开发者关注点的变化\n\n");
            sb.append("只输出分析报告，不要开头语结尾语。");

            log.info("趋势分析 prompt: {} chars, {} repos", sb.length(), repos.size());
            String analysis = callDeepSeek(sb.toString());
            if (analysis == null) analysis = "### 分析失败\n\nAI 服务暂时不可用，请稍后重试。";
            results.put(taskId, analysis);
            statuses.put(taskId, "COMPLETED");
        } catch (Exception e) {
            log.error("趋势分析失败", e);
            results.put(taskId, "### 分析失败\n\n" + e.getMessage());
            statuses.put(taskId, "COMPLETED");
        }
    }

    /**
     * 获取任务状态
     */
    public Map<String, Object> getTaskStatus(String taskId) {
        Map<String, Object> result = new LinkedHashMap<>();
        String status = statuses.getOrDefault(taskId, "NOT_FOUND");
        result.put("taskId", taskId);
        result.put("status", status);
        if ("COMPLETED".equals(status)) {
            result.put("content", results.get(taskId));
        }
        return result;
    }

    private void executeAnalyze(String taskId, String keyword, String language,
                                String categoryIds, String sortBy, String sortOrder) {
        try {
            // 1. 查询符合条件的项目（最多30个）
            List<GithubRepo> repos = queryRepos(keyword, language, categoryIds, sortBy, sortOrder);
            if (repos.isEmpty()) {
                statuses.put(taskId, "COMPLETED");
                results.put(taskId, "### 分析结果\n\n当前筛选条件下没有找到任何项目。");
                return;
            }

            log.info("AI分析任务 {}: 收集到 {} 个项目", taskId, repos.size());

            // 2. 构建 prompt
            String prompt = buildAnalyzePrompt(repos);

            // 3. 调用 DeepSeek
            log.info("AI分析 prompt 大小: {} 字符", prompt.length());
            String analysis;
            try {
                analysis = callDeepSeek(prompt);
            } catch (Exception e) {
                log.error("DeepSeek 调用异常", e);
                String msg = e.getMessage() != null ? e.getMessage() : "未知错误";
                if (msg.contains("timed out") || msg.contains("timeout")) {
                    analysis = "### 分析超时\n\nAI 服务响应超时（当前筛选项目数据量较大）。建议：\n- 缩小筛选范围（使用关键词或分类筛选）\n- 减少项目数量后重试";
                } else {
                    analysis = "### 分析失败\n\nAI 服务调用异常: " + msg;
                }
                results.put(taskId, analysis);
                statuses.put(taskId, "COMPLETED");
                return;
            }
            if (analysis == null || analysis.isEmpty()) {
                analysis = "### 分析失败\n\nAI 服务返回空结果，请稍后重试。";
            }

            // 4. 保存结果
            results.put(taskId, analysis);
            statuses.put(taskId, "COMPLETED");
            log.info("AI分析任务 {} 完成, 结果长度: {}", taskId, analysis.length());

        } catch (Exception e) {
            log.error("AI分析任务 {} 失败", taskId, e);
            statuses.put(taskId, "COMPLETED");
            results.put(taskId, "### 分析失败\n\n" + e.getMessage());
        }
    }

    /**
     * 按筛选条件查询项目（最多 MAX_REPOS 个）
     */
    private List<GithubRepo> queryRepos(String keyword, String language, String categoryIds,
                                         String sortBy, String sortOrder) {
        LambdaQueryWrapper<GithubRepo> wrapper = new LambdaQueryWrapper<>();

        // 分类筛选
        if (categoryIds != null && !categoryIds.isEmpty()) {
            wrapper.inSql(GithubRepo::getId,
                "SELECT repo_id FROM repo_category WHERE category_id IN (" + categoryIds + ")");
        }

        // 关键词搜索
        if (keyword != null && !keyword.isEmpty()) {
            wrapper.and(w -> w
                .like(GithubRepo::getRepoName, keyword)
                .or().like(GithubRepo::getDescription, keyword)
                .or().like(GithubRepo::getOwnerName, keyword)
                .or().like(GithubRepo::getFullName, keyword));
        }

        // 多语言筛选
        if (language != null && !language.isEmpty()) {
            List<String> langs = Arrays.asList(language.split(","));
            if (!langs.contains("")) wrapper.in(GithubRepo::getLanguage, langs);
        }

        // 排序
        boolean isAsc = "asc".equalsIgnoreCase(sortOrder);
        if ("stars_count".equals(sortBy)) {
            wrapper.orderBy(true, isAsc, GithubRepo::getStarsCount);
        } else if ("forks_count".equals(sortBy)) {
            wrapper.orderBy(true, isAsc, GithubRepo::getForksCount);
        } else {
            wrapper.orderBy(true, isAsc, GithubRepo::getStarredAt);
        }

        wrapper.last("LIMIT " + MAX_REPOS);
        return githubRepoMapper.selectList(wrapper);
    }

    /**
     * 构建 AI 分析 prompt
     */
    private String buildAnalyzePrompt(List<GithubRepo> repos) {
        StringBuilder sb = new StringBuilder();
        sb.append("你是一位资深的 GitHub 开源项目分析专家。请对以下 ").append(repos.size())
          .append(" 个 GitHub 项目进行全面分析和总结。\n\n");

        // 项目列表
        sb.append("## 项目列表\n\n");
        for (int i = 0; i < repos.size(); i++) {
            GithubRepo r = repos.get(i);
            sb.append("### ").append(i + 1).append(". ").append(r.getFullName()).append("\n");
            sb.append("- **语言**: ").append(r.getLanguage() != null ? r.getLanguage() : "未知").append("\n");
            sb.append("- **Star**: ").append(r.getStarsCount())
              .append(" | Fork: ").append(r.getForksCount()).append("\n");
            if (r.getDescriptionCn() != null && !r.getDescriptionCn().isEmpty()) {
                String descCn = r.getDescriptionCn().length() > 200
                    ? r.getDescriptionCn().substring(0, 200) + "..."
                    : r.getDescriptionCn();
                sb.append("- **描述**: ").append(descCn).append("\n");
            } else if (r.getDescription() != null && !r.getDescription().isEmpty()) {
                String desc = r.getDescription().length() > 200
                    ? r.getDescription().substring(0, 200) + "..."
                    : r.getDescription();
                sb.append("- **描述**: ").append(desc).append("\n");
            }
            // README 摘要（前200字符，精简以加快AI响应）
            if (r.getReadmeCn() != null && !r.getReadmeCn().isEmpty()) {
                String readme = r.getReadmeCn().length() > 200
                    ? r.getReadmeCn().substring(0, 200) + "..."
                    : r.getReadmeCn();
                sb.append("- **README**: ").append(readme.replace("\n", " ")).append("\n");
            }
            sb.append("\n");
        }

        sb.append("## 分析要求\n\n");
        sb.append("请用中文输出一份结构化的分析报告，使用 Markdown 格式。要求包含以下部分：\n\n");
        sb.append("### 一、总体概览\n");
        sb.append("- 项目总数、总 Star 数、总 Fork 数\n");
        sb.append("- 项目整体质量评估（活跃度、社区参与度等）\n\n");
        sb.append("### 二、技术栈分析\n");
        sb.append("- 编程语言分布（按数量排序）\n");
        sb.append("- 主流技术框架和工具\n");
        sb.append("- 技术趋势观察\n\n");
        sb.append("### 三、应用场景分类\n");
        sb.append("- 将项目按应用场景归类（如 AI/机器学习、Web开发、DevOps、安全、工具等）\n");
        sb.append("- 每个类别列出代表性项目\n\n");
        sb.append("### 四、热门项目 TOP 5\n");
        sb.append("- 按 Star 数排名的前 5 个项目，简要说明其特点和受欢迎原因\n\n");
        sb.append("### 五、趋势与洞察\n");
        sb.append("- 近期热门方向（结合项目描述和 README 分析）\n");
        sb.append("- 值得关注的优质项目推荐\n\n");
        sb.append("### 六、总结建议\n");
        sb.append("- 对这些项目的整体评价\n");
        sb.append("- 推荐优先关注的项目（2-3个）\n\n");
        sb.append("注意：只输出分析报告本身，不要任何开头语或结尾语。");

        return sb.toString();
    }

    /**
     * 调用 DeepSeek API
     */
    private String callDeepSeek(String prompt) {
        try {
            ObjectNode requestBody = objectMapper.createObjectNode();
            requestBody.put("model", configService.getValue("deepseek.model", "deepseek-chat"));
            requestBody.put("temperature", 0.3);
            requestBody.put("max_tokens", 32768);

            ArrayNode messages = objectMapper.createArrayNode();
            ObjectNode sysMsg = objectMapper.createObjectNode();
            sysMsg.put("role", "system");
            sysMsg.put("content", "你是一位资深的开源项目分析师，擅长从大量项目中提取关键洞察。请用中文输出专业的分析报告。");
            messages.add(sysMsg);

            ObjectNode userMsg = objectMapper.createObjectNode();
            userMsg.put("role", "user");
            userMsg.put("content", prompt);
            messages.add(userMsg);
            requestBody.set("messages", messages);

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.set("Authorization", "Bearer " + configService.getValue("deepseek.api_key"));

            HttpEntity<String> entity = new HttpEntity<>(objectMapper.writeValueAsString(requestBody), headers);
            ResponseEntity<String> response = restTemplate.postForEntity(
                configService.getValue("deepseek.api_url", "https://api.deepseek.com/v1/chat/completions"),
                entity, String.class);

            if (response.getStatusCode() == HttpStatus.OK && response.getBody() != null) {
                JsonNode root = objectMapper.readTree(response.getBody());
                JsonNode choices = root.get("choices");
                if (choices != null && choices.isArray() && choices.size() > 0) {
                    String content = choices.get(0).get("message").get("content").asText();
                    log.info("AI 分析返回内容长度: {}", content.length());
                    return content.trim();
                }
                log.error("AI 分析响应格式异常: {}", response.getBody().substring(0, Math.min(500, response.getBody().length())));
            } else {
                log.error("AI 分析 HTTP 状态异常: {} body长度={}", response.getStatusCode(),
                    response.getBody() != null ? response.getBody().length() : 0);
            }
            return null;
        } catch (Exception e) {
            log.error("AI 分析请求失败", e);
            return null;
        }
    }
}
