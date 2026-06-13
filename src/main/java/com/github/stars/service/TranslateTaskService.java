package com.github.stars.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.github.stars.entity.GithubRepo;
import com.github.stars.entity.TranslationTask;
import com.github.stars.entity.TranslationTaskItem;
import com.github.stars.mapper.TranslationTaskItemMapper;
import com.github.stars.mapper.TranslationTaskMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import javax.annotation.Resource;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.Executor;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Semaphore;
import java.util.concurrent.TimeUnit;

@Service
public class TranslateTaskService {

    private static final Logger log = LoggerFactory.getLogger(TranslateTaskService.class);
    private static final int MAX_RETRIES = 3;
    private static final int MAX_CONCURRENT = 10;

    // 并发控制信号量，最多 10 个同时翻译
    private final Semaphore semaphore = new Semaphore(MAX_CONCURRENT);

    @Resource
    private TranslationTaskMapper taskMapper;

    @Resource
    private TranslationTaskItemMapper itemMapper;

    @Resource
    private GithubRepoService githubRepoService;

    @Resource
    private TranslateService translateService;

    /**
     * 创建并启动单个仓库的 README 翻译（异步，立即返回 taskId）
     */
    public Long createAndStartSingleReadme(Long repoId) {
        GithubRepo repo = githubRepoService.findById(repoId);
        if (repo == null) return null;

        TranslationTask task = new TranslationTask();
        task.setStatus("PENDING");
        task.setTotalItems(1);
        task.setCompletedItems(0);
        task.setFailedItems(0);
        task.setDescTotal(0);
        task.setDescCompleted(0);
        task.setDescFailed(0);
        task.setReadmeTotal(1);
        task.setReadmeCompleted(0);
        task.setReadmeFailed(0);
        task.setCreatedAt(LocalDateTime.now());
        taskMapper.insert(task);

        Long taskId = task.getId();

        TranslationTaskItem item = new TranslationTaskItem();
        item.setTaskId(taskId);
        item.setRepoId(repoId);
        item.setFullName(repo.getFullName());
        item.setTranslateType("readme");
        item.setStatus("PENDING");
        item.setRetryCount(0);
        item.setCreatedAt(LocalDateTime.now());
        itemMapper.insert(item);

        startTaskAsync(taskId);
        return taskId;
    }

    /**
     * 创建并启动单个仓库的 README 强制重新翻译（忽略已处理标记）
     */
    public Long createAndStartSingleReadmeForce(Long repoId) {
        GithubRepo repo = githubRepoService.findById(repoId);
        if (repo == null) return null;

        // 重置标记，允许重新获取和翻译
        repo.setReadmeFetched(false);
        repo.setReadmeOriginal(null);
        repo.setReadmeCn(null);
        githubRepoService.getGithubRepoMapper().updateById(repo);

        return createAndStartSingleReadme(repoId);
    }

    /**
     * 创建并启动 README 批量翻译任务（翻译全部未获取 README 的仓库，异步，10 并发，重试 3 次）
     */
    public Long createAndStartReadmeBatch() {
        cleanOldTasks();

        // 查询全部仓库
        List<GithubRepo> allRepos = githubRepoService.findAll("", "");

        // 只翻译没有中文README的项目(readmeCn为空)
        List<Long> needReadme = new ArrayList<>();
        for (GithubRepo repo : allRepos) {
            if (repo.getReadmeCn() == null || repo.getReadmeCn().isEmpty()) {
                needReadme.add(repo.getId());
            }
        }

        if (needReadme.isEmpty()) {
            log.info("没有需要翻译 README 的项目");
            return null;
        }

        log.info("创建 README 批量翻译任务：{} 项（全部仓库）", needReadme.size());

        TranslationTask task = new TranslationTask();
        task.setStatus("PENDING");
        task.setTotalItems(needReadme.size());
        task.setCompletedItems(0);
        task.setFailedItems(0);
        task.setDescTotal(0);
        task.setDescCompleted(0);
        task.setDescFailed(0);
        task.setReadmeTotal(needReadme.size());
        task.setReadmeCompleted(0);
        task.setReadmeFailed(0);
        task.setCreatedAt(LocalDateTime.now());
        taskMapper.insert(task);

        Long taskId = task.getId();

        List<TranslationTaskItem> items = new ArrayList<>();
        for (Long repoId : needReadme) {
            GithubRepo repo = githubRepoService.findById(repoId);
            TranslationTaskItem item = new TranslationTaskItem();
            item.setTaskId(taskId);
            item.setRepoId(repoId);
            item.setFullName(repo != null ? repo.getFullName() : String.valueOf(repoId));
            item.setTranslateType("readme");
            item.setStatus("PENDING");
            item.setRetryCount(0);
            item.setCreatedAt(LocalDateTime.now());
            items.add(item);
        }
        for (TranslationTaskItem item : items) {
            itemMapper.insert(item);
        }

        startTaskAsync(taskId);
        return taskId;
    }

    /**
     * 创建并启动全量翻译任务（异步）
     *
     * @return 任务ID
     */
    public Long createAndStartFullTranslate() {
        // 清理已完成/失败的历史任务
        cleanOldTasks();

        // 查询需要翻译的仓库
        List<GithubRepo> allRepos = githubRepoService.findAll("", "");

        // 统计需要翻译的项
        List<Long> needDesc = new ArrayList<>();
        List<Long> needReadme = new ArrayList<>();

        for (GithubRepo repo : allRepos) {
            if (repo.getDescription() != null && !repo.getDescription().isEmpty()
                    && (repo.getDescriptionCn() == null || repo.getDescriptionCn().isEmpty())) {
                needDesc.add(repo.getId());
            }
            if (!Boolean.TRUE.equals(repo.getReadmeFetched())) {
                needReadme.add(repo.getId());
            }
        }

        int totalItems = needDesc.size() + needReadme.size();
        if (totalItems == 0) {
            log.info("没有需要翻译的项目");
            return null;
        }

        log.info("创建翻译任务：描述 {} 项，README {} 项，共 {} 项", needDesc.size(), needReadme.size(), totalItems);

        // 创建任务记录
        TranslationTask task = new TranslationTask();
        task.setStatus("PENDING");
        task.setTotalItems(totalItems);
        task.setCompletedItems(0);
        task.setFailedItems(0);
        task.setDescTotal(needDesc.size());
        task.setDescCompleted(0);
        task.setDescFailed(0);
        task.setReadmeTotal(needReadme.size());
        task.setReadmeCompleted(0);
        task.setReadmeFailed(0);
        task.setCreatedAt(LocalDateTime.now());
        taskMapper.insert(task);

        Long taskId = task.getId();

        // 创建翻译项记录
        List<TranslationTaskItem> items = new ArrayList<>();
        for (Long repoId : needDesc) {
            GithubRepo repo = githubRepoService.findById(repoId);
            TranslationTaskItem item = new TranslationTaskItem();
            item.setTaskId(taskId);
            item.setRepoId(repoId);
            item.setFullName(repo != null ? repo.getFullName() : String.valueOf(repoId));
            item.setTranslateType("description");
            item.setStatus("PENDING");
            item.setRetryCount(0);
            item.setCreatedAt(LocalDateTime.now());
            items.add(item);
        }
        for (Long repoId : needReadme) {
            GithubRepo repo = githubRepoService.findById(repoId);
            TranslationTaskItem item = new TranslationTaskItem();
            item.setTaskId(taskId);
            item.setRepoId(repoId);
            item.setFullName(repo != null ? repo.getFullName() : String.valueOf(repoId));
            item.setTranslateType("readme");
            item.setStatus("PENDING");
            item.setRetryCount(0);
            item.setCreatedAt(LocalDateTime.now());
            items.add(item);
        }

        // 批量插入
        for (TranslationTaskItem item : items) {
            itemMapper.insert(item);
        }

        // 异步启动翻译
        startTaskAsync(taskId);

        return taskId;
    }

    @Async("translateExecutor")
    public void startTaskAsync(Long taskId) {
        TranslationTask task = taskMapper.selectById(taskId);
        if (task == null) return;

        task.setStatus("PROCESSING");
        taskMapper.updateById(task);

        // 查询所有待翻译项
        List<TranslationTaskItem> items = itemMapper.selectList(
                new LambdaQueryWrapper<TranslationTaskItem>()
                        .eq(TranslationTaskItem::getTaskId, taskId)
                        .eq(TranslationTaskItem::getStatus, "PENDING")
        );

        log.info("翻译任务 {} 开始执行，共 {} 项", taskId, items.size());

        // 使用 CompletableFuture 并发控制
        List<CompletableFuture<Void>> futures = new ArrayList<>();
        for (TranslationTaskItem item : items) {
            CompletableFuture<Void> future = CompletableFuture.runAsync(() -> {
                processItemWithRetry(item);
            }, java.util.concurrent.Executors.newSingleThreadExecutor());
            futures.add(future);
        }

        // 等待所有完成（通过信号量控制并发）
        CompletableFuture.allOf(futures.toArray(new CompletableFuture[0])).join();

        // 更新任务状态
        task = taskMapper.selectById(taskId);
        task.setStatus("COMPLETED");
        task.setFinishedAt(LocalDateTime.now());
        taskMapper.updateById(task);
        log.info("翻译任务 {} 完成: 成功 {}，失败 {}", taskId, task.getCompletedItems(), task.getFailedItems());
    }

    /**
     * 处理单个翻译项（带重试）
     */
    private void processItemWithRetry(TranslationTaskItem item) {
        boolean acquired = false;
        try {
            // 获取信号量（限制并发）
            semaphore.acquire();
            acquired = true;

            int retries = 0;
            boolean success = false;
            String lastError = null;

            while (retries <= MAX_RETRIES && !success) {
                if (retries > 0) {
                    log.info("重试 {}/{}: {} - {}", retries, MAX_RETRIES,
                            item.getFullName(), item.getTranslateType());
                    // 重试等待：指数退避 2^retry 秒
                    TimeUnit.SECONDS.sleep((long) Math.pow(2, retries));
                }

                try {
                    // 更新状态为处理中
                    item.setStatus("PROCESSING");
                    item.setRetryCount(retries);
                    item.setUpdatedAt(LocalDateTime.now());
                    itemMapper.updateById(item);

                    if ("description".equals(item.getTranslateType())) {
                        String result = translateService.translateDescription(item.getRepoId());
                        success = result != null;
                    } else if ("readme".equals(item.getTranslateType())) {
                        String result = translateService.translateReadme(item.getRepoId());
                        success = result != null;
                    }

                    if (!success) {
                        lastError = "翻译返回空结果";
                        retries++;
                    }
                } catch (Exception e) {
                    lastError = e.getMessage();
                    log.warn("翻译失败 ({}) {}: {}", item.getTranslateType(), item.getFullName(), e.getMessage());
                    retries++;
                }
            }

            // 更新最终状态
            synchronized (this) {
                TranslationTask task = taskMapper.selectById(item.getTaskId());
                if (success) {
                    item.setStatus("SUCCESS");
                    item.setUpdatedAt(LocalDateTime.now());
                    itemMapper.updateById(item);
                    task.setCompletedItems(task.getCompletedItems() + 1);
                    if ("description".equals(item.getTranslateType())) {
                        task.setDescCompleted(task.getDescCompleted() + 1);
                    } else {
                        task.setReadmeCompleted(task.getReadmeCompleted() + 1);
                    }
                } else {
                    item.setStatus("FAILED");
                    item.setErrorMessage(lastError);
                    item.setUpdatedAt(LocalDateTime.now());
                    itemMapper.updateById(item);
                    task.setFailedItems(task.getFailedItems() + 1);
                    if ("description".equals(item.getTranslateType())) {
                        task.setDescFailed(task.getDescFailed() + 1);
                    } else {
                        task.setReadmeFailed(task.getReadmeFailed() + 1);
                    }
                }
                taskMapper.updateById(task);
            }

        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            log.error("翻译线程被中断: {}", item.getFullName());
        } finally {
            if (acquired) {
                semaphore.release();
            }
        }
    }

    /**
     * 清理旧任务（保留最近 10 条）
     */
    private void cleanOldTasks() {
        // 只清理已完成/失败的旧任务
        List<TranslationTask> oldTasks = taskMapper.selectList(
                new LambdaQueryWrapper<TranslationTask>()
                        .in(TranslationTask::getStatus, "COMPLETED", "FAILED")
                        .orderByDesc(TranslationTask::getId)
                        .last("LIMIT 1000 OFFSET 10")
        );
        for (TranslationTask task : oldTasks) {
            // 删除任务项
            itemMapper.delete(new LambdaQueryWrapper<TranslationTaskItem>()
                    .eq(TranslationTaskItem::getTaskId, task.getId()));
            // 删除任务
            taskMapper.deleteById(task.getId());
        }
    }

    /**
     * 基于筛选条件创建批量翻译任务（翻译 README，异步执行）
     */
    public Long createAndStartFilterBatch(String keyword, String language, String categoryIds,
                                          String sortBy, String sortOrder,
                                          String dateField, String startDate, String endDate) {
        cleanOldTasks();

        // 查询符合筛选条件且 README 未翻译的仓库
        List<String> languageList = null;
        if (org.springframework.util.StringUtils.hasText(language)) {
            languageList = java.util.Arrays.asList(language.split(","));
        }
        List<Long> catIdList = null;
        if (org.springframework.util.StringUtils.hasText(categoryIds)) {
            catIdList = java.util.Arrays.stream(categoryIds.split(","))
                    .filter(s -> !s.isEmpty()).map(Long::valueOf)
                    .collect(java.util.stream.Collectors.toList());
        }

        LambdaQueryWrapper<GithubRepo> wrapper = new LambdaQueryWrapper<>();
        wrapper.select(GithubRepo::getId, GithubRepo::getFullName);

        if (catIdList != null && !catIdList.isEmpty()) {
            String ids = catIdList.stream().map(String::valueOf)
                    .collect(java.util.stream.Collectors.joining(","));
            wrapper.inSql(GithubRepo::getId,
                    "SELECT repo_id FROM repo_category WHERE category_id IN (" + ids + ")");
        }
        if (org.springframework.util.StringUtils.hasText(keyword)) {
            wrapper.and(w -> w
                    .like(GithubRepo::getRepoName, keyword)
                    .or().like(GithubRepo::getDescription, keyword)
                    .or().like(GithubRepo::getOwnerName, keyword)
                    .or().like(GithubRepo::getFullName, keyword));
        }
        if (languageList != null && !languageList.isEmpty() && !languageList.contains("")) {
            wrapper.in(GithubRepo::getLanguage, languageList);
        }
        // 只查 README 未翻译的（readmeCn 为空）
        wrapper.and(w -> w.isNull(GithubRepo::getReadmeCn)
                .or().eq(GithubRepo::getReadmeCn, ""));

        List<GithubRepo> repos = githubRepoService.getGithubRepoMapper().selectList(wrapper);
        if (repos.isEmpty()) {
            log.info("根据筛选条件没有需要翻译 README 的项目");
            return null;
        }

        List<Long> needReadme = repos.stream().map(GithubRepo::getId).collect(java.util.stream.Collectors.toList());

        log.info("创建筛选批量 README 翻译任务：{} 项", needReadme.size());

        TranslationTask task = new TranslationTask();
        task.setStatus("PENDING");
        task.setTotalItems(needReadme.size());
        task.setCompletedItems(0);
        task.setFailedItems(0);
        task.setDescTotal(0);
        task.setDescCompleted(0);
        task.setDescFailed(0);
        task.setReadmeTotal(needReadme.size());
        task.setReadmeCompleted(0);
        task.setReadmeFailed(0);
        task.setCreatedAt(LocalDateTime.now());
        taskMapper.insert(task);

        Long taskId = task.getId();

        for (GithubRepo repo : repos) {
            TranslationTaskItem item = new TranslationTaskItem();
            item.setTaskId(taskId);
            item.setRepoId(repo.getId());
            item.setFullName(repo.getFullName());
            item.setTranslateType("readme");
            item.setStatus("PENDING");
            item.setRetryCount(0);
            item.setCreatedAt(LocalDateTime.now());
            itemMapper.insert(item);
        }

        startTaskAsync(taskId);
        return taskId;
    }

    /**
     * 重试失败项
     */
    public Long retryFailed(Long taskId) {
        TranslationTask task = taskMapper.selectById(taskId);
        if (task == null) return null;

        List<TranslationTaskItem> failedItems = itemMapper.selectList(
                new LambdaQueryWrapper<TranslationTaskItem>()
                        .eq(TranslationTaskItem::getTaskId, taskId)
                        .eq(TranslationTaskItem::getStatus, "FAILED")
        );

        if (failedItems.isEmpty()) return null;

        // 新建子任务
        TranslationTask retryTask = new TranslationTask();
        retryTask.setStatus("PENDING");
        retryTask.setTotalItems(failedItems.size());
        retryTask.setCompletedItems(0);
        retryTask.setFailedItems(0);
        retryTask.setDescTotal(0);
        retryTask.setDescCompleted(0);
        retryTask.setDescFailed(0);
        retryTask.setReadmeTotal(0);
        retryTask.setReadmeCompleted(0);
        retryTask.setReadmeFailed(0);
        retryTask.setCreatedAt(LocalDateTime.now());
        taskMapper.insert(retryTask);

        Long newTaskId = retryTask.getId();

        for (TranslationTaskItem failed : failedItems) {
            TranslationTaskItem newItem = new TranslationTaskItem();
            newItem.setTaskId(newTaskId);
            newItem.setRepoId(failed.getRepoId());
            newItem.setFullName(failed.getFullName());
            newItem.setTranslateType(failed.getTranslateType());
            newItem.setStatus("PENDING");
            newItem.setRetryCount(0);
            newItem.setCreatedAt(LocalDateTime.now());
            itemMapper.insert(newItem);
        }

        // 更新计数
        for (TranslationTaskItem failed : failedItems) {
            if ("description".equals(failed.getTranslateType())) {
                retryTask.setDescTotal(retryTask.getDescTotal() + 1);
            } else {
                retryTask.setReadmeTotal(retryTask.getReadmeTotal() + 1);
            }
        }
        taskMapper.updateById(retryTask);

        startTaskAsync(newTaskId);
        return newTaskId;
    }
}
