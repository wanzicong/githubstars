package com.github.stars.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.github.stars.entity.Category;
import com.github.stars.entity.GithubRepo;
import com.github.stars.mapper.CategoryMapper;
import com.github.stars.mapper.GithubRepoMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import javax.annotation.Resource;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class CategoryService {

    private static final Logger log = LoggerFactory.getLogger(CategoryService.class);

    @Resource
    private CategoryMapper categoryMapper;

    @Resource
    private GithubRepoMapper githubRepoMapper;

    /**
     * 获取所有分类（含仓库数量，树形结构）
     */
    public List<Category> listAll() {
        List<Category> all = categoryMapper.selectList(null);
        // 构建树形结构：一级分类包含其二级子分类
        Map<Long, Category> map = new LinkedHashMap<>();
        List<Category> roots = new ArrayList<>();
        for (Category c : all) {
            // level 从数据库读取,不再计算
            c.setRepoCount(categoryMapper.countReposByCategoryId(c.getId()));
            map.put(c.getId(), c);
            if (c.getChildren() == null) c.setChildren(new ArrayList<>());
        }
        for (Category c : all) {
            // Level 2 且有父级的,挂载到父级下; Level 1 或无父级的作为根节点
            if (c.getLevel() != null && c.getLevel() == 2 && c.getParentId() != null) {
                Category parent = map.get(c.getParentId());
                if (parent != null) {
                    parent.getChildren().add(c);
                } else {
                    roots.add(c); // 父级不存在,作为根节点
                }
            } else {
                roots.add(c); // L1 或未归属的 L2 都作为根节点
            }
        }
        // 一级分类的仓库数量 = 自身 + 所有子分类的仓库数之和
        for (Category root : roots) {
            int total = root.getRepoCount() != null ? root.getRepoCount() : 0;
            if (root.getChildren() != null) {
                for (Category child : root.getChildren()) {
                    total += child.getRepoCount() != null ? child.getRepoCount() : 0;
                }
            }
            root.setRepoCount(total);
        }
        // 按总仓库数量从大到小排序
        roots.sort((a, b) -> Integer.compare(
                b.getRepoCount() == null ? 0 : b.getRepoCount(),
                a.getRepoCount() == null ? 0 : a.getRepoCount()));
        return roots;
    }

    /**
     * 根据ID获取分类
     */
    public Category getById(Long id) {
        return categoryMapper.selectById(id);
    }

    /**
     * 新增分类（无父分类）
     */
    @Transactional
    public Category create(String name, String description) {
        return create(name, description, null);
    }

    /**
     * 新增分类（支持指定父分类）
     */
    @Transactional
    public Category create(String name, String description, Long parentId) {
        // 检查重名
        Category existing = categoryMapper.selectOne(new LambdaQueryWrapper<Category>().eq(Category::getName, name));
        if (existing != null) throw new RuntimeException("分类名已存在: " + name);
        Category category = new Category();
        category.setName(name.trim());
        category.setDescription(description);
        category.setParentId(parentId);
        category.setLevel(parentId != null ? 2 : 1);
        category.setSortOrder(0);
        category.setCreatedAt(LocalDateTime.now());
        category.setUpdatedAt(LocalDateTime.now());
        categoryMapper.insert(category);
        return category;
    }

    /**
     * 更新分类
     */
    @Transactional
    public void update(Long id, String name, String description) {
        Category category = categoryMapper.selectById(id);
        if (category != null) {
            category.setName(name);
            category.setDescription(description);
            category.setUpdatedAt(LocalDateTime.now());
            categoryMapper.updateById(category);
        }
    }

    /**
     * 删除分类及其关联关系（不删除仓库本身）
     */
    @Transactional
    public void delete(Long id) {
        categoryMapper.deleteAllRepoCategory(id);
        categoryMapper.deleteById(id);
    }

    /**
     * 批量删除分类（不删除仓库，只清除关联关系）
     */
    @Transactional
    public void batchDelete(List<Long> ids) {
        for (Long id : ids) {
            categoryMapper.deleteAllRepoCategory(id);
            categoryMapper.deleteById(id);
        }
    }

    /**
     * 移动分类到指定父分类
     */
    @Transactional
    public void moveToParent(Long categoryId, Long newParentId) {
        Category category = categoryMapper.selectById(categoryId);
        if (category == null) throw new RuntimeException("分类不存在");
        category.setParentId(newParentId);
        category.setUpdatedAt(LocalDateTime.now());
        categoryMapper.updateById(category);
        log.info("分类 {} 已移至父分类 {}", category.getName(), newParentId);
    }

    /**
     * 分页查询分类下的仓库列表（支持搜索、排序、分类标签）
     */
    public Page<GithubRepo> getReposByCategoryIdPaged(Long categoryId, int page, int size,
                                                       String keyword, String language,
                                                       String sortBy, String sortOrder) {
        List<Long> repoIds = categoryMapper.selectRepoIdsByCategoryId(categoryId);
        if (repoIds.isEmpty()) {
            Page<GithubRepo> empty = new Page<>(page, size);
            empty.setRecords(Collections.emptyList());
            empty.setTotal(0);
            return empty;
        }

        Page<GithubRepo> pageParam = new Page<>(page, size);
        LambdaQueryWrapper<GithubRepo> wrapper = new LambdaQueryWrapper<>();
        wrapper.in(GithubRepo::getId, repoIds);

        // 关键词搜索
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
            List<String> langList = Arrays.asList(language.split(","));
            wrapper.in(GithubRepo::getLanguage, langList);
        }

        // 排序
        boolean isAsc = "asc".equalsIgnoreCase(sortOrder);
        switch (sortBy != null ? sortBy : "stars_count") {
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

        Page<GithubRepo> result = githubRepoMapper.selectPage(pageParam, wrapper);
        fillCategoryNames(result.getRecords());
        return result;
    }

    /**
     * 获取分类下的仓库列表（不分页，兼容旧接口）
     */
    public List<GithubRepo> getReposByCategoryId(Long categoryId) {
        List<Long> repoIds = categoryMapper.selectRepoIdsByCategoryId(categoryId);
        if (repoIds.isEmpty()) {
            return Collections.emptyList();
        }
        List<GithubRepo> repos = githubRepoMapper.selectBatchIds(repoIds);
        // 按 Star 数量从大到小排序
        repos.sort((a, b) -> Integer.compare(
                b.getStarsCount() == null ? 0 : b.getStarsCount(),
                a.getStarsCount() == null ? 0 : a.getStarsCount()));
        return repos;
    }

    /**
     * 获取仓库所属的分类
     */
    public List<Category> getCategoriesByRepoId(Long repoId) {
        List<Long> categoryIds = categoryMapper.selectCategoryIdsByRepoId(repoId);
        if (categoryIds.isEmpty()) {
            return Collections.emptyList();
        }
        return categoryMapper.selectBatchIds(categoryIds);
    }

    /**
     * 添加仓库到分类
     */
    @Transactional
    public void addRepoToCategory(Long repoId, Long categoryId) {
        categoryMapper.insertRepoCategory(repoId, categoryId);
    }

    /**
     * 批量添加仓库到分类
     */
    @Transactional
    public void batchAddReposToCategory(List<Long> repoIds, Long categoryId) {
        Category cat = categoryMapper.selectById(categoryId);
        if (cat != null && cat.getLevel() != null && cat.getLevel() == 1) {
            throw new RuntimeException("一级分类不能直接包含仓库，请先将仓库添加到二级分类");
        }
        categoryMapper.batchInsertRepoCategory(repoIds, categoryId);
    }

    /**
     * 展开分类ID：如果是一级分类，替换为其所有二级子分类的ID
     * 用于搜索时自动包含子分类
     */
    public List<Long> expandCategoryIds(List<Long> categoryIds) {
        if (categoryIds == null || categoryIds.isEmpty()) return categoryIds;
        List<Long> expanded = new ArrayList<>();
        for (Long id : categoryIds) {
            Category cat = categoryMapper.selectById(id);
            if (cat != null && cat.getLevel() != null && cat.getLevel() == 1) {
                // 一级分类：替换为所有二级子分类
                List<Category> children = categoryMapper.selectList(
                    new LambdaQueryWrapper<Category>().eq(Category::getParentId, id));
                for (Category child : children) expanded.add(child.getId());
                if (children.isEmpty()) expanded.add(id); // 没有子分类则保留自身
            } else {
                expanded.add(id); // 二级分类直接保留
            }
        }
        return expanded;
    }

    /**
     * 从分类中移除仓库
     */
    @Transactional
    public void removeRepoFromCategory(Long repoId, Long categoryId) {
        categoryMapper.deleteRepoCategory(repoId, categoryId);
    }

    /**
     * 仓库分类转移：从一个分类移到另一个分类
     */
    @Transactional
    public void transferRepo(Long repoId, Long fromCategoryId, Long toCategoryId) {
        categoryMapper.deleteRepoCategory(repoId, fromCategoryId);
        categoryMapper.insertRepoCategory(repoId, toCategoryId);
    }

    /**
     * 批量转移：将多个仓库从源分类移到目标分类
     */
    @Transactional
    public void batchTransferRepos(List<Long> repoIds, Long fromCategoryId, Long toCategoryId) {
        for (Long repoId : repoIds) {
            categoryMapper.deleteRepoCategory(repoId, fromCategoryId);
            categoryMapper.insertRepoCategory(repoId, toCategoryId);
        }
    }

    /**
     * 移除未分类仓库（从所有分类中移除）
     */
    @Transactional
    public void clearRepoCategories(Long repoId) {
        categoryMapper.deleteAllCategoriesByRepoId(repoId);
    }

    /**
     * 从 AI 分类结果保存到数据库
     * @param categories AI 分类结果 Map<类别名, List<仓库ID>>
     */
    @Transactional
    public void saveAiClassifyResult(Map<String, List<Long>> categories) {
        for (Map.Entry<String, List<Long>> entry : categories.entrySet()) {
            String categoryName = entry.getKey();
            List<Long> repoIds = entry.getValue();

            if (repoIds == null || repoIds.isEmpty()) {
                continue;
            }

            // 查找或创建分类
            Category category = categoryMapper.selectOne(
                    new LambdaQueryWrapper<Category>().eq(Category::getName, categoryName));
            if (category == null) {
                category = create(categoryName, null);
            }

            // 先清除这些仓库的旧分类
            for (Long repoId : repoIds) {
                categoryMapper.deleteAllCategoriesByRepoId(repoId);
            }

            // 批量添加到新分类
            categoryMapper.batchInsertRepoCategory(repoIds, category.getId());
        }
        log.info("AI 分类结果已保存: {} 个分类", categories.size());
    }

    /**
     * 获取所有分类及其仓库（用于分类管理页面）
     */
    public List<Map<String, Object>> listAllWithRepos() {
        List<Category> categories = listAll();
        List<Map<String, Object>> result = new ArrayList<>();
        for (Category cat : categories) {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("category", cat);
            item.put("repos", getReposByCategoryId(cat.getId()));
            result.add(item);
        }
        return result;
    }

    /**
     * 批量填充分类名称到仓库列表
     */
    private void fillCategoryNames(List<GithubRepo> repos) {
        if (repos == null || repos.isEmpty()) return;
        List<Long> repoIds = repos.stream().map(GithubRepo::getId).collect(Collectors.toList());
        List<Map<String, Object>> rows = categoryMapper.selectCategoryNamesByRepoIds(repoIds);
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
     * 获取未分类仓库列表
     */
    public List<GithubRepo> getUncategorizedRepos() {
        List<GithubRepo> allRepos = githubRepoMapper.selectList(null);
        List<GithubRepo> uncategorized = new ArrayList<>();
        for (GithubRepo repo : allRepos) {
            List<Long> catIds = categoryMapper.selectCategoryIdsByRepoId(repo.getId());
            if (catIds.isEmpty()) {
                uncategorized.add(repo);
            }
        }
        return uncategorized;
    }
}
