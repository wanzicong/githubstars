package com.github.stars.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.github.stars.entity.GithubRepo;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import javax.annotation.Resource;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.*;

/**
 * 相似项目发现服务
 * 基于 GitHub Search API，根据当前仓库特征搜索相似的高质量项目
 */
@Service
public class SimilarRepoService {

    private static final Logger log = LoggerFactory.getLogger(SimilarRepoService.class);
    private static final String GITHUB_API = "https://api.github.com";
    private static final int MAX_RESULTS = 20;
    private static final int MIN_STARS = 100;

    @Resource
    private GithubRepoService githubRepoService;

    @Resource
    private SystemConfigService configService;

    @Resource
    private ObjectMapper objectMapper;

    @Autowired
    @Qualifier("longTimeoutRestTemplate")
    private RestTemplate restTemplate;

    /**
     * 搜索结果项
     */
    public static class SimilarRepo {
        public String fullName;
        public String description;
        public String language;
        public int stars;
        public int forks;
        public String htmlUrl;
        public String pushedAt;
        public String aiReason; // AI 推荐理由
        public double score;    // 综合评分
    }

    /**
     * 发现与指定仓库相似的优质项目
     */
    public List<SimilarRepo> findSimilar(Long repoId) {
        GithubRepo source = githubRepoService.findById(repoId);
        if (source == null) return Collections.emptyList();

        List<SimilarRepo> allResults = new ArrayList<>();

        // 策略1: 按 topic 搜索
        List<String> topics = parseTopics(source.getTopics());
        for (String topic : topics) {
            if (allResults.size() >= MAX_RESULTS) break;
            List<SimilarRepo> results = searchGitHub("topic:" + topic, source.getFullName());
            allResults.addAll(results);
        }

        // 策略2: 按语言+关键词搜索
        if (allResults.size() < MAX_RESULTS && source.getLanguage() != null) {
            String query = "language:" + source.getLanguage();
            if (source.getRepoName() != null) {
                // 提取仓库名中的关键词（去掉常见后缀）
                String name = source.getRepoName().replaceAll("[-_.].*", "");
                if (name.length() >= 3) query += " " + name;
            }
            List<SimilarRepo> results = searchGitHub(query, source.getFullName());
            allResults.addAll(results);
        }

        // 去重 + 排除当前仓库
        Set<String> seen = new HashSet<>();
        List<SimilarRepo> unique = new ArrayList<>();
        for (SimilarRepo r : allResults) {
            if (r.fullName.equals(source.getFullName())) continue;
            if (seen.add(r.fullName)) unique.add(r);
        }

        // 按评分排序
        unique.sort((a, b) -> Double.compare(b.score, a.score));

        // 限制返回数量
        if (unique.size() > MAX_RESULTS) {
            unique = unique.subList(0, MAX_RESULTS);
        }

        // 用 AI 生成推荐理由
        if (!unique.isEmpty()) {
            enrichWithAI(unique, source);
        }

        log.info("为 {} 发现 {} 个相似项目", source.getFullName(), unique.size());
        return unique;
    }

    /**
     * 调用 GitHub Search API
     */
    private List<SimilarRepo> searchGitHub(String query, String excludeRepo) {
        List<SimilarRepo> results = new ArrayList<>();
        try {
            // 构建完整查询：排除自身 + 3个月活跃 + ≥100 stars
            String threeMonthsAgo = LocalDate.now().minusMonths(3).format(DateTimeFormatter.ISO_DATE);
            String fullQuery = query + " stars:>=" + MIN_STARS + " pushed:>" + threeMonthsAgo;

            String url = UriComponentsBuilder.fromHttpUrl(GITHUB_API + "/search/repositories")
                    .queryParam("q", fullQuery)
                    .queryParam("sort", "stars")
                    .queryParam("order", "desc")
                    .queryParam("per_page", 10)
                    .build()
                    .toUriString();

            HttpHeaders headers = new HttpHeaders();
            headers.set("Accept", "application/vnd.github.v3+json");
            headers.set("User-Agent", "GithubStars-SimilarFinder");
            String ghToken = configService.getValue("github.token");
            if (ghToken != null && !ghToken.isEmpty()) {
                headers.set("Authorization", "Bearer " + ghToken);
            }

            HttpEntity<String> entity = new HttpEntity<>(headers);
            ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.GET, entity, String.class);

            if (response.getStatusCode() == HttpStatus.OK && response.getBody() != null) {
                JsonNode root = objectMapper.readTree(response.getBody());
                JsonNode items = root.get("items");
                if (items != null && items.isArray()) {
                    for (JsonNode item : items) {
                        SimilarRepo r = new SimilarRepo();
                        r.fullName = item.get("full_name").asText();
                        r.description = item.has("description") && !item.get("description").isNull()
                                ? item.get("description").asText() : "";
                        r.language = item.has("language") && !item.get("language").isNull()
                                ? item.get("language").asText() : "";
                        r.stars = item.get("stargazers_count").asInt();
                        r.forks = item.get("forks_count").asInt();
                        r.htmlUrl = item.get("html_url").asText();
                        r.pushedAt = item.has("pushed_at") && !item.get("pushed_at").isNull()
                                ? item.get("pushed_at").asText() : "";
                        // 综合评分：Star为主要因子
                        r.score = Math.log10(r.stars + 1) * 10 + Math.log10(r.forks + 1) * 2;
                        results.add(r);
                    }
                }
            } else if (response.getStatusCode() == HttpStatus.FORBIDDEN) {
                log.warn("GitHub Search API 限流");
            }
        } catch (Exception e) {
            log.warn("GitHub Search 失败: {} - {}", query, e.getMessage());
        }
        return results;
    }

    /**
     * 使用 AI 为每个相似项目生成一句推荐理由
     */
    private void enrichWithAI(List<SimilarRepo> repos, GithubRepo source) {
        // 只对前 10 个生成 AI 推荐理由（节省 token）
        List<SimilarRepo> toEnrich = repos.size() > 10 ? repos.subList(0, 10) : repos;
        if (toEnrich.isEmpty()) return;

        try {
            StringBuilder sb = new StringBuilder();
            sb.append("源项目: ").append(source.getFullName()).append("\n");
            sb.append("描述: ").append(source.getDescriptionCn() != null ? source.getDescriptionCn() : source.getDescription()).append("\n\n");
            sb.append("以下是搜索到的相似项目，请为每个项目用一句话说明它为什么值得关注（15字以内）:\n\n");
            for (int i = 0; i < toEnrich.size(); i++) {
                SimilarRepo r = toEnrich.get(i);
                sb.append(i + 1).append(". ").append(r.fullName)
                        .append(" (Star:").append(r.stars)
                        .append(", Lang:").append(r.language).append(")\n");
                if (r.description != null && !r.description.isEmpty()) {
                    sb.append("   描述:").append(r.description.length() > 100
                            ? r.description.substring(0, 100) + "..." : r.description).append("\n");
                }
            }
            sb.append("\n返回格式: JSON数组 [\"项目1的推荐理由\", \"项目2的推荐理由\", ...]，只返回JSON数组，不要其他内容。");

            // 调用 DeepSeek
            JsonNode response = callDeepSeek(sb.toString());
            if (response != null) {
                JsonNode choices = response.get("choices");
                if (choices != null && choices.isArray() && choices.size() > 0) {
                    String content = choices.get(0).get("message").get("content").asText().trim();
                    // 清理 markdown 代码块
                    if (content.startsWith("```")) {
                        content = content.replaceAll("```json\\s*", "").replaceAll("```\\s*", "");
                    }
                    try {
                        List<String> reasons = objectMapper.readValue(content, new TypeReference<List<String>>() {});
                        for (int i = 0; i < Math.min(reasons.size(), toEnrich.size()); i++) {
                            toEnrich.get(i).aiReason = reasons.get(i);
                        }
                    } catch (Exception e) {
                        log.warn("AI推荐理由解析失败: {}", e.getMessage());
                    }
                }
            }
        } catch (Exception e) {
            log.warn("AI 推荐理由生成失败: {}", e.getMessage());
        }
    }

    private JsonNode callDeepSeek(String prompt) {
        try {
            com.fasterxml.jackson.databind.node.ObjectNode requestBody = objectMapper.createObjectNode();
            requestBody.put("model", configService.getValue("deepseek.model", "deepseek-chat"));
            requestBody.put("temperature", 0.5);
            requestBody.put("max_tokens", 2048);

            com.fasterxml.jackson.databind.node.ArrayNode messages = objectMapper.createArrayNode();
            com.fasterxml.jackson.databind.node.ObjectNode sysMsg = objectMapper.createObjectNode();
            sysMsg.put("role", "system");
            sysMsg.put("content", "你是GitHub项目推荐专家。只返回要求格式的JSON，不说任何废话。");
            messages.add(sysMsg);

            com.fasterxml.jackson.databind.node.ObjectNode userMsg = objectMapper.createObjectNode();
            userMsg.put("role", "user");
            userMsg.put("content", prompt);
            messages.add(userMsg);
            requestBody.set("messages", messages);

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.set("Authorization", "Bearer " + configService.getValue("deepseek.api_key"));

            HttpEntity<String> entity = new HttpEntity<>(objectMapper.writeValueAsString(requestBody), headers);
            ResponseEntity<String> resp = restTemplate.postForEntity(
                    configService.getValue("deepseek.api_url", "https://api.deepseek.com/v1/chat/completions"),
                    entity, String.class);

            if (resp.getStatusCode() == HttpStatus.OK && resp.getBody() != null) {
                return objectMapper.readTree(resp.getBody());
            }
        } catch (Exception e) {
            log.warn("DeepSeek 调用失败: {}", e.getMessage());
        }
        return null;
    }

    private List<String> parseTopics(String topicsJson) {
        if (topicsJson == null || topicsJson.isEmpty() || "[]".equals(topicsJson)) {
            return Collections.emptyList();
        }
        try {
            return objectMapper.readValue(topicsJson, new TypeReference<List<String>>() {});
        } catch (Exception e) {
            return Collections.emptyList();
        }
    }
}
