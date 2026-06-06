package com.github.stars.controller;

import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.github.stars.entity.Category;
import com.github.stars.entity.GithubRepo;
import com.github.stars.service.AiClassifyService;
import com.github.stars.service.CategoryService;
import org.springframework.web.bind.annotation.*;

import javax.annotation.Resource;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/categories")
public class CategoryController {

    @Resource
    private CategoryService categoryService;

    @Resource
    private AiClassifyService aiClassifyService;

    /**
     * 新增分类
     */
    @PostMapping
    public Map<String, Object> create(@RequestBody Map<String, String> body) {
        Map<String, Object> result = new LinkedHashMap<>();
        String name = body.get("name");
        String description = body.get("description");
        if (name == null || name.trim().isEmpty()) {
            result.put("success", false);
            result.put("message", "分类名称不能为空");
            return result;
        }
        try {
            Category category = categoryService.create(name.trim(), description);
            result.put("success", true);
            result.put("category", category);
        } catch (Exception e) {
            result.put("success", false);
            result.put("message", "分类名重复: " + e.getMessage());
        }
        return result;
    }

    /**
     * 更新分类
     */
    @PutMapping("/{id}")
    public Map<String, Object> update(@PathVariable Long id, @RequestBody Map<String, String> body) {
        Map<String, Object> result = new LinkedHashMap<>();
        String name = body.get("name");
        if (name == null || name.trim().isEmpty()) {
            result.put("success", false);
            result.put("message", "分类名称不能为空");
            return result;
        }
        try {
            categoryService.update(id, name.trim(), body.get("description"));
            result.put("success", true);
        } catch (Exception e) {
            result.put("success", false);
            result.put("message", e.getMessage());
        }
        return result;
    }

    /**
     * 删除分类
     */
    @DeleteMapping("/{id}")
    public Map<String, Object> delete(@PathVariable Long id) {
        Map<String, Object> result = new LinkedHashMap<>();
        try {
            categoryService.delete(id);
            result.put("success", true);
        } catch (Exception e) {
            result.put("success", false);
            result.put("message", e.getMessage());
        }
        return result;
    }

    /**
     * 批量删除分类
     */
    @DeleteMapping("/batch")
    public Map<String, Object> batchDelete(@RequestBody Map<String, Object> body) {
        Map<String, Object> result = new LinkedHashMap<>();
        try {
            @SuppressWarnings("unchecked")
            List<Integer> idInts = (List<Integer>) body.get("ids");
            List<Long> ids = idInts.stream().map(Long::valueOf).collect(Collectors.toList());
            categoryService.batchDelete(ids);
            result.put("success", true);
            result.put("message", "已删除 " + ids.size() + " 个分类");
        } catch (Exception e) {
            result.put("success", false);
            result.put("message", e.getMessage());
        }
        return result;
    }

    /**
     * 添加仓库到分类
     */
    @PostMapping("/{categoryId}/repos")
    public Map<String, Object> addRepos(@PathVariable Long categoryId, @RequestBody Map<String, Object> body) {
        Map<String, Object> result = new LinkedHashMap<>();
        try {
            @SuppressWarnings("unchecked")
            List<Integer> repoIdInts = (List<Integer>) body.get("repoIds");
            List<Long> repoIds = repoIdInts.stream().map(Long::valueOf).collect(Collectors.toList());
            categoryService.batchAddReposToCategory(repoIds, categoryId);
            result.put("success", true);
        } catch (Exception e) {
            result.put("success", false);
            result.put("message", e.getMessage());
        }
        return result;
    }

    /**
     * 从分类中移除仓库
     */
    @DeleteMapping("/{categoryId}/repos/{repoId}")
    public Map<String, Object> removeRepo(@PathVariable Long categoryId, @PathVariable Long repoId) {
        Map<String, Object> result = new LinkedHashMap<>();
        try {
            categoryService.removeRepoFromCategory(repoId, categoryId);
            result.put("success", true);
        } catch (Exception e) {
            result.put("success", false);
            result.put("message", e.getMessage());
        }
        return result;
    }

    /**
     * 仓库分类转移
     */
    @PostMapping("/{categoryId}/repos/transfer")
    public Map<String, Object> transferRepos(
            @PathVariable Long categoryId,
            @RequestBody Map<String, Object> body) {
        Map<String, Object> result = new LinkedHashMap<>();
        try {
            @SuppressWarnings("unchecked")
            List<Integer> repoIdInts = (List<Integer>) body.get("repoIds");
            Long toCategoryId = Long.valueOf(body.get("toCategoryId").toString());
            List<Long> repoIds = repoIdInts.stream().map(Long::valueOf).collect(Collectors.toList());
            categoryService.batchTransferRepos(repoIds, categoryId, toCategoryId);
            result.put("success", true);
        } catch (Exception e) {
            result.put("success", false);
            result.put("message", e.getMessage());
        }
        return result;
    }

    /**
     * 获取分类下的仓库列表
     */
    @GetMapping("/{id}/repos")
    public List<Map<String, Object>> getReposByCategory(@PathVariable Long id) {
        List<GithubRepo> repos = categoryService.getReposByCategoryId(id);
        return repos.stream().map(repo -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", repo.getId());
            m.put("repoName", repo.getRepoName());
            m.put("fullName", repo.getFullName());
            m.put("description", repo.getDescription());
            m.put("descriptionCn", repo.getDescriptionCn());
            m.put("language", repo.getLanguage());
            m.put("starsCount", repo.getStarsCount());
            m.put("forksCount", repo.getForksCount());
            m.put("htmlUrl", repo.getHtmlUrl());
            m.put("homepage", repo.getHomepage());
            m.put("ownerName", repo.getOwnerName());
            m.put("ownerAvatarUrl", repo.getOwnerAvatarUrl());
            m.put("topics", repo.getTopics());
            m.put("starredAt", repo.getStarredAt());
            m.put("isFork", repo.getIsFork());
            m.put("isArchived", repo.getIsArchived());
            return m;
        }).collect(Collectors.toList());
    }

    /**
     * 分页查询分类下的仓库列表（支持搜索、排序、分页）
     */
    @GetMapping("/{id}/repos/paged")
    public Map<String, Object> getReposByCategoryPaged(
            @PathVariable Long id,
            @RequestParam(value = "page", defaultValue = "1") int page,
            @RequestParam(value = "size", defaultValue = "12") int size,
            @RequestParam(value = "keyword", defaultValue = "") String keyword,
            @RequestParam(value = "language", defaultValue = "") String language,
            @RequestParam(value = "sortBy", defaultValue = "starred_at") String sortBy,
            @RequestParam(value = "sortOrder", defaultValue = "desc") String sortOrder) {

        Page<GithubRepo> pageResult = categoryService.getReposByCategoryIdPaged(
                id, page, size, keyword, language, sortBy, sortOrder);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("records", pageResult.getRecords());
        result.put("total", pageResult.getTotal());
        result.put("size", pageResult.getSize());
        result.put("current", pageResult.getCurrent());
        result.put("pages", pageResult.getPages());
        return result;
    }

    /**
     * 获取所有分类（供下拉选择）
     */
    @GetMapping("/all")
    public List<Category> getAllCategories() {
        return categoryService.listAll();
    }

    /**
     * 获取未分类仓库
     */
    @GetMapping("/uncategorized")
    public List<Map<String, Object>> getUncategorizedRepos() {
        List<GithubRepo> repos = categoryService.getUncategorizedRepos();
        return repos.stream().map(repo -> {
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
    }

    /**
     * 对分类内的仓库重新进行 AI 分类
     */
    @PostMapping("/{id}/reclassify")
    public Map<String, Object> reclassify(@PathVariable Long id, @RequestBody(required = false) Map<String, Object> body) {
        Map<String, Object> result = new LinkedHashMap<>();
        try {
            List<GithubRepo> repos = categoryService.getReposByCategoryId(id);
            if (repos.isEmpty()) {
                result.put("success", false);
                result.put("message", "该分类下没有仓库");
                return result;
            }
            int topN = body != null && body.containsKey("topN")
                    ? ((Number) body.get("topN")).intValue() : 8;
            List<Long> repoIds = repos.stream().map(GithubRepo::getId).collect(Collectors.toList());
            Map<String, Object> classifyResult = aiClassifyService.classify(repoIds, topN);
            if (Boolean.TRUE.equals(classifyResult.get("success"))) {
                result.put("success", true);
                result.put("message", "重分类完成");
            } else {
                result.put("success", false);
                result.put("message", "AI 分类失败: " + classifyResult.getOrDefault("message", "未知错误"));
            }
        } catch (Exception e) {
            result.put("success", false);
            result.put("message", "重分类失败: " + e.getMessage());
        }
        return result;
    }
}
