package com.github.stars.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.github.stars.entity.Category;
import com.github.stars.entity.GithubRepo;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import javax.annotation.Resource;
import java.util.*;

@Service
public class AiClassifyService {

    private static final Logger log = LoggerFactory.getLogger(AiClassifyService.class);

    @Resource
    private RestTemplate restTemplate;

    @Resource
    private ObjectMapper objectMapper;

    @Resource
    private GithubRepoService githubRepoService;

    @Resource
    private CategoryService categoryService;

    @Resource
    private SystemConfigService configService;

    /**
     * 智能分类：优先匹配现有分类，只对不匹配的创建新分类
     * @param repoIds 未分类仓库ID列表
     * @return 分类结果
     */
    public Map<String, Object> smartClassify(List<Long> repoIds) {
        Map<String, Object> result = new LinkedHashMap<>();

        List<GithubRepo> repos = new ArrayList<>();
        for (Long id : repoIds) {
            GithubRepo repo = githubRepoService.findById(id);
            if (repo != null) repos.add(repo);
        }
        if (repos.isEmpty()) {
            result.put("success", false);
            result.put("message", "没有需要分类的仓库");
            return result;
        }

        // 获取所有现有L2分类
        List<Category> existingCategories = categoryService.listAll();
        Map<String, Long> categoryNameToId = new LinkedHashMap<>();
        for (Category cat : existingCategories) {
            if (cat.getLevel() != null && cat.getLevel() == 2) {
                categoryNameToId.put(cat.getName(), cat.getId());
            }
        }

        String prompt = buildSmartPrompt(repos, new ArrayList<>(categoryNameToId.keySet()));
        String aiResponse = callDeepSeek(prompt);

        Map<String, List<Long>> assignments = parseSmartResponse(aiResponse, repos, categoryNameToId);

        if (assignments != null && !assignments.isEmpty()) {
            try {
                categoryService.applySmartClassifyResult(assignments);
                result.put("categories", assignments);
                result.put("matchedExisting", countExistingMatches(assignments, categoryNameToId));
                result.put("createdNew", assignments.size() - countExistingMatches(assignments, categoryNameToId));
            } catch (Exception e) {
                log.error("保存分类结果失败", e);
                result.put("message", "保存失败: " + e.getMessage());
            }
        }

        result.put("success", true);
        result.put("totalProcessed", repos.size());
        return result;
    }

    private int countExistingMatches(Map<String, List<Long>> assignments, Map<String, Long> existing) {
        int count = 0;
        for (String name : assignments.keySet()) {
            if (existing.containsKey(name)) count++;
        }
        return count;
    }

    private String buildSmartPrompt(List<GithubRepo> repos, List<String> existingCategoryNames) {
        StringBuilder sb = new StringBuilder();
        sb.append("你是一位资深的技术分类专家。请将以下未分类的 GitHub 项目归类。\n\n");

        if (!existingCategoryNames.isEmpty()) {
            sb.append("## 现有分类（优先匹配）\n");
            sb.append("以下是已有的分类列表，如果项目符合某个分类，请直接使用该分类名称，不要创建重复分类：\n\n");
            for (String name : existingCategoryNames) {
                sb.append("- ").append(name).append("\n");
            }
            sb.append("\n**重要：优先将项目归入现有分类。只有当前分类都不匹配时，才创建新分类。**\n\n");
        }

        sb.append("## 待分类项目\n");
        for (int i = 0; i < repos.size(); i++) {
            GithubRepo repo = repos.get(i);
            sb.append("[").append(i).append("] ").append(repo.getRepoName());
            sb.append(" | 语言: ").append(repo.getLanguage() != null ? repo.getLanguage() : "未知");
            String desc = repo.getDescriptionCn() != null ? repo.getDescriptionCn() : repo.getDescription();
            if (desc != null && !desc.isEmpty()) {
                sb.append(" | ").append(desc.length() > 150 ? desc.substring(0, 150) + "..." : desc);
            }
            sb.append("\n");
        }

        sb.append("\n返回 JSON 格式：{\"分类名1\": [序号], \"分类名2\": [序号]}\n");
        sb.append("每个项目只能归入一个分类。分类名尽量使用现有分类名。不要输出任何其他内容。");
        return sb.toString();
    }

    @SuppressWarnings("unchecked")
    private Map<String, List<Long>> parseSmartResponse(String jsonResponse, List<GithubRepo> repos,
                                                        Map<String, Long> existingCategories) {
        // 复用原有的解析逻辑
        return parseResponse(jsonResponse, repos);
    }

    /**
     * 对指定仓库列表进行 AI 智能分类（原方法，创建新分类）
     */
    public Map<String, Object> classify(List<Long> repoIds, int topN) {
        Map<String, Object> result = new LinkedHashMap<>();

        List<GithubRepo> repos = new ArrayList<>();
        for (Long id : repoIds) {
            GithubRepo repo = githubRepoService.findById(id);
            if (repo != null) {
                repos.add(repo);
            }
        }

        if (repos.isEmpty()) {
            result.put("success", false);
            result.put("message", "未找到任何仓库");
            return result;
        }

        String prompt = buildPrompt(repos, topN);
        String aiResponse = callDeepSeek(prompt);
        Map<String, List<Long>> categories = parseResponse(aiResponse, repos);

        // 将分类结果保存到数据库
        if (categories != null && !categories.isEmpty() && !categories.containsKey("分类失败")) {
            try {
                categoryService.saveAiClassifyResult(categories);
                log.info("AI 分类结果已自动保存到数据库");
            } catch (Exception e) {
                log.error("保存 AI 分类结果失败", e);
            }
        }

        result.put("success", true);
        result.put("categories", categories);
        result.put("totalClassified", repoIds.size());
        return result;
    }

    private String buildPrompt(List<GithubRepo> repos, int topN) {
        StringBuilder sb = new StringBuilder();
        sb.append("你是一位资深的技术分类专家。请根据以下 GitHub 开源项目的名称、描述、编程语言和主题标签，将它们归类到 ").append(topN).append(" 个以内的合理技术领域中。\n\n");
        sb.append("要求：\n");
        sb.append("1. 每个项目只能归入一个最合适的分类\n");
        sb.append("2. 返回 JSON 格式，key 为分类名称（中文，简洁明了），value 为属于该分类的项目序号列表（数组）\n");
        sb.append("3. 只返回 JSON，不要任何其他内容\n\n");
        sb.append("项目列表：\n");

        for (int i = 0; i < repos.size(); i++) {
            GithubRepo repo = repos.get(i);
            sb.append("[").append(i).append("] ");
            sb.append("名称: ").append(repo.getRepoName());
            sb.append(" | 语言: ").append(repo.getLanguage() != null ? repo.getLanguage() : "未知");
            if (repo.getDescription() != null && !repo.getDescription().isEmpty()) {
                String desc = repo.getDescription().length() > 200
                        ? repo.getDescription().substring(0, 200) + "..."
                        : repo.getDescription();
                sb.append(" | 描述: ").append(desc);
            }
            if (repo.getTopics() != null && !repo.getTopics().isEmpty() && !"[]".equals(repo.getTopics())) {
                sb.append(" | 标签: ").append(repo.getTopics());
            }
            sb.append("\n");
        }

        sb.append("\n请输出 JSON：");
        return sb.toString();
    }

    private String callDeepSeek(String prompt) {
        try {
            ObjectNode requestBody = objectMapper.createObjectNode();
            requestBody.put("model", configService.getValue("deepseek.model", "deepseek-chat"));
            requestBody.put("temperature", 0.3);
            requestBody.put("max_tokens", 4096);

            ArrayNode messages = objectMapper.createArrayNode();
            ObjectNode userMessage = objectMapper.createObjectNode();
            userMessage.put("role", "user");
            userMessage.put("content", prompt);
            messages.add(userMessage);
            requestBody.set("messages", messages);

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            String dsApiKey = configService.getValue("deepseek.api_key");
            headers.set("Authorization", "Bearer " + dsApiKey);

            HttpEntity<String> entity = new HttpEntity<>(objectMapper.writeValueAsString(requestBody), headers);
            String dsApiUrl = configService.getValue("deepseek.api_url", "https://api.deepseek.com/v1/chat/completions");
            ResponseEntity<String> response = restTemplate.postForEntity(dsApiUrl, entity, String.class);

            if (response.getStatusCode() == HttpStatus.OK && response.getBody() != null) {
                JsonNode root = objectMapper.readTree(response.getBody());
                JsonNode choices = root.get("choices");
                if (choices != null && choices.isArray() && choices.size() > 0) {
                    JsonNode message = choices.get(0).get("message");
                    if (message != null) {
                        String content = message.get("content").asText();
                        // 清理可能的 markdown 代码块标记
                        content = content.trim();
                        if (content.startsWith("```json")) {
                            content = content.substring(7);
                        }
                        if (content.startsWith("```")) {
                            content = content.substring(3);
                        }
                        if (content.endsWith("```")) {
                            content = content.substring(0, content.length() - 3);
                        }
                        return content.trim();
                    }
                }
            }
            log.error("DeepSeek API 响应异常: {}", response.getBody());
            return null;
        } catch (Exception e) {
            log.error("调用 DeepSeek API 失败", e);
            return null;
        }
    }

    @SuppressWarnings("unchecked")
    private Map<String, List<Long>> parseResponse(String jsonResponse, List<GithubRepo> repos) {
        Map<String, List<Long>> categories = new LinkedHashMap<>();
        if (jsonResponse == null || jsonResponse.isEmpty()) {
            categories.put("分类失败", new ArrayList<>());
            return categories;
        }

        try {
            JsonNode root = objectMapper.readTree(jsonResponse);
            Iterator<String> fieldNames = root.fieldNames();
            while (fieldNames.hasNext()) {
                String category = fieldNames.next();
                JsonNode indicesNode = root.get(category);
                List<Long> repoIds = new ArrayList<>();
                if (indicesNode.isArray()) {
                    for (JsonNode idx : indicesNode) {
                        int index = idx.asInt();
                        if (index >= 0 && index < repos.size()) {
                            repoIds.add(repos.get(index).getId());
                        }
                    }
                }
                if (!repoIds.isEmpty()) {
                    categories.put(category, repoIds);
                }
            }
        } catch (Exception e) {
            log.error("解析 AI 分类结果失败", e);
            categories.put("解析失败: " + e.getMessage(), new ArrayList<>());
        }

        if (categories.isEmpty()) {
            categories.put("未能分类", repos.stream().map(GithubRepo::getId).collect(java.util.stream.Collectors.toList()));
        }

        return categories;
    }
}
