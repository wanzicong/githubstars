package com.github.stars.controller;

import com.baomidou.mybatisplus.core.metadata.IPage;
import com.github.stars.entity.GithubRepo;
import com.github.stars.service.GithubRepoService;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;

import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;

import javax.annotation.Resource;
import javax.servlet.http.HttpServletRequest;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.stream.Collectors;

@Controller
public class StarController {

    @Resource
    private GithubRepoService githubRepoService;

    /**
     * Star列表首页 - 支持分页、搜索、筛选、排序、时间范围查询
     */
    @GetMapping({"/", "/stars"})
    public String index(@RequestParam(value = "page", defaultValue = "1") int page,
                        @RequestParam(value = "size", defaultValue = "12") int size,
                        @RequestParam(value = "keyword", defaultValue = "") String keyword,
                        @RequestParam(value = "language", defaultValue = "") String language,
                        @RequestParam(value = "sortBy", defaultValue = "starred_at") String sortBy,
                        @RequestParam(value = "sortOrder", defaultValue = "desc") String sortOrder,
                        @RequestParam(value = "dateField", defaultValue = "") String dateField,
                        @RequestParam(value = "startMonth", defaultValue = "") String startMonth,
                        @RequestParam(value = "endMonth", defaultValue = "") String endMonth,
                        HttpServletRequest request,
                        Model model) {

        // 查询分页数据
        IPage<GithubRepo> pageResult = githubRepoService.findPage(page, size, keyword, language,
                sortBy, sortOrder, dateField, startMonth, endMonth);

        // 查询所有语言列表（用于下拉筛选）
        List<String> languages = githubRepoService.findAllLanguages();

        // 计算分页信息
        long totalPages = pageResult.getPages();
        long currentPage = pageResult.getCurrent();

        // 计算分页导航的起止页码（显示最多5页）
        long startPage = Math.max(1, currentPage - 2);
        long endPage = Math.min(totalPages, startPage + 4);
        if (endPage - startPage < 4) {
            startPage = Math.max(1, endPage - 4);
        }

        // 传递数据到模板
        model.addAttribute("repos", pageResult.getRecords());
        model.addAttribute("currentPage", currentPage);
        model.addAttribute("totalPages", totalPages);
        model.addAttribute("totalCount", pageResult.getTotal());
        model.addAttribute("size", size);
        model.addAttribute("startPage", startPage);
        model.addAttribute("endPage", endPage);

        // 搜索和筛选参数回显
        model.addAttribute("keyword", keyword);
        model.addAttribute("language", language);
        model.addAttribute("sortBy", sortBy);
        model.addAttribute("sortOrder", sortOrder);
        model.addAttribute("dateField", dateField);
        model.addAttribute("startMonth", startMonth);
        model.addAttribute("endMonth", endMonth);

        // 语言列表
        model.addAttribute("languages", languages);

        // 当前查询字符串，用于详情页返回
        String queryString = request.getQueryString();
        model.addAttribute("queryString", queryString != null ? queryString : "");

        return "index";
    }

    /**
     * 导出筛选后的全部仓库链接为 txt 文件
     */
    @GetMapping("/stars/export")
    public ResponseEntity<byte[]> exportUrls(
            @RequestParam(value = "keyword", defaultValue = "") String keyword,
            @RequestParam(value = "language", defaultValue = "") String language,
            @RequestParam(value = "sortBy", defaultValue = "starred_at") String sortBy,
            @RequestParam(value = "sortOrder", defaultValue = "desc") String sortOrder,
            @RequestParam(value = "dateField", defaultValue = "") String dateField,
            @RequestParam(value = "startMonth", defaultValue = "") String startMonth,
            @RequestParam(value = "endMonth", defaultValue = "") String endMonth) {

        List<String> urls = githubRepoService.findAllUrls(keyword, language, sortBy, sortOrder,
                dateField, startMonth, endMonth);
        String content = String.join("\n", urls);
        byte[] bytes = content.getBytes(java.nio.charset.StandardCharsets.UTF_8);

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=github_stars_links.txt")
                .contentType(MediaType.TEXT_PLAIN)
                .contentLength(bytes.length)
                .body(bytes);
    }

    /**
     * Star仓库详情页
     */
    @GetMapping("/stars/{id}")
    public String detail(@PathVariable("id") Long id,
                         @RequestParam(value = "backQuery", defaultValue = "") String backQuery,
                         Model model) {
        GithubRepo repo = githubRepoService.findById(id);
        if (repo == null) {
            return "redirect:/";
        }
        model.addAttribute("repo", repo);
        model.addAttribute("backQuery", backQuery);

        // 解析 topics JSON 数组为 List
        List<String> topicList = Collections.emptyList();
        if (repo.getTopics() != null && !repo.getTopics().isEmpty() && !"[]".equals(repo.getTopics())) {
            topicList = Arrays.stream(repo.getTopics().replaceAll("[\\[\\]\"\\s]", "").split(","))
                    .filter(s -> !s.isEmpty())
                    .collect(Collectors.toList());
        }
        model.addAttribute("topicList", topicList);

        return "detail";
    }
}
