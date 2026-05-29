package com.github.stars.controller;

import com.github.stars.entity.GithubRepo;
import com.github.stars.service.AiClassifyService;
import com.github.stars.service.GithubRepoService;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.*;

import javax.annotation.Resource;
import java.util.*;
import java.util.stream.Collectors;

@Controller
@RequestMapping("/ai")
public class AiClassifyController {

    @Resource
    private AiClassifyService aiClassifyService;

    @Resource
    private GithubRepoService githubRepoService;

    /**
     * AI 分类页面
     */
    @GetMapping("/classify")
    public String classifyPage(
            @RequestParam(value = "language", defaultValue = "") String language,
            @RequestParam(value = "keyword", defaultValue = "") String keyword,
            Model model) {

        List<String> languages = githubRepoService.findAllLanguages();
        model.addAttribute("languages", languages);
        model.addAttribute("language", language);
        model.addAttribute("keyword", keyword);

        return "classify";
    }

    /**
     * 加载仓库列表（用于选择，支持筛选）
     */
    @GetMapping("/classify/repos")
    @ResponseBody
    public Map<String, Object> getRepos(
            @RequestParam(value = "keyword", defaultValue = "") String keyword,
            @RequestParam(value = "language", defaultValue = "") String language) {

        List<GithubRepo> allRepos = githubRepoService.findAll(keyword, language);
        List<Map<String, Object>> repos = allRepos.stream().map(repo -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", repo.getId());
            m.put("repoName", repo.getRepoName());
            m.put("fullName", repo.getFullName());
            m.put("description", repo.getDescription());
            m.put("language", repo.getLanguage());
            m.put("ownerName", repo.getOwnerName());
            m.put("starsCount", repo.getStarsCount());
            m.put("topics", repo.getTopics());
            m.put("htmlUrl", repo.getHtmlUrl());
            return m;
        }).collect(Collectors.toList());

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("repos", repos);
        result.put("total", allRepos.size());
        return result;
    }

    /**
     * 触发 AI 分类
     */
    @PostMapping("/classify/execute")
    @ResponseBody
    public Map<String, Object> executeClassify(@RequestBody Map<String, Object> body) {
        @SuppressWarnings("unchecked")
        List<Integer> repoIdInts = (List<Integer>) body.get("repoIds");
        int topN = body.containsKey("topN") ? ((Number) body.get("topN")).intValue() : 8;

        List<Long> repoIds = repoIdInts.stream().map(Long::valueOf).collect(Collectors.toList());

        Map<String, Object> result = aiClassifyService.classify(repoIds, topN);

        // 为每个分类补充仓库简要信息
        if (result.containsKey("categories")) {
            @SuppressWarnings("unchecked")
            Map<String, List<Long>> categories = (Map<String, List<Long>>) result.get("categories");
            Map<String, List<Map<String, Object>>> enrichedCategories = new LinkedHashMap<>();
            for (Map.Entry<String, List<Long>> entry : categories.entrySet()) {
                List<Map<String, Object>> repoInfos = entry.getValue().stream().map(id -> {
                    GithubRepo repo = githubRepoService.findById(id);
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("id", repo.getId());
                    m.put("repoName", repo.getRepoName());
                    m.put("fullName", repo.getFullName());
                    m.put("description", repo.getDescription());
                    m.put("language", repo.getLanguage());
                    m.put("starsCount", repo.getStarsCount());
                    m.put("htmlUrl", repo.getHtmlUrl());
                    return m;
                }).collect(Collectors.toList());
                enrichedCategories.put(entry.getKey(), repoInfos);
            }
            result.put("categories", enrichedCategories);
        }

        return result;
    }
}
