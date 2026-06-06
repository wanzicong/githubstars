package com.github.stars.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.github.stars.entity.GithubRepo;
import com.github.stars.mapper.GithubRepoMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import org.springframework.beans.factory.annotation.Qualifier;

import javax.annotation.Resource;
import java.util.ArrayList;
import java.util.List;

@Service
public class TranslateService {

    private static final Logger log = LoggerFactory.getLogger(TranslateService.class);

    @Value("${deepseek.api-key}")
    private String apiKey;

    @Value("${deepseek.api-url}")
    private String apiUrl;

    @Value("${deepseek.model}")
    private String model;

    @Value("${github.token:}")
    private String githubToken;

    @Resource
    private RestTemplate restTemplate;

    @Resource
    @Qualifier("longTimeoutRestTemplate")
    private RestTemplate longTimeoutRestTemplate;

    @Resource
    private ObjectMapper objectMapper;

    @Resource
    private GithubRepoMapper githubRepoMapper;

    @Resource
    private GithubRepoService githubRepoService;

    /**
     * 翻译单个仓库的描述信息（只翻译一次，已翻译则跳过）
     */
    public String translateDescription(Long repoId) {
        GithubRepo repo = githubRepoService.findById(repoId);
        if (repo == null) {
            log.warn("仓库不存在: {}", repoId);
            return null;
        }

        // 只保存一次：已翻译则直接返回
        if (repo.getDescriptionCn() != null && !repo.getDescriptionCn().isEmpty()) {
            log.info("描述已翻译，跳过: {}", repo.getFullName());
            return repo.getDescriptionCn();
        }

        if (repo.getDescription() == null || repo.getDescription().isEmpty()) {
            log.info("描述为空，跳过: {}", repo.getFullName());
            return null;
        }

        String translated = callDeepSeekTranslate(repo.getDescription(), false);
        if (translated != null) {
            repo.setDescriptionCn(translated);
            githubRepoMapper.updateById(repo);
            log.info("描述翻译成功: {}", repo.getFullName());
        }
        return translated;
    }

    /**
     * 翻译单个仓库的 README（只翻译一次，已获取翻译则跳过）
     */
    public String translateReadme(Long repoId) {
        GithubRepo repo = githubRepoService.findById(repoId);
        if (repo == null) {
            log.warn("仓库不存在: {}", repoId);
            return null;
        }

        // 只保存一次：已获取并翻译则直接返回
        if (Boolean.TRUE.equals(repo.getReadmeFetched())) {
            log.info("README 已翻译，跳过: {}", repo.getFullName());
            return repo.getReadmeCn();
        }

        String readmeContent = fetchReadmeFromGitHub(repo.getFullName());
        if (readmeContent == null) {
            log.warn("README 不存在或获取失败，标记为已处理: {}", repo.getFullName());
            repo.setReadmeFetched(true);
            repo.setReadmeCn(null);
            githubRepoMapper.updateById(repo);
            return null;
        }

        // README 全部翻译，不截断（使用长超时 RestTemplate）
        String translated = callDeepSeekTranslate(readmeContent, true);
        if (translated != null) {
            repo.setReadmeCn(translated);
            repo.setReadmeFetched(true);
            githubRepoMapper.updateById(repo);
            log.info("README 翻译成功: {} ({} 字符)", repo.getFullName(), translated.length());
        } else {
            log.warn("README 翻译失败，可重试: {}", repo.getFullName());
            // 翻译失败不设置 readmeFetched，允许用户重试
        }
        return translated;
    }

    /**
     * 批量翻译未翻译的描述信息
     *
     * @param repoIds 仓库ID列表，为空则翻译所有未翻译的
     * @return 翻译成功的数量
     */
    public int translateDescriptionsBatch(List<Long> repoIds) {
        List<GithubRepo> repos;
        if (repoIds != null && !repoIds.isEmpty()) {
            repos = new ArrayList<>();
            for (Long id : repoIds) {
                GithubRepo repo = githubRepoService.findById(id);
                if (repo != null) {
                    repos.add(repo);
                }
            }
        } else {
            // 查询所有 description 不为空且 description_cn 为空的仓库
            repos = githubRepoMapper.selectList(
                    new com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper<GithubRepo>()
                            .isNotNull(GithubRepo::getDescription)
                            .ne(GithubRepo::getDescription, "")
                            .and(w -> w.isNull(GithubRepo::getDescriptionCn)
                                    .or().eq(GithubRepo::getDescriptionCn, ""))
                            .last("LIMIT 100")
            );
        }

        int count = 0;
        for (GithubRepo repo : repos) {
            try {
                String translated = callDeepSeekTranslate(repo.getDescription(), false);
                if (translated != null) {
                    repo.setDescriptionCn(translated);
                    githubRepoMapper.updateById(repo);
                    count++;
                }
            } catch (Exception e) {
                log.error("翻译失败: {} - {}", repo.getFullName(), e.getMessage());
            }
        }
        log.info("批量翻译完成: {}/{}", count, repos.size());
        return count;
    }

    /**
     * 从 GitHub 获取 README 内容
     */
    private String fetchReadmeFromGitHub(String fullName) {
        try {
            String url = "https://api.github.com/repos/" + fullName + "/readme";
            HttpHeaders headers = new HttpHeaders();
            headers.set("Accept", "application/vnd.github.v3.raw");
            headers.set("User-Agent", "GithubStars-Manager");
            if (githubToken != null && !githubToken.isEmpty()) {
                headers.set("Authorization", "Bearer " + githubToken);
            }

            HttpEntity<String> entity = new HttpEntity<>(headers);
            ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.GET, entity, String.class);

            if (response.getStatusCode() == HttpStatus.OK && response.getBody() != null) {
                return response.getBody();
            }
            log.warn("获取 README 失败: {} - {}", fullName, response.getStatusCode());
            return null;
        } catch (Exception e) {
            log.warn("获取 README 异常: {} - {}", fullName, e.getMessage());
            return null;
        }
    }

    /**
     * 调用 DeepSeek API 进行翻译
     *
     * @param text      待翻译文本
     * @param isReadme  是否为 README（长文本，需要保持 Markdown 格式）
     * @return 翻译结果
     */
    private String callDeepSeekTranslate(String text, boolean isReadme) {
        try {
            String prompt;
            if (isReadme) {
                prompt = "你是一位专业的翻译专家。请将以下 GitHub 项目的 README 文档从英文翻译成中文。"
                        + "要求：\n"
                        + "1. 保持原文的 Markdown 格式（标题、列表、代码块等）\n"
                        + "2. 技术术语保留英文（如 API, SDK, CLI 等）\n"
                        + "3. 代码块内容不要翻译\n"
                        + "4. 只返回翻译结果，不要任何额外说明\n\n"
                        + text;
            } else {
                prompt = "你是一位专业的翻译专家。请将以下 GitHub 项目描述从英文翻译成中文。"
                        + "要求：\n"
                        + "1. 翻译要准确、简洁、通顺\n"
                        + "2. 技术术语保留英文\n"
                        + "3. 只返回翻译结果，不要任何额外内容\n\n"
                        + text;
            }

            ObjectNode requestBody = objectMapper.createObjectNode();
            requestBody.put("model", model);
            requestBody.put("temperature", 0.3);
            // README 翻译使用更多 tokens，避免截断
            requestBody.put("max_tokens", isReadme ? 32768 : 1024);

            ArrayNode messages = objectMapper.createArrayNode();
            ObjectNode userMessage = objectMapper.createObjectNode();
            userMessage.put("role", "user");
            userMessage.put("content", prompt);
            messages.add(userMessage);
            requestBody.set("messages", messages);

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.set("Authorization", "Bearer " + apiKey);

            HttpEntity<String> entity = new HttpEntity<>(objectMapper.writeValueAsString(requestBody), headers);
            // README 使用长超时 RestTemplate（3 分钟），描述使用默认（30 秒）
            RestTemplate rt = isReadme ? longTimeoutRestTemplate : restTemplate;
            ResponseEntity<String> response = rt.postForEntity(apiUrl, entity, String.class);

            if (response.getStatusCode() == HttpStatus.OK && response.getBody() != null) {
                JsonNode root = objectMapper.readTree(response.getBody());
                JsonNode choices = root.get("choices");
                if (choices != null && choices.isArray() && choices.size() > 0) {
                    JsonNode message = choices.get(0).get("message");
                    if (message != null) {
                        String content = message.get("content").asText();
                        return content.trim();
                    }
                }
            }
            log.error("DeepSeek 翻译 API 响应异常: {}", response.getBody());
            return null;
        } catch (Exception e) {
            log.error("调用 DeepSeek 翻译 API 失败", e);
            return null;
        }
    }
}
