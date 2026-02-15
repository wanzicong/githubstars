package com.github.stars.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.github.stars.entity.GithubRepo;
import com.github.stars.mapper.GithubRepoMapper;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import com.baomidou.mybatisplus.core.toolkit.support.SFunction;

import javax.annotation.Resource;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.time.format.DateTimeParseException;
import java.util.List;

@Service
public class GithubRepoService {

    @Resource
    private GithubRepoMapper githubRepoMapper;

    /**
     * 分页查询Star仓库列表
     *
     * @param page       当前页码
     * @param size       每页条数
     * @param keyword    搜索关键词（仓库名、描述、作者模糊搜索）
     * @param language   语言筛选
     * @param sortBy     排序字段（stars_count, forks_count, repo_updated_at, starred_at）
     * @param sortOrder  排序方向（asc, desc）
     * @param dateField  时间筛选字段（starred_at, repo_created_at, repo_updated_at, repo_pushed_at）
     * @param startMonth 开始月份（格式：yyyy-MM）
     * @param endMonth   结束月份（格式：yyyy-MM）
     * @return 分页结果
     */
    public IPage<GithubRepo> findPage(int page, int size, String keyword, String language,
                                      String sortBy, String sortOrder,
                                      String dateField, String startMonth, String endMonth) {
        Page<GithubRepo> pageParam = new Page<>(page, size);
        LambdaQueryWrapper<GithubRepo> wrapper = new LambdaQueryWrapper<>();

        // 关键词搜索：仓库名、描述、作者模糊匹配
        if (StringUtils.hasText(keyword)) {
            wrapper.and(w -> w
                    .like(GithubRepo::getRepoName, keyword)
                    .or().like(GithubRepo::getDescription, keyword)
                    .or().like(GithubRepo::getOwnerName, keyword)
                    .or().like(GithubRepo::getFullName, keyword)
            );
        }

        // 语言筛选
        if (StringUtils.hasText(language)) {
            wrapper.eq(GithubRepo::getLanguage, language);
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

        return githubRepoMapper.selectPage(pageParam, wrapper);
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
                                    String dateField, String startMonth, String endMonth) {
        LambdaQueryWrapper<GithubRepo> wrapper = new LambdaQueryWrapper<>();
        wrapper.select(GithubRepo::getHtmlUrl);

        if (StringUtils.hasText(keyword)) {
            wrapper.and(w -> w
                    .like(GithubRepo::getRepoName, keyword)
                    .or().like(GithubRepo::getDescription, keyword)
                    .or().like(GithubRepo::getOwnerName, keyword)
                    .or().like(GithubRepo::getFullName, keyword)
            );
        }
        if (StringUtils.hasText(language)) {
            wrapper.eq(GithubRepo::getLanguage, language);
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
     * 根据ID获取仓库详情
     */
    public GithubRepo findById(Long id) {
        return githubRepoMapper.selectById(id);
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
     * 获取Star仓库总数
     */
    public long count() {
        return githubRepoMapper.selectCount(null);
    }
}
