package com.github.stars.controller;

import com.github.stars.service.GithubSearchService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.bind.annotation.*;

import javax.annotation.Resource;
import java.util.*;

/**
 * GitHub 搜索与 Star/Unstar REST 接口
 */
@RestController
@RequestMapping("/api/github")
public class GithubSearchController {

    private static final Logger log = LoggerFactory.getLogger(GithubSearchController.class);

    @Resource
    private GithubSearchService githubSearchService;

    /**
     * 搜索 GitHub 仓库
     */
    @GetMapping("/search")
    public Map<String, Object> search(
            @RequestParam(value = "keyword", defaultValue = "") String keyword,
            @RequestParam(value = "language", defaultValue = "") String language,
            @RequestParam(value = "sort", defaultValue = "stars") String sort,
            @RequestParam(value = "page", defaultValue = "1") int page,
            @RequestParam(value = "perPage", defaultValue = "20") int perPage) {

        Map<String, Object> result = new LinkedHashMap<>();
        try {
            Map<String, Object> searchResult = githubSearchService.searchRepos(keyword, language, sort, page, perPage);
            result.put("success", true);
            result.put("total", searchResult.get("total"));
            result.put("repos", searchResult.get("repos"));
            result.put("page", page);
            result.put("perPage", perPage);
        } catch (Exception e) {
            log.error("GitHub 搜索失败", e);
            result.put("success", false);
            result.put("message", e.getMessage());
            result.put("total", 0);
            result.put("repos", new ArrayList<>());
            result.put("page", page);
            result.put("perPage", perPage);
        }
        return result;
    }

    /**
     * Star 一个仓库
     */
    @PostMapping("/star/{owner}/{repo}")
    public Map<String, Object> starRepo(
            @PathVariable String owner,
            @PathVariable String repo) {

        Map<String, Object> result = new LinkedHashMap<>();
        try {
            boolean starred = githubSearchService.starRepo(owner, repo);
            result.put("success", starred);
            result.put("starred", starred);
            result.put("message", starred ? "已Star" : "Star 失败");
        } catch (Exception e) {
            log.error("Star 仓库失败 [{}/{}]", owner, repo, e);
            result.put("success", false);
            result.put("starred", false);
            result.put("message", "Star 失败: " + e.getMessage());
        }
        return result;
    }

    /**
     * 取消 Star 一个仓库
     */
    @DeleteMapping("/star/{owner}/{repo}")
    public Map<String, Object> unstarRepo(
            @PathVariable String owner,
            @PathVariable String repo) {

        Map<String, Object> result = new LinkedHashMap<>();
        try {
            boolean unstarred = githubSearchService.unstarRepo(owner, repo);
            result.put("success", unstarred);
            result.put("message", unstarred ? "已取消Star" : "取消 Star 失败");
        } catch (Exception e) {
            log.error("取消 Star 失败 [{}/{}]", owner, repo, e);
            result.put("success", false);
            result.put("message", "取消 Star 失败: " + e.getMessage());
        }
        return result;
    }

    /**
     * 检查是否已 Star 某个仓库
     */
    @GetMapping("/starred/{owner}/{repo}")
    public Map<String, Object> checkStarred(
            @PathVariable String owner,
            @PathVariable String repo) {

        Map<String, Object> result = new LinkedHashMap<>();
        try {
            boolean starred = githubSearchService.checkStarred(owner, repo);
            result.put("success", true);
            result.put("starred", starred);
        } catch (Exception e) {
            log.error("检查 Star 状态失败 [{}/{}]", owner, repo, e);
            result.put("success", false);
            result.put("starred", false);
            result.put("message", e.getMessage());
        }
        return result;
    }
}
