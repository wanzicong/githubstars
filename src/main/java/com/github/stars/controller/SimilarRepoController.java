package com.github.stars.controller;

import com.github.stars.service.SimilarRepoService;
import org.springframework.web.bind.annotation.*;

import javax.annotation.Resource;
import java.util.*;

@RestController
@RequestMapping("/api/similar")
public class SimilarRepoController {

    @Resource
    private SimilarRepoService similarRepoService;

    /**
     * 发现与指定仓库相似的项目
     */
    @GetMapping("/{repoId}")
    public Map<String, Object> findSimilar(@PathVariable Long repoId) {
        Map<String, Object> result = new LinkedHashMap<>();
        List<SimilarRepoService.SimilarRepo> repos = similarRepoService.findSimilar(repoId);
        result.put("success", true);
        result.put("repos", repos);
        result.put("count", repos.size());
        return result;
    }
}
