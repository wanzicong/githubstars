package com.github.stars.controller;

import com.baomidou.mybatisplus.core.metadata.IPage;
import com.github.stars.dto.AuthorDTO;
import com.github.stars.entity.GithubRepo;
import com.github.stars.service.AuthorService;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import javax.annotation.Resource;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
public class AuthorController {

    @Resource
    private AuthorService authorService;

    /**
     * 作者列表 JSON API（分页 + 搜索）
     */
    @GetMapping("/api/authors")
    public Map<String, Object> apiAuthors(@RequestParam(value = "page", defaultValue = "1") int page,
                                          @RequestParam(value = "size", defaultValue = "24") int size,
                                          @RequestParam(value = "keyword", defaultValue = "") String keyword) {

        IPage<AuthorDTO> pageResult = authorService.getAuthorPage(page, size, keyword);

        Map<String, Object> result = new HashMap<>();
        result.put("records", pageResult.getRecords());
        result.put("total", pageResult.getTotal());
        result.put("size", pageResult.getSize());
        result.put("current", pageResult.getCurrent());
        result.put("pages", pageResult.getPages());
        return result;
    }

    /**
     * 作者仓库列表 JSON API（分页 + 排序）
     */
    @GetMapping("/api/authors/{ownerName}")
    public Map<String, Object> apiAuthorRepos(@PathVariable("ownerName") String ownerName,
                                              @RequestParam(value = "page", defaultValue = "1") int page,
                                              @RequestParam(value = "size", defaultValue = "12") int size,
                                              @RequestParam(value = "sortBy", defaultValue = "starred_at") String sortBy,
                                              @RequestParam(value = "sortOrder", defaultValue = "desc") String sortOrder) {

        IPage<GithubRepo> pageResult = authorService.getAuthorRepos(ownerName, page, size, sortBy, sortOrder);

        Map<String, Object> result = new HashMap<>();
        result.put("records", pageResult.getRecords());
        result.put("total", pageResult.getTotal());
        result.put("size", pageResult.getSize());
        result.put("current", pageResult.getCurrent());
        result.put("pages", pageResult.getPages());
        return result;
    }

    /**
     * 导出某作者的所有仓库链接为 txt 文件
     */
    @GetMapping("/api/authors/{ownerName}/export")
    public ResponseEntity<byte[]> exportAuthorUrls(@PathVariable("ownerName") String ownerName,
                                                    @RequestParam(value = "sortBy", defaultValue = "starred_at") String sortBy,
                                                    @RequestParam(value = "sortOrder", defaultValue = "desc") String sortOrder) {

        List<String> urls = authorService.getAuthorAllRepoUrls(ownerName, sortBy, sortOrder);
        String content = String.join("\n", urls);
        byte[] bytes = content.getBytes(java.nio.charset.StandardCharsets.UTF_8);

        String filename = "github_stars_" + ownerName + ".txt";

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=" + filename)
                .contentType(MediaType.TEXT_PLAIN)
                .contentLength(bytes.length)
                .body(bytes);
    }
}
