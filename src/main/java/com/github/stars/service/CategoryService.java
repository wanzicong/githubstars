package com.github.stars.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.github.stars.entity.Category;
import com.github.stars.entity.GithubRepo;
import com.github.stars.mapper.CategoryMapper;
import com.github.stars.mapper.GithubRepoMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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
     * 获取所有分类（含仓库数量）
     */
    public List<Category> listAll() {
        List<Category> categories = categoryMapper.selectList(null);
        for (Category cat : categories) {
            cat.setRepoCount(categoryMapper.countReposByCategoryId(cat.getId()));
        }
        // 按仓库数量从大到小排序
        categories.sort((a, b) -> Integer.compare(
                b.getRepoCount() == null ? 0 : b.getRepoCount(),
                a.getRepoCount() == null ? 0 : a.getRepoCount()));
        return categories;
    }

    /**
     * 根据ID获取分类
     */
    public Category getById(Long id) {
        return categoryMapper.selectById(id);
    }

    /**
     * 新增分类
     */
    @Transactional
    public Category create(String name, String description) {
        Category category = new Category();
        category.setName(name);
        category.setDescription(description);
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
     * 获取分类下的仓库列表
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
        categoryMapper.batchInsertRepoCategory(repoIds, categoryId);
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
