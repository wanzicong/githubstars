package com.github.stars.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.github.stars.entity.GithubRepo;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * GitHub API 客户端服务
 * 调用 GitHub REST API 获取用户 Star 列表
 */
@Service
public class GithubApiService {

    private static final Logger log = LoggerFactory.getLogger(GithubApiService.class);

    private static final String GITHUB_API_BASE = "https://api.github.com";
    private static final int PER_PAGE = 100;
    private static final Pattern NEXT_LINK_PATTERN = Pattern.compile("<([^>]+)>;\\s*rel=\"next\"");
    private static final DateTimeFormatter GITHUB_DATE_FORMAT = DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss'Z'");

    @Value("${github.username}")
    private String githubUsername;

    @Value("${github.token:}")
    private String githubToken;

    @Autowired
    private RestTemplate restTemplate;

    @Autowired
    private ObjectMapper objectMapper;

    /**
     * 获取用户所有 Star 仓库
     * 自动处理分页，遍历所有页
     */
    public List<GithubRepo> fetchAllStarredRepos() {
        List<GithubRepo> allRepos = new ArrayList<>();
        String starredUrl = GITHUB_API_BASE + "/users/" + githubUsername + "/starred";
        String url = starredUrl + "?per_page=" + PER_PAGE + "&page=1";

        int page = 1;
        while (url != null) {
            log.info("正在获取第 {} 页 Star 数据, URL: {}", page, url);

            HttpHeaders headers = new HttpHeaders();
            // 使用 star+json 格式以获取 starred_at 时间
            headers.set("Accept", "application/vnd.github.v3.star+json");
            headers.set("User-Agent", "GithubStars-Manager");
            // 如果配置了 token，添加认证头以提高速率限制
            if (githubToken != null && !githubToken.isEmpty()) {
                headers.set("Authorization", "Bearer " + githubToken);
            }
            HttpEntity<String> entity = new HttpEntity<>(headers);

            ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.GET, entity, String.class);

            if (response.getStatusCode() == HttpStatus.OK && response.getBody() != null) {
                List<GithubRepo> pageRepos = parseStarredResponse(response.getBody());
                allRepos.addAll(pageRepos);
                log.info("第 {} 页获取到 {} 个仓库", page, pageRepos.size());
            } else {
                log.warn("请求失败, 状态码: {}", response.getStatusCode());
                break;
            }

            // 解析 Link header 获取下一页 URL
            url = parseNextPageUrl(response.getHeaders());
            page++;
        }

        log.info("共获取到 {} 个 Star 仓库", allRepos.size());
        return allRepos;
    }

    /**
     * 解析 GitHub star+json 格式的响应
     * 响应格式: [{"starred_at": "...", "repo": {...}}, ...]
     */
    private List<GithubRepo> parseStarredResponse(String responseBody) {
        List<GithubRepo> repos = new ArrayList<>();
        try {
            JsonNode rootArray = objectMapper.readTree(responseBody);
            if (rootArray.isArray()) {
                for (JsonNode item : rootArray) {
                    GithubRepo repo = parseRepoNode(item);
                    if (repo != null) {
                        repos.add(repo);
                    }
                }
            }
        } catch (Exception e) {
            log.error("解析 GitHub API 响应失败", e);
        }
        return repos;
    }

    /**
     * 解析单个 star 条目（包含 starred_at 和 repo）
     */
    private GithubRepo parseRepoNode(JsonNode item) {
        try {
            JsonNode repoNode = item.get("repo");
            if (repoNode == null) {
                return null;
            }

            GithubRepo repo = new GithubRepo();
            repo.setRepoName(getTextValue(repoNode, "name"));
            repo.setFullName(getTextValue(repoNode, "full_name"));
            repo.setDescription(getTextValue(repoNode, "description"));
            repo.setLanguage(getTextValue(repoNode, "language"));
            repo.setHtmlUrl(getTextValue(repoNode, "html_url"));
            repo.setHomepage(getTextValue(repoNode, "homepage"));
            repo.setStarsCount(getIntValue(repoNode, "stargazers_count"));
            repo.setForksCount(getIntValue(repoNode, "forks_count"));
            repo.setWatchersCount(getIntValue(repoNode, "watchers_count"));
            repo.setOpenIssuesCount(getIntValue(repoNode, "open_issues_count"));
            repo.setIsFork(getBooleanValue(repoNode, "fork"));
            repo.setIsArchived(getBooleanValue(repoNode, "archived"));

            // owner 信息
            JsonNode ownerNode = repoNode.get("owner");
            if (ownerNode != null) {
                repo.setOwnerName(getTextValue(ownerNode, "login"));
                repo.setOwnerAvatarUrl(getTextValue(ownerNode, "avatar_url"));
            }

            // license 信息
            JsonNode licenseNode = repoNode.get("license");
            if (licenseNode != null && !licenseNode.isNull()) {
                repo.setLicenseName(getTextValue(licenseNode, "name"));
            }

            // topics 数组转 JSON 字符串
            JsonNode topicsNode = repoNode.get("topics");
            if (topicsNode != null && topicsNode.isArray()) {
                List<String> topics = new ArrayList<>();
                for (JsonNode topic : topicsNode) {
                    topics.add(topic.asText());
                }
                repo.setTopics(objectMapper.writeValueAsString(topics));
            }

            // 日期字段
            repo.setRepoCreatedAt(parseDateTime(getTextValue(repoNode, "created_at")));
            repo.setRepoUpdatedAt(parseDateTime(getTextValue(repoNode, "updated_at")));
            repo.setRepoPushedAt(parseDateTime(getTextValue(repoNode, "pushed_at")));

            // starred_at 在外层
            String starredAtStr = getTextValue(item, "starred_at");
            repo.setStarredAt(parseDateTime(starredAtStr));

            return repo;
        } catch (Exception e) {
            log.error("解析仓库数据失败", e);
            return null;
        }
    }

    /**
     * 从 Link header 中解析下一页 URL
     * Link header 格式: <url>; rel="next", <url>; rel="last"
     */
    private String parseNextPageUrl(HttpHeaders headers) {
        List<String> linkHeaders = headers.get("Link");
        if (linkHeaders == null || linkHeaders.isEmpty()) {
            return null;
        }

        for (String linkHeader : linkHeaders) {
            Matcher matcher = NEXT_LINK_PATTERN.matcher(linkHeader);
            if (matcher.find()) {
                return matcher.group(1);
            }
        }
        return null;
    }

    private LocalDateTime parseDateTime(String dateStr) {
        if (dateStr == null || dateStr.isEmpty()) {
            return null;
        }
        try {
            return LocalDateTime.parse(dateStr, GITHUB_DATE_FORMAT);
        } catch (Exception e) {
            log.debug("日期解析失败: {}", dateStr);
            return null;
        }
    }

    private String getTextValue(JsonNode node, String field) {
        JsonNode fieldNode = node.get(field);
        if (fieldNode == null || fieldNode.isNull()) {
            return null;
        }
        return fieldNode.asText();
    }

    private int getIntValue(JsonNode node, String field) {
        JsonNode fieldNode = node.get(field);
        if (fieldNode == null || fieldNode.isNull()) {
            return 0;
        }
        return fieldNode.asInt();
    }

    private boolean getBooleanValue(JsonNode node, String field) {
        JsonNode fieldNode = node.get(field);
        if (fieldNode == null || fieldNode.isNull()) {
            return false;
        }
        return fieldNode.asBoolean();
    }
}
