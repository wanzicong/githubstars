package com.github.stars.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.github.stars.entity.GithubRepo;
import com.github.stars.mapper.GithubRepoMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
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

    @Resource
    private SystemConfigService configService;

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
     *
     * 逻辑：
     * 1. 已获取（readmeFetched=true）→ 返回已有结果（不重复获取）
     * 2. 未获取 → 调 GitHub API
     *    a. README 存在 → 保存原始内容 + 翻译
     *    b. README 不存在（404）→ 标记 fetched，不再重试
     *    c. 限流/网络错误 → 抛异常给上层重试，不标记 fetched
     */
    public String translateReadme(Long repoId) {
        GithubRepo repo = githubRepoService.findById(repoId);
        if (repo == null) {
            log.warn("仓库不存在: {}", repoId);
            return null;
        }

        // 已获取则直接返回（不再重复请求 GitHub API）
        if (Boolean.TRUE.equals(repo.getReadmeFetched())) {
            log.info("README 已处理，跳过: {}", repo.getFullName());
            return repo.getReadmeCn() != null ? repo.getReadmeCn() : "";
        }

        String readmeContent;
        try {
            readmeContent = fetchReadmeFromGitHub(repo.getFullName());
        } catch (RuntimeException e) {
            // 限流/网络错误：不标记 fetched，让上层重试
            log.warn("README 获取失败（将重试）: {} - {}", repo.getFullName(), e.getMessage());
            throw e;
        }

        if (readmeContent == null) {
            // 404: README 确实不存在，标记为已处理，不再重试
            log.info("README 不存在，标记已处理: {}", repo.getFullName());
            repo.setReadmeFetched(true);
            repo.setReadmeCn(null);
            githubRepoMapper.updateById(repo);
            return "";
        }

        // README 存在：立即保存原始内容（即使翻译失败也不丢失）
        repo.setReadmeOriginal(readmeContent);
        repo.setReadmeFetched(true);
        githubRepoMapper.updateById(repo);
        log.info("已保存原始 README: {} ({} 字符)", repo.getFullName(), readmeContent.length());

        // 翻译 README（使用长超时 RestTemplate）
        String translated = callDeepSeekTranslate(readmeContent, true);
        if (translated != null) {
            repo.setReadmeCn(translated);
            githubRepoMapper.updateById(repo);
            log.info("README 翻译成功: {} ({} → {} 字符)", repo.getFullName(), readmeContent.length(), translated.length());
        } else {
            log.warn("README 翻译失败（原始内容已保存，可稍后重试翻译）: {}", repo.getFullName());
        }
        return translated != null ? translated : "";
    }

    /**
     * 强制重新翻译 README（忽略 readmeFetched 标记）
     */
    public String translateReadmeForce(Long repoId) {
        GithubRepo repo = githubRepoService.findById(repoId);
        if (repo == null) return null;

        String readmeContent;
        try {
            readmeContent = fetchReadmeFromGitHub(repo.getFullName());
        } catch (RuntimeException e) {
            throw e;
        }

        if (readmeContent == null) {
            repo.setReadmeFetched(true);
            repo.setReadmeCn(null);
            githubRepoMapper.updateById(repo);
            return "";
        }

        // 保存原始内容
        repo.setReadmeOriginal(readmeContent);
        repo.setReadmeFetched(true);
        githubRepoMapper.updateById(repo);
        log.info("重新获取原始 README: {} ({} 字符)", repo.getFullName(), readmeContent.length());

        // 重新翻译
        String translated = callDeepSeekTranslate(readmeContent, true);
        if (translated != null) {
            repo.setReadmeCn(translated);
            githubRepoMapper.updateById(repo);
            log.info("重新翻译 README 成功: {} ({} 字符)", repo.getFullName(), translated.length());
        }
        return translated != null ? translated : "";
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
     *
     * @return README 内容，不存在时返回 null
     * @throws RuntimeException 限流或网络错误时抛出（调用方应重试而不是标记为已处理）
     */
    private String fetchReadmeFromGitHub(String fullName) {
        try {
            String url = "https://api.github.com/repos/" + fullName + "/readme";
            HttpHeaders headers = new HttpHeaders();
            headers.set("Accept", "application/vnd.github.v3.raw");
            headers.set("User-Agent", "GithubStars-Manager");
            String ghToken = configService.getValue("github.token");
            if (ghToken != null && !ghToken.isEmpty()) {
                headers.set("Authorization", "Bearer " + ghToken);
            }

            HttpEntity<String> entity = new HttpEntity<>(headers);
            ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.GET, entity, String.class);

            if (response.getStatusCode() == HttpStatus.OK && response.getBody() != null) {
                return response.getBody();
            }

            // 404 = README 不存在，这是正常情况
            if (response.getStatusCode() == HttpStatus.NOT_FOUND) {
                log.info("README 不存在 (404): {}", fullName);
                return null;
            }

            // 403 = 限流，不应标记为已处理
            if (response.getStatusCode() == HttpStatus.FORBIDDEN) {
                log.warn("GitHub API 限流 (403)，需要稍后重试: {}", fullName);
                throw new RuntimeException("GitHub API rate limited");
            }

            log.warn("获取 README 失败: {} - {}", fullName, response.getStatusCode());
            throw new RuntimeException("GitHub API error: " + response.getStatusCodeValue());
        } catch (RuntimeException e) {
            throw e; // 重新抛出限流等错误
        } catch (Exception e) {
            // 网络错误等，也应该重试
            log.warn("获取 README 网络异常: {} - {}", fullName, e.getMessage());
            throw new RuntimeException("GitHub API network error: " + e.getMessage());
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
                prompt = "你是一位专业的 GitHub README 文档翻译专家。以下是完整的 Markdown 格式 README 文件，请将其翻译为高质量的中文版本。"
                        + "\n\n【强制要求 - 必须严格遵守】"
                        + "\n1. 输出必须是完整、合法的 Markdown 格式文档，这是 GitHub README 文件"
                        + "\n2. 保持所有 Markdown 语法完整不变：标题(#)、列表(-/*)、代码块(```)、链接([]())、图片(![]())、表格(|)、引用(>)、分隔线(---)、粗体(**)、斜体(*)等"
                        + "\n3. 代码块(```...```)内的所有内容保持原样不翻译，包括代码注释"
                        + "\n4. 技术术语保留英文原文，如 API、SDK、CLI、HTTP、JSON、Docker、Git、npm 等"
                        + "\n5. 项目名称、仓库名、人名、URL 链接保持原文不变"
                        + "\n6. HTML 标签内容只翻译显示文本，保持标签结构不变"
                        + "\n7. Badge/徽章（如 ![...](...) 格式的 CI/CD 状态图）保持原文"
                        + "\n8. 英文专有名词首次出现时可保留英文并在括号内加中文，如 Docker（容器化平台）"
                        + "\n9. 翻译结果直接输出，不要添加任何前缀（如'翻译结果：'）、后缀或额外解释"
                        + "\n10. 不要输出任何开头语或结尾语，只输出翻译后的 Markdown 文档本身"
                        + "\n\n【待翻译的 README 文档】\n\n"
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
            requestBody.put("model", configService.getValue("deepseek.model", "deepseek-chat"));
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
            headers.set("Authorization", "Bearer " + configService.getValue("deepseek.api_key"));

            HttpEntity<String> entity = new HttpEntity<>(objectMapper.writeValueAsString(requestBody), headers);
            // README 使用长超时 RestTemplate（3 分钟），描述使用默认（30 秒）
            RestTemplate rt = isReadme ? longTimeoutRestTemplate : restTemplate;
            String dsUrl = configService.getValue("deepseek.api_url", "https://api.deepseek.com/v1/chat/completions");
            ResponseEntity<String> response = rt.postForEntity(dsUrl, entity, String.class);

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
