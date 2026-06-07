package com.github.stars.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestTemplate;

import javax.annotation.Resource;
import java.util.*;

/**
 * GitHub 搜索与 Star/Unstar 服务
 * 调用 GitHub REST API v3 进行仓库搜索和 Star 操作
 */
@Service
public class GithubSearchService {

    private static final Logger log = LoggerFactory.getLogger(GithubSearchService.class);
    private static final String GITHUB_API_BASE = "https://api.github.com";
    private static final String GITHUB_API_VERSION = "application/vnd.github.v3+json";

    @Autowired
    @Qualifier("longTimeoutRestTemplate")
    private RestTemplate restTemplate;

    @Resource
    private ObjectMapper objectMapper;

    @Resource
    private SystemConfigService configService;

    /**
     * 搜索 GitHub 仓库
     *
     * @param keyword  搜索关键词
     * @param language 编程语言过滤（可选）
     * @param sort     排序方式（stars, forks, updated）
     * @param page     页码
     * @param perPage  每页数量
     * @return Map 包含 total（总数）和 repos（仓库列表）
     */
    public Map<String, Object> searchRepos(String keyword, String language, String sort, int page, int perPage) {
        Map<String, Object> result = new LinkedHashMap<>();

        // 构建查询字符串
        StringBuilder queryBuilder = new StringBuilder();
        if (keyword != null && !keyword.trim().isEmpty()) {
            queryBuilder.append(keyword.trim());
        }
        if (language != null && !language.trim().isEmpty()) {
            queryBuilder.append(" language:").append(language.trim());
        }
        String query = queryBuilder.toString().trim();
        if (query.isEmpty()) {
            query = "stars:>1";
        }

        String url = GITHUB_API_BASE + "/search/repositories"
                + "?q=" + encodeQueryParam(query)
                + "&sort=" + (sort != null && !sort.isEmpty() ? sort : "stars")
                + "&page=" + page
                + "&per_page=" + perPage;

        log.info("GitHub 搜索请求: {}", url);

        try {
            HttpHeaders headers = buildAuthHeaders();
            HttpEntity<String> entity = new HttpEntity<>(headers);
            ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.GET, entity, String.class);

            if (response.getStatusCode() == HttpStatus.OK && response.getBody() != null) {
                JsonNode root = objectMapper.readTree(response.getBody());
                int totalCount = root.get("total_count").asInt(0);
                JsonNode items = root.get("items");

                List<Map<String, Object>> repos = new ArrayList<>();
                if (items != null && items.isArray()) {
                    for (JsonNode item : items) {
                        Map<String, Object> repo = extractRepoFields(item);
                        repos.add(repo);
                    }
                }

                result.put("total", totalCount);
                result.put("repos", repos);
            } else {
                result.put("total", 0);
                result.put("repos", new ArrayList<>());
            }
        } catch (HttpClientErrorException e) {
            if (e.getStatusCode() == HttpStatus.FORBIDDEN) {
                log.error("GitHub API 访问受限 (403): {}", e.getMessage());
                throw new RuntimeException("GitHub API rate limited");
            }
            log.error("GitHub API 请求异常: {}", e.getMessage());
            throw new RuntimeException("GitHub API 调用失败: " + e.getMessage());
        } catch (Exception e) {
            log.error("GitHub 搜索异常", e);
            throw new RuntimeException("GitHub 搜索失败: " + e.getMessage());
        }

        return result;
    }

    /**
     * Star 一个仓库
     *
     * @param owner 仓库所有者
     * @param repo  仓库名
     * @return true 表示已 Star（或已处于 Star 状态）
     */
    public boolean starRepo(String owner, String repo) {
        String url = GITHUB_API_BASE + "/user/starred/" + owner + "/" + repo;
        log.info("Star 仓库: {}/{}", owner, repo);

        try {
            HttpHeaders headers = buildAuthHeaders();
            headers.setContentLength(0);
            HttpEntity<String> entity = new HttpEntity<>(headers);
            ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.PUT, entity, String.class);

            int status = response.getStatusCodeValue();
            // 204: 成功 Star，304: 已经 Star 过
            if (status == 204 || status == 304) {
                return true;
            }
            log.warn("Star 仓库返回非预期状态码: {}", status);
            return false;
        } catch (HttpClientErrorException e) {
            if (e.getStatusCode() == HttpStatus.NOT_MODIFIED) {
                // 304 表示已经 Star 过
                return true;
            }
            log.error("Star 仓库失败 [{}/{}]: {}", owner, repo, e.getMessage());
            return false;
        } catch (Exception e) {
            log.error("Star 仓库异常 [{}/{}]", owner, repo, e);
            return false;
        }
    }

    /**
     * 取消 Star 一个仓库
     *
     * @param owner 仓库所有者
     * @param repo  仓库名
     * @return true 表示取消成功
     */
    public boolean unstarRepo(String owner, String repo) {
        String url = GITHUB_API_BASE + "/user/starred/" + owner + "/" + repo;
        log.info("取消 Star 仓库: {}/{}", owner, repo);

        try {
            HttpHeaders headers = buildAuthHeaders();
            HttpEntity<String> entity = new HttpEntity<>(headers);
            ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.DELETE, entity, String.class);

            int status = response.getStatusCodeValue();
            if (status == 204) {
                return true;
            }
            log.warn("取消 Star 返回非预期状态码: {}", status);
            return false;
        } catch (HttpClientErrorException e) {
            log.error("取消 Star 失败 [{}/{}]: {}", owner, repo, e.getMessage());
            return false;
        } catch (Exception e) {
            log.error("取消 Star 异常 [{}/{}]", owner, repo, e);
            return false;
        }
    }

    /**
     * 检查是否已 Star 某个仓库
     *
     * @param owner 仓库所有者
     * @param repo  仓库名
     * @return true 表示已 Star
     */
    public boolean checkStarred(String owner, String repo) {
        String url = GITHUB_API_BASE + "/user/starred/" + owner + "/" + repo;
        log.debug("检查 Star 状态: {}/{}", owner, repo);

        try {
            HttpHeaders headers = buildAuthHeaders();
            HttpEntity<String> entity = new HttpEntity<>(headers);
            ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.GET, entity, String.class);

            int status = response.getStatusCodeValue();
            return status == 204;
        } catch (HttpClientErrorException e) {
            if (e.getStatusCode() == HttpStatus.NOT_FOUND) {
                return false;
            }
            log.error("检查 Star 状态失败 [{}/{}]: {}", owner, repo, e.getMessage());
            return false;
        } catch (Exception e) {
            log.error("检查 Star 异常 [{}/{}]", owner, repo, e);
            return false;
        }
    }

    /**
     * 构建带有 GitHub Token 认证的 HTTP 请求头
     */
    private HttpHeaders buildAuthHeaders() {
        HttpHeaders headers = new HttpHeaders();
        headers.set("Accept", GITHUB_API_VERSION);
        headers.set("User-Agent", "GithubStars-Search");

        String token = configService.getValue("github.token");
        if (token != null && !token.isEmpty()) {
            headers.set("Authorization", "Bearer " + token);
        }

        return headers;
    }

    /**
     * URL 编码查询参数（Java 8 兼容方式）
     */
    private String encodeQueryParam(String value) {
        try {
            return java.net.URLEncoder.encode(value, "UTF-8")
                    .replace("+", "%20");
        } catch (Exception e) {
            return value;
        }
    }

    /**
     * 从 GitHub API 返回的 repo JSON 节点中提取关键字段
     */
    private Map<String, Object> extractRepoFields(JsonNode item) {
        Map<String, Object> repo = new LinkedHashMap<>();
        repo.put("id", item.get("id").asLong());
        repo.put("full_name", safeText(item, "full_name"));
        repo.put("description", safeText(item, "description"));
        repo.put("language", safeText(item, "language"));
        repo.put("stargazers_count", item.get("stargazers_count").asInt(0));
        repo.put("forks_count", item.get("forks_count").asInt(0));
        repo.put("html_url", safeText(item, "html_url"));
        repo.put("pushed_at", safeText(item, "pushed_at"));
        repo.put("created_at", safeText(item, "created_at"));

        // owner 信息
        JsonNode ownerNode = item.get("owner");
        if (ownerNode != null && !ownerNode.isNull()) {
            repo.put("owner_login", safeText(ownerNode, "login"));
            repo.put("owner_avatar_url", safeText(ownerNode, "avatar_url"));
        } else {
            repo.put("owner_login", "");
            repo.put("owner_avatar_url", "");
        }

        // topics
        List<String> topics = new ArrayList<>();
        JsonNode topicsNode = item.get("topics");
        if (topicsNode != null && topicsNode.isArray()) {
            for (JsonNode t : topicsNode) {
                topics.add(t.asText());
            }
        }
        repo.put("topics", topics);

        return repo;
    }

    /**
     * 安全获取 JSON 文本字段（null 返回空字符串）
     */
    private String safeText(JsonNode node, String field) {
        JsonNode fieldNode = node.get(field);
        if (fieldNode == null || fieldNode.isNull()) {
            return "";
        }
        return fieldNode.asText();
    }
}
