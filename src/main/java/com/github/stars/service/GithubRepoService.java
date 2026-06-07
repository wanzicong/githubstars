package com.github.stars.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.github.stars.entity.GithubRepo;
import com.github.stars.entity.LanguageStat;
import com.github.stars.mapper.CategoryMapper;
import com.github.stars.mapper.GithubRepoMapper;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import com.baomidou.mybatisplus.core.toolkit.support.SFunction;

import javax.annotation.Resource;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.time.format.DateTimeParseException;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class GithubRepoService {

    @Resource
    private GithubRepoMapper githubRepoMapper;

    @Resource
    private CategoryMapper categoryMapper;

    @Resource
    private CategoryService categoryService;

    /**
     * 分页查询Star仓库列表
     *
     * @param page       当前页码
     * @param size       每页条数
     * @param keyword    搜索关键词（仓库名、描述、作者模糊搜索）
     * @param language   语言筛选（支持逗号分隔多语言）
     * @param sortBy     排序字段（stars_count, forks_count, repo_updated_at, starred_at）
     * @param sortOrder  排序方向（asc, desc）
     * @param dateField  时间筛选字段（starred_at, repo_created_at, repo_updated_at, repo_pushed_at）
     * @param startMonth 开始月份（格式：yyyy-MM）
     * @param endMonth   结束月份（格式：yyyy-MM）
     * @return 分页结果
     */
    public IPage<GithubRepo> findPage(int page, int size, String keyword, String language,
                                      String sortBy, String sortOrder,
                                      String dateField, String startMonth, String endMonth,
                                      String categoryIds) {
        List<String> languageList = null;
        if (StringUtils.hasText(language)) languageList = Arrays.asList(language.split(","));
        List<Long> catIdList = null;
        if (StringUtils.hasText(categoryIds)) {
            catIdList = Arrays.stream(categoryIds.split(","))
                    .filter(s -> !s.isEmpty()).map(Long::valueOf).collect(Collectors.toList());
            // 展开一级分类为其下所有二级子分类
            catIdList = categoryService.expandCategoryIds(catIdList);
        }
        return findPage(page, size, keyword, languageList, catIdList, sortBy, sortOrder, dateField, startMonth, endMonth);
    }

    /**
     * 分页查询Star仓库列表（支持多语言列表）
     *
     * @param page       当前页码
     * @param size       每页条数
     * @param keyword    搜索关键词（仓库名、描述、作者模糊搜索）
     * @param languages  语言筛选列表（支持多语言 OR 筛选）
     * @param sortBy     排序字段
     * @param sortOrder  排序方向
     * @param dateField  时间筛选字段
     * @param startMonth 开始月份
     * @param endMonth   结束月份
     * @return 分页结果
     */
    public IPage<GithubRepo> findPage(int page, int size, String keyword, List<String> languages,
                                      List<Long> categoryIds,
                                      String sortBy, String sortOrder,
                                      String dateField, String startMonth, String endMonth) {
        Page<GithubRepo> pageParam = new Page<>(page, size);
        LambdaQueryWrapper<GithubRepo> wrapper = new LambdaQueryWrapper<>();

        // 分类筛选（子查询 repo_category 表）
        if (categoryIds != null && !categoryIds.isEmpty()) {
            String ids = categoryIds.stream().map(String::valueOf).collect(Collectors.joining(","));
            wrapper.inSql(GithubRepo::getId, "SELECT repo_id FROM repo_category WHERE category_id IN (" + ids + ")");
        }

        // 关键词搜索
        if (StringUtils.hasText(keyword)) {
            wrapper.and(w -> w
                    .like(GithubRepo::getRepoName, keyword)
                    .or().like(GithubRepo::getDescription, keyword)
                    .or().like(GithubRepo::getOwnerName, keyword)
                    .or().like(GithubRepo::getFullName, keyword)
            );
        }

        // 多语言筛选（OR 逻辑）
        if (languages != null && !languages.isEmpty() && !languages.contains("")) {
            wrapper.in(GithubRepo::getLanguage, languages);
        }

        // 时间月份范围筛选
        if (StringUtils.hasText(dateField) && (StringUtils.hasText(startMonth) || StringUtils.hasText(endMonth))) {
            SFunction<GithubRepo, ?> dateColumn = getDateColumn(dateField);
            if (dateColumn != null) {
                if (StringUtils.hasText(startMonth)) {
                    LocalDateTime startTime = parseMonthStart(startMonth);
                    if (startTime != null) {
                        wrapper.ge(dateColumn, startTime);
                    }
                }
                if (StringUtils.hasText(endMonth)) {
                    LocalDateTime endTime = parseMonthEnd(endMonth);
                    if (endTime != null) {
                        wrapper.le(dateColumn, endTime);
                    }
                }
            }
        }

        // 排序
        boolean isAsc = "asc".equalsIgnoreCase(sortOrder);
        switch (sortBy != null ? sortBy : "starred_at") {
            case "stars_count":
                wrapper.orderBy(true, isAsc, GithubRepo::getStarsCount);
                break;
            case "forks_count":
                wrapper.orderBy(true, isAsc, GithubRepo::getForksCount);
                break;
            case "repo_updated_at":
                wrapper.orderBy(true, isAsc, GithubRepo::getRepoUpdatedAt);
                break;
            case "repo_created_at":
                wrapper.orderBy(true, isAsc, GithubRepo::getRepoCreatedAt);
                break;
            case "repo_pushed_at":
                wrapper.orderBy(true, isAsc, GithubRepo::getRepoPushedAt);
                break;
            default:
                wrapper.orderBy(true, isAsc, GithubRepo::getStarredAt);
                break;
        }

        IPage<GithubRepo> result = githubRepoMapper.selectPage(pageParam, wrapper);
        fillCategoryNames(result.getRecords());
        return result;
    }

    /**
     * 批量填充分类名称到仓库列表
     */
    public void fillCategoryNames(List<GithubRepo> repos) {
        if (repos == null || repos.isEmpty()) return;

        List<Long> repoIds = repos.stream().map(GithubRepo::getId).collect(Collectors.toList());
        List<Map<String, Object>> rows = categoryMapper.selectCategoryNamesByRepoIds(repoIds);

        // repo_id -> List<category_name>
        Map<Long, List<String>> categoryMap = new HashMap<>();
        for (Map<String, Object> row : rows) {
            Long repoId = ((Number) row.get("repo_id")).longValue();
            String name = (String) row.get("name");
            categoryMap.computeIfAbsent(repoId, k -> new ArrayList<>()).add(name);
        }

        for (GithubRepo repo : repos) {
            repo.setCategoryNames(categoryMap.getOrDefault(repo.getId(), Collections.emptyList()));
        }
    }

    /**
     * 根据字段名获取对应的 Lambda 列引用
     */
    private SFunction<GithubRepo, ?> getDateColumn(String dateField) {
        switch (dateField) {
            case "starred_at":
                return GithubRepo::getStarredAt;
            case "repo_created_at":
                return GithubRepo::getRepoCreatedAt;
            case "repo_updated_at":
                return GithubRepo::getRepoUpdatedAt;
            case "repo_pushed_at":
                return GithubRepo::getRepoPushedAt;
            default:
                return null;
        }
    }

    /**
     * 解析月份字符串为该月第一天 00:00:00
     */
    private LocalDateTime parseMonthStart(String month) {
        try {
            YearMonth ym = YearMonth.parse(month);
            return ym.atDay(1).atStartOfDay();
        } catch (DateTimeParseException e) {
            return null;
        }
    }

    /**
     * 解析月份字符串为该月最后一天 23:59:59
     */
    private LocalDateTime parseMonthEnd(String month) {
        try {
            YearMonth ym = YearMonth.parse(month);
            return ym.atEndOfMonth().atTime(23, 59, 59);
        } catch (DateTimeParseException e) {
            return null;
        }
    }

    /**
     * 按筛选条件查询所有仓库链接（不分页，仅查 html_url）
     */
    public List<String> findAllUrls(String keyword, String language, String sortBy, String sortOrder,
                                    String dateField, String startMonth, String endMonth, String categoryIds) {
        // 解析多语言参数
        List<String> languageList = null;
        if (StringUtils.hasText(language)) {
            languageList = Arrays.asList(language.split(","));
        }
        // 解析分类参数并展开一级分类
        List<Long> catIdList = null;
        if (StringUtils.hasText(categoryIds)) {
            catIdList = Arrays.stream(categoryIds.split(","))
                    .filter(s -> !s.isEmpty()).map(Long::valueOf).collect(Collectors.toList());
            catIdList = categoryService.expandCategoryIds(catIdList);
        }
        return findAllUrls(keyword, languageList, sortBy, sortOrder, dateField, startMonth, endMonth, catIdList);
    }

    /**
     * 按筛选条件查询所有仓库链接（支持多语言列表 + 分类筛选）
     */
    public List<String> findAllUrls(String keyword, List<String> languages, String sortBy, String sortOrder,
                                    String dateField, String startMonth, String endMonth, List<Long> categoryIds) {
        LambdaQueryWrapper<GithubRepo> wrapper = new LambdaQueryWrapper<>();
        wrapper.select(GithubRepo::getHtmlUrl);

        // 分类筛选（子查询 repo_category 表）
        if (categoryIds != null && !categoryIds.isEmpty()) {
            String ids = categoryIds.stream().map(String::valueOf).collect(Collectors.joining(","));
            wrapper.inSql(GithubRepo::getId, "SELECT repo_id FROM repo_category WHERE category_id IN (" + ids + ")");
        }

        if (StringUtils.hasText(keyword)) {
            wrapper.and(w -> w
                    .like(GithubRepo::getRepoName, keyword)
                    .or().like(GithubRepo::getDescription, keyword)
                    .or().like(GithubRepo::getOwnerName, keyword)
                    .or().like(GithubRepo::getFullName, keyword)
            );
        }
        // 多语言筛选（OR 逻辑）
        if (languages != null && !languages.isEmpty() && !languages.contains("")) {
            wrapper.in(GithubRepo::getLanguage, languages);
        }
        if (StringUtils.hasText(dateField) && (StringUtils.hasText(startMonth) || StringUtils.hasText(endMonth))) {
            SFunction<GithubRepo, ?> dateColumn = getDateColumn(dateField);
            if (dateColumn != null) {
                if (StringUtils.hasText(startMonth)) {
                    LocalDateTime startTime = parseMonthStart(startMonth);
                    if (startTime != null) wrapper.ge(dateColumn, startTime);
                }
                if (StringUtils.hasText(endMonth)) {
                    LocalDateTime endTime = parseMonthEnd(endMonth);
                    if (endTime != null) wrapper.le(dateColumn, endTime);
                }
            }
        }

        boolean isAsc = "asc".equalsIgnoreCase(sortOrder);
        switch (sortBy != null ? sortBy : "starred_at") {
            case "stars_count": wrapper.orderBy(true, isAsc, GithubRepo::getStarsCount); break;
            case "forks_count": wrapper.orderBy(true, isAsc, GithubRepo::getForksCount); break;
            case "repo_updated_at": wrapper.orderBy(true, isAsc, GithubRepo::getRepoUpdatedAt); break;
            case "repo_created_at": wrapper.orderBy(true, isAsc, GithubRepo::getRepoCreatedAt); break;
            case "repo_pushed_at": wrapper.orderBy(true, isAsc, GithubRepo::getRepoPushedAt); break;
            default: wrapper.orderBy(true, isAsc, GithubRepo::getStarredAt); break;
        }

        return githubRepoMapper.selectList(wrapper).stream()
                .map(GithubRepo::getHtmlUrl)
                .collect(java.util.stream.Collectors.toList());
    }

    /**
     * 根据ID获取仓库详情（含分类信息）
     */
    public GithubRepo findById(Long id) {
        GithubRepo repo = githubRepoMapper.selectById(id);
        if (repo != null) {
            fillCategoryNames(Collections.singletonList(repo));
        }
        return repo;
    }

    /**
     * 获取所有不重复的编程语言列表（用于筛选下拉框）
     */
    public List<String> findAllLanguages() {
        LambdaQueryWrapper<GithubRepo> wrapper = new LambdaQueryWrapper<>();
        wrapper.select(GithubRepo::getLanguage)
                .isNotNull(GithubRepo::getLanguage)
                .ne(GithubRepo::getLanguage, "")
                .groupBy(GithubRepo::getLanguage)
                .orderByAsc(GithubRepo::getLanguage);
        List<GithubRepo> repos = githubRepoMapper.selectList(wrapper);
        return repos.stream()
                .map(GithubRepo::getLanguage)
                .distinct()
                .collect(java.util.stream.Collectors.toList());
    }

    /**
     * 获取语言统计列表（语言名称 + 对应项目数量）
     */
    public List<LanguageStat> findLanguageStats() {
        QueryWrapper<GithubRepo> wrapper = new QueryWrapper<>();
        wrapper.select("language", "COUNT(*) as count")
                .isNotNull("language")
                .ne("language", "")
                .groupBy("language")
                .orderByDesc("count");

        List<Map<String, Object>> results = githubRepoMapper.selectMaps(wrapper);

        return results.stream()
                .map(row -> {
                    LanguageStat stat = new LanguageStat();
                    stat.setLanguage((String) row.get("language"));
                    stat.setCount(((Number) row.get("count")).longValue());
                    return stat;
                })
                .collect(Collectors.toList());
    }

    /**
     * 查询全部仓库（不分页，仅用于 AI 分类等需要全量数据的场景）
     */
    public List<GithubRepo> findAll(String keyword, String language) {
        return findAll(keyword, language, "starred_at", "desc");
    }

    /**
     * 查询全部仓库（不分页，支持排序）
     */
    public List<GithubRepo> findAll(String keyword, String language, String sortBy, String sortOrder) {
        List<String> languageList = null;
        if (StringUtils.hasText(language)) {
            languageList = Arrays.asList(language.split(","));
        }
        LambdaQueryWrapper<GithubRepo> wrapper = new LambdaQueryWrapper<>();

        if (StringUtils.hasText(keyword)) {
            wrapper.and(w -> w
                    .like(GithubRepo::getRepoName, keyword)
                    .or().like(GithubRepo::getDescription, keyword)
                    .or().like(GithubRepo::getOwnerName, keyword)
                    .or().like(GithubRepo::getFullName, keyword)
            );
        }
        if (languageList != null && !languageList.isEmpty() && !languageList.contains("")) {
            wrapper.in(GithubRepo::getLanguage, languageList);
        }

        boolean isAsc = "asc".equalsIgnoreCase(sortOrder);
        switch (sortBy != null ? sortBy : "starred_at") {
            case "stars_count": wrapper.orderBy(true, isAsc, GithubRepo::getStarsCount); break;
            case "forks_count": wrapper.orderBy(true, isAsc, GithubRepo::getForksCount); break;
            case "repo_updated_at": wrapper.orderBy(true, isAsc, GithubRepo::getRepoUpdatedAt); break;
            case "repo_created_at": wrapper.orderBy(true, isAsc, GithubRepo::getRepoCreatedAt); break;
            case "repo_pushed_at": wrapper.orderBy(true, isAsc, GithubRepo::getRepoPushedAt); break;
            default: wrapper.orderBy(true, isAsc, GithubRepo::getStarredAt); break;
        }

        return githubRepoMapper.selectList(wrapper);
    }

    /**
     * 获取Star仓库总数
     */
    public long count() {
        return githubRepoMapper.selectCount(null);
    }

    /**
     * 获取 Mapper（供 TranslateTaskService 等内部使用）
     */
    public GithubRepoMapper getGithubRepoMapper() {
        return githubRepoMapper;
    }
}
