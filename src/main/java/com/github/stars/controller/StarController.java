package com.github.stars.controller;

import com.baomidou.mybatisplus.core.metadata.IPage;
import com.github.stars.entity.GithubRepo;
import com.github.stars.service.GithubRepoService;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import javax.annotation.Resource;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
public class StarController {

    @Resource
    private GithubRepoService githubRepoService;

    /**
     * Star列表 JSON API（供 React 前端分页调用）
     */
    @GetMapping("/api/stars")
    public Map<String, Object> apiStars(@RequestParam(value = "page", defaultValue = "1") int page,
                                        @RequestParam(value = "size", defaultValue = "12") int size,
                                        @RequestParam(value = "keyword", defaultValue = "") String keyword,
                                        @RequestParam(value = "language", defaultValue = "") String language,
                                        @RequestParam(value = "sortBy", defaultValue = "starred_at") String sortBy,
                                        @RequestParam(value = "sortOrder", defaultValue = "desc") String sortOrder,
                                        @RequestParam(value = "dateField", defaultValue = "") String dateField,
                                        @RequestParam(value = "startDate", defaultValue = "") String startDate,
                                        @RequestParam(value = "endDate", defaultValue = "") String endDate,
                                        @RequestParam(value = "categoryIds", defaultValue = "") String categoryIds,
                                        @RequestParam(value = "untranslatedOnly", defaultValue = "false") boolean untranslatedOnly) {

        IPage<GithubRepo> pageResult = githubRepoService.findPage(page, size, keyword, language,
                sortBy, sortOrder, dateField, startDate, endDate, categoryIds, untranslatedOnly);

        Map<String, Object> result = new HashMap<>();
        result.put("records", pageResult.getRecords());
        result.put("total", pageResult.getTotal());
        result.put("size", pageResult.getSize());
        result.put("current", pageResult.getCurrent());
        result.put("pages", pageResult.getPages());
        return result;
    }

    /**
     * Star仓库详情 JSON API（供 React 前端使用）
     */
    @GetMapping("/api/stars/{id}")
    public GithubRepo apiDetail(@PathVariable("id") Long id) {
        return githubRepoService.findById(id);
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
            @RequestParam(value = "startDate", defaultValue = "") String startDate,
            @RequestParam(value = "endDate", defaultValue = "") String endDate,
            @RequestParam(value = "categoryIds", defaultValue = "") String categoryIds) {

        List<String> urls = githubRepoService.findAllUrls(keyword, language, sortBy, sortOrder,
                dateField, startDate, endDate, categoryIds);
        String content = String.join("\n", urls);
        byte[] bytes = content.getBytes(java.nio.charset.StandardCharsets.UTF_8);

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=github_stars_links.txt")
                .contentType(MediaType.TEXT_PLAIN)
                .contentLength(bytes.length)
                .body(bytes);
    }
}
