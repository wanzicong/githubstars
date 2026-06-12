package com.github.stars.service;

import com.baomidou.mybatisplus.core.metadata.IPage;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.github.stars.entity.CloneResult;
import com.github.stars.entity.CloneTask;
import com.github.stars.entity.CloneTaskItem;
import com.github.stars.entity.GithubRepo;
import com.github.stars.mapper.CloneTaskItemMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.ApplicationContext;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import javax.annotation.PostConstruct;
import javax.annotation.PreDestroy;
import javax.annotation.Resource;
import java.io.File;
import java.io.IOException;
import java.net.ConnectException;
import java.net.SocketTimeoutException;
import java.net.UnknownHostException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.regex.Pattern;

/**
 * 批量 Clone 服务 - 后台异步执行 git clone，持久化任务进度到数据库
 */
@Service
public class CloneService {

    private static final Logger log = LoggerFactory.getLogger(CloneService.class);
    private static final int MAX_SUBDIRECTORY_HISTORY = 20;
    private static final int MAX_RETRY_ATTEMPTS = 3;
    private static final int[] RETRY_BACKOFF_SECONDS = {5, 15, 45};
    private static final int DEFAULT_CLONE_TIMEOUT_SECONDS = 600;
    private static final int DEFAULT_CLONE_DEPTH = 1;
    private static final int DEFAULT_MAX_REPO_SIZE_MB = 500;
    private static final int ESTIMATED_AVG_REPO_SIZE_MB = 50;
    private static final double DISK_SAFETY_FACTOR = 2.0;
    private static final String HISTORY_KEY = "clone.subdirectory.history";
    private static final String LAST_SUBDIRECTORY_KEY = "clone.subdirectory.last";
    private static final Pattern INVALID_SEGMENT = Pattern.compile("[<>:\"|?*\\x00-\\x1f]");
    private static final Set<String> WINDOWS_RESERVED = new HashSet<>(Arrays.asList(
            "CON", "PRN", "AUX", "NUL",
            "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8", "COM9",
            "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9"
    ));
    private static final Set<String> NON_RETRYABLE_ERRORS = new HashSet<>(Arrays.asList(
            "Repository not found", "not found", "repository does not exist",
            "Authentication failed", "could not read Username",
            "Invalid path", "Permission denied (publickey)",
            "remote: Repository not found"
    ));

    @Resource
    private GithubRepoService githubRepoService;

    @Resource
    private SystemConfigService configService;

    @Resource
    private CloneTaskService cloneTaskService;

    @Resource
    private CloneTaskItemMapper cloneTaskItemMapper;

    @Resource
    private ApplicationContext applicationContext;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final Object historyLock = new Object();
    private final AtomicInteger taskCounter = new AtomicInteger(0);

    /** 运行中任务的实时进度缓存（key=taskId），完成后移除 */
    private final ConcurrentHashMap<String, CloneTask> runningTaskCache = new ConcurrentHashMap<>();
    /** 已取消的任务 ID 集合，供执行中的克隆检查 */
    private final Set<String> cancelledTasks = ConcurrentHashMap.newKeySet();

    /** 共享调度器，替代 Timer */
    private final ScheduledExecutorService scheduledExecutor =
            Executors.newSingleThreadScheduledExecutor(r -> {
                Thread t = new Thread(r, "clone-scheduler");
                t.setDaemon(true);
                return t;
            });

    @PreDestroy
    public void shutdown() {
        scheduledExecutor.shutdown();
    }

    /**
     * 服务启动时从数据库初始化 taskCounter，避免重启后 ID 重复
     */
    @PostConstruct
    public void initTaskCounter() {
        int maxNum = cloneTaskService.getMaxTaskCounterNumber();
        taskCounter.set(maxNum);
        log.info("CloneService taskCounter 初始化: {}", maxNum);
    }

    // ======================== 目录 / 配置方法 ========================

    public String getBaseDirectory() {
        return configService.getValue("clone.directory", "D:/github-stars");
    }

    public List<String> getSubdirectoryHistory() {
        String json = configService.getValue(HISTORY_KEY, "[]");
        try {
            List<String> history = objectMapper.readValue(json, new TypeReference<List<String>>() {});
            return history != null ? Collections.unmodifiableList(history) : Collections.emptyList();
        } catch (Exception e) {
            log.warn("解析子目录历史失败: {}", e.getMessage());
            return Collections.emptyList();
        }
    }

    public String getLastSubdirectory() {
        return configService.getValue(LAST_SUBDIRECTORY_KEY, "");
    }

    public boolean hasActiveTask() {
        return cloneTaskService.hasActiveTask();
    }

    public String sanitizeSubdirectory(String subDirectory) {
        if (subDirectory == null || subDirectory.trim().isEmpty()) {
            return "";
        }
        String normalized = subDirectory.trim().replace('\\', '/');
        while (normalized.startsWith("/")) {
            normalized = normalized.substring(1);
        }
        while (normalized.endsWith("/")) {
            normalized = normalized.substring(0, normalized.length() - 1);
        }
        if (normalized.contains(":")) {
            throw new IllegalArgumentException("子目录不能包含盘符或冒号");
        }

        String[] segments = normalized.split("/");
        for (String segment : segments) {
            if (segment.isEmpty()) {
                throw new IllegalArgumentException("子目录不能包含空路径段");
            }
            if (".".equals(segment) || "..".equals(segment)) {
                throw new IllegalArgumentException("子目录不能包含 . 或 .. 路径段");
            }
            if (INVALID_SEGMENT.matcher(segment).find()) {
                throw new IllegalArgumentException("子目录包含非法字符");
            }
            if (WINDOWS_RESERVED.contains(segment.toUpperCase(Locale.ROOT))) {
                throw new IllegalArgumentException("子目录不能使用系统保留名: " + segment);
            }
        }
        return normalized;
    }

    public File resolveCloneDirectory(String subDirectory) {
        String safeSubDir = sanitizeSubdirectory(subDirectory);
        File base = new File(getBaseDirectory()).getAbsoluteFile();
        File dir = safeSubDir.isEmpty() ? base : new File(base, safeSubDir);

        if (!dir.exists() && !dir.mkdirs()) {
            throw new IllegalStateException("无法创建目录: " + dir.getAbsolutePath());
        }

        try {
            File canonicalBase = base.getCanonicalFile();
            File canonicalDir = dir.getCanonicalFile();
            if (!canonicalDir.toPath().startsWith(canonicalBase.toPath())) {
                throw new IllegalArgumentException("子目录路径不合法");
            }
            return canonicalDir;
        } catch (IOException e) {
            throw new IllegalStateException("无法解析目录路径: " + e.getMessage());
        }
    }

    public void saveSubdirectoryToHistory(String subDirectory) {
        synchronized (historyLock) {
            String safeSubDir = sanitizeSubdirectory(subDirectory);
            if (safeSubDir.isEmpty()) {
                configService.update(LAST_SUBDIRECTORY_KEY, "");
                return;
            }
            List<String> history = new ArrayList<>(getSubdirectoryHistory());
            history.remove(safeSubDir);
            history.add(0, safeSubDir);
            if (history.size() > MAX_SUBDIRECTORY_HISTORY) {
                history = new ArrayList<>(history.subList(0, MAX_SUBDIRECTORY_HISTORY));
            }
            try {
                configService.update(HISTORY_KEY, objectMapper.writeValueAsString(history));
                configService.update(LAST_SUBDIRECTORY_KEY, safeSubDir);
            } catch (Exception e) {
                log.warn("保存子目录历史失败: {}", e.getMessage());
            }
        }
    }

    // ======================== 磁盘空间检查 ========================

    /**
     * 检查目标磁盘剩余空间是否足够
     * @return Map 包含 freeSpaceMB, estimatedSizeMB, sufficient, message
     */
    public Map<String, Object> checkDiskSpace(String subDirectory, int repoCount) {
        Map<String, Object> result = new LinkedHashMap<>();
        try {
            File dir = resolveCloneDirectory(subDirectory);
            long freeBytes = dir.getFreeSpace();
            long freeMB = freeBytes / (1024 * 1024);
            long estimatedMB = (long) repoCount * ESTIMATED_AVG_REPO_SIZE_MB;
            long requiredMB = (long) (estimatedMB * DISK_SAFETY_FACTOR);

            result.put("freeSpaceMB", freeMB);
            result.put("estimatedSizeMB", estimatedMB);
            result.put("requiredSizeMB", requiredMB);
            result.put("sufficient", freeMB >= requiredMB);
            result.put("message", freeMB >= requiredMB
                    ? String.format("磁盘空间充足 (剩余 %d MB, 预估需要 %d MB)", freeMB, requiredMB)
                    : String.format("磁盘空间不足！剩余 %d MB, 预估需要 %d MB", freeMB, requiredMB));
        } catch (Exception e) {
            result.put("sufficient", true);
            result.put("message", "无法检测磁盘空间: " + e.getMessage());
        }
        return result;
    }

    // ======================== 任务生命周期 ========================

    /**
     * 启动批量 Clone 任务（同步方法，创建任务记录后异步执行）
     */
    public String startBatchClone(String keyword, String language, String categoryIds, int maxCount,
                                  String subDirectory, String dateField, String startDate, String endDate,
                                  String sortBy, String sortOrder, int concurrency,
                                  int cloneDepth, int maxRepoSizeMb) {
        final String safeSubDir = sanitizeSubdirectory(subDirectory);
        File dir = resolveCloneDirectory(safeSubDir);

        // 磁盘空间预检
        Map<String, Object> diskCheck = checkDiskSpace(safeSubDir, maxCount);
        boolean diskSufficient = Boolean.TRUE.equals(diskCheck.get("sufficient"));
        if (!diskSufficient) {
            log.warn("磁盘空间不足警告: {}", diskCheck.get("message"));
        }

        // 创建任务实体
        CloneTask task = new CloneTask();
        task.setTaskId("clone_" + taskCounter.incrementAndGet());
        task.setStatus("PENDING");
        task.setTotalRepos(maxCount);
        task.setKeyword(keyword);
        task.setLanguage(language);
        task.setCategoryIds(categoryIds);
        task.setDateField(dateField);
        task.setStartDate(startDate);
        task.setEndDate(endDate);
        task.setSortBy(sortBy);
        task.setSortOrder(sortOrder);
        task.setSubDirectory(safeSubDir);
        task.setTargetDir(dir.getAbsolutePath());
        task.setConcurrency(concurrency);
        task.setCloneDepth(cloneDepth);
        task.setMaxRepoSizeMb(maxRepoSizeMb);
        task.setCancelled(0);
        task.setCreatedAt(LocalDateTime.now());
        cloneTaskService.createTask(task);

        // 填入运行缓存以便前端实时轮询
        CloneTask cacheEntry = new CloneTask();
        cacheEntry.setTaskId(task.getTaskId());
        cacheEntry.setStatus("PENDING");
        cacheEntry.setTotalRepos(task.getTotalRepos());
        cacheEntry.setCompletedRepos(0);
        cacheEntry.setFailedRepos(0);
        cacheEntry.setSkippedRepos(0);
        cacheEntry.setCloneDepth(cloneDepth);
        cacheEntry.setMaxRepoSizeMb(maxRepoSizeMb);
        cacheEntry.setResults(new CopyOnWriteArrayList<>());
        runningTaskCache.put(task.getTaskId(), cacheEntry);

        // 通过 ApplicationContext 获取代理对象，确保 @Async 生效
        CloneService proxy = applicationContext.getBean(CloneService.class);
        proxy.executeBatchClone(task.getTaskId());

        return task.getTaskId();
    }

    /**
     * 获取任务进度：优先从实时缓存读取，降级查数据库
     */
    public CloneTask getTask(String taskId) {
        CloneTask cached = runningTaskCache.get(taskId);
        if (cached != null) {
            return cached;
        }
        return cloneTaskService.getTaskByTaskId(taskId);
    }

    /**
     * 取消正在运行的任务
     */
    public boolean cancelTask(String taskId) {
        CloneTask task = cloneTaskService.getTaskByTaskId(taskId);
        if (task == null) return false;
        if (!"RUNNING".equals(task.getStatus()) && !"PENDING".equals(task.getStatus())) {
            return false;
        }
        cancelledTasks.add(taskId);
        task.setCancelled(1);
        task.setStatus("FAILED");
        task.setErrorMessage("用户取消");
        task.setFinishedAt(LocalDateTime.now());
        cloneTaskService.updateTask(task);

        CloneTask cached = runningTaskCache.get(taskId);
        if (cached != null) {
            cached.setCancelled(1);
            cached.setStatus("FAILED");
            cached.setErrorMessage("用户取消");
        }
        log.info("任务 {} 已被用户取消", taskId);
        return true;
    }

    private boolean isTaskCancelled(String taskId) {
        return cancelledTasks.contains(taskId);
    }

    // ======================== 重试逻辑 ========================

    /**
     * 一键重试全部有失败项的任务（异步执行）
     */
    @Async("cloneExecutor")
    public void retryAllFailedClones() {
        List<String> taskIds = cloneTaskService.getTaskIdsWithFailedItems();
        if (taskIds.isEmpty()) {
            log.info("Retry all: no tasks with failed items found");
            return;
        }
        log.info("Retry all: found {} tasks with failed items, retrying sequentially", taskIds.size());
        for (String taskId : taskIds) {
            try {
                retryFailedClones(taskId);
            } catch (Exception e) {
                log.error("Retry all: error retrying task {}", taskId, e);
            }
        }
        log.info("Retry all: done");
    }

    /**
     * 重试失败项（异步执行）
     */
    @Async("cloneExecutor")
    public void retryFailedClones(String taskId) {
        CloneTask task = cloneTaskService.getTaskByTaskId(taskId);
        if (task == null) {
            log.error("Retry failed: task {} not found", taskId);
            return;
        }
        if ("PENDING".equals(task.getStatus())) {
            log.warn("Retry failed: task {} hasn't started yet", taskId);
            return;
        }

        List<CloneTaskItem> retryItems = new ArrayList<>();
        List<CloneTaskItem> failedItems = cloneTaskService.getFailedItemsByTaskId(taskId);
        List<CloneTaskItem> skippedItems = cloneTaskService.getSkippedItemsByTaskId(taskId);
        if (failedItems != null) retryItems.addAll(failedItems);
        if (skippedItems != null) retryItems.addAll(skippedItems);
        if (retryItems.isEmpty()) {
            log.info("Retry: task {} has no failed or skipped items", taskId);
            return;
        }

        File dir = new File(task.getTargetDir());
        if (!dir.exists() || !dir.isDirectory()) {
            log.error("Retry failed: target dir {} not found for task {}", task.getTargetDir(), taskId);
            return;
        }

        // 清除取消标记，允许重新执行
        cancelledTasks.remove(taskId);

        int concurrency = Math.min(task.getConcurrency() != null && task.getConcurrency() > 0
                ? task.getConcurrency() : 5, retryItems.size());
        int cloneDepth = task.getCloneDepth() != null ? task.getCloneDepth() : DEFAULT_CLONE_DEPTH;
        int maxRepoSizeMb = task.getMaxRepoSizeMb() != null ? task.getMaxRepoSizeMb() : DEFAULT_MAX_REPO_SIZE_MB;

        CloneTask cacheEntry = runningTaskCache.get(taskId);
        boolean wasCached = cacheEntry != null;
        if (!wasCached) {
            cacheEntry = new CloneTask();
            cacheEntry.setTaskId(taskId);
            cacheEntry.setResults(new CopyOnWriteArrayList<>());
        }
        cacheEntry.setStatus("RUNNING");
        cacheEntry.setTotalRepos(retryItems.size());
        cacheEntry.setCompletedRepos(0);
        cacheEntry.setFailedRepos(0);
        cacheEntry.setSkippedRepos(0);
        cacheEntry.setCancelled(0);
        runningTaskCache.put(taskId, cacheEntry);

        task.setStatus("RUNNING");
        task.setFinishedAt(null);
        task.setCancelled(0);
        cloneTaskService.updateTask(task);

        log.info("Starting retry for task {}: {} items, concurrency={}, depth={}", taskId, retryItems.size(), concurrency, cloneDepth);

        try {
            ExecutorService executor = Executors.newFixedThreadPool(concurrency);
            List<CompletableFuture<Void>> futures = new ArrayList<>();
            final CloneTask finalCache = cacheEntry;

            for (CloneTaskItem item : retryItems) {
                CompletableFuture<Void> future = CompletableFuture.runAsync(() -> {
                    if (isTaskCancelled(taskId)) return;

                    CloneResult result;
                    try {
                        String repoName = item.getFullName().contains("/")
                                ? item.getFullName().substring(item.getFullName().lastIndexOf('/') + 1)
                                : item.getFullName();
                        String htmlUrl = "https://github.com/" + item.getFullName();
                        result = doCloneWithRetry(item.getFullName(), repoName, dir, htmlUrl, true, cloneDepth, maxRepoSizeMb, taskId);
                    } catch (Exception e) {
                        result = new CloneResult();
                        result.setFullName(item.getFullName());
                        result.setStatus("FAILED");
                        result.setMessage(e.getMessage());
                    }

                    item.setStatus(result.getStatus());
                    item.setMessage(result.getMessage());
                    cloneTaskService.updateItem(item);

                    synchronized (finalCache) {
                        switch (result.getStatus()) {
                            case "CLONED": finalCache.setCompletedRepos(finalCache.getCompletedRepos() + 1); break;
                            case "FAILED": finalCache.setFailedRepos(finalCache.getFailedRepos() + 1); break;
                            case "SKIPPED": finalCache.setSkippedRepos(finalCache.getSkippedRepos() + 1); break;
                        }
                        finalCache.getResults().add(result);
                    }

                    log.info("Retry {}: {} -> {}", item.getFullName(), result.getStatus(), result.getMessage());
                }, executor);
                futures.add(future);
            }

            CompletableFuture.allOf(futures.toArray(new CompletableFuture[0])).join();
            executor.shutdown();

            int completed = cloneTaskService.countItemsByTaskIdAndStatus(taskId, "CLONED");
            int failed = cloneTaskService.countItemsByTaskIdAndStatus(taskId, "FAILED");
            int skipped = cloneTaskService.countItemsByTaskIdAndStatus(taskId, "SKIPPED");
            task.setCompletedRepos(completed);
            task.setFailedRepos(failed);
            task.setSkippedRepos(skipped);

            if (isTaskCancelled(taskId)) {
                task.setStatus("FAILED");
                task.setErrorMessage("用户取消");
            } else if (failed > 0 && completed == 0) {
                task.setStatus("FAILED");
            } else {
                task.setStatus("COMPLETED");
            }
            task.setFinishedAt(LocalDateTime.now());
            cloneTaskService.updateTask(task);

            cacheEntry.setStatus(task.getStatus());
            cacheEntry.setCompletedRepos(completed);
            cacheEntry.setFailedRepos(failed);
            cacheEntry.setSkippedRepos(skipped);

            log.info("Retry task {} done: success={}, failed={}, skipped={}",
                    taskId, completed, failed, skipped);
        } catch (Exception e) {
            log.error("Retry task {} failed with exception", taskId, e);
            cacheEntry.setStatus("FAILED");
            cacheEntry.setErrorMessage(e.getMessage());
            task.setStatus("FAILED");
            task.setErrorMessage(e.getMessage());
            task.setFinishedAt(LocalDateTime.now());
            cloneTaskService.updateTask(task);
        } finally {
            scheduleCacheCleanup(taskId, wasCached);
        }
    }

    // ======================== 批量 Clone 执行 ========================

    /**
     * 异步执行批量 Clone（由 cloneExecutor 线程池调度）
     */
    @Async("cloneExecutor")
    public void executeBatchClone(String taskId) {
        CloneTask task = cloneTaskService.getTaskByTaskId(taskId);
        if (task == null) {
            log.error("Clone task {} not found in DB", taskId);
            runningTaskCache.remove(taskId);
            return;
        }

        CloneTask cachedInitial = runningTaskCache.get(taskId);
        if (cachedInitial == null) {
            cachedInitial = new CloneTask();
            cachedInitial.setTaskId(taskId);
            cachedInitial.setResults(new CopyOnWriteArrayList<>());
            runningTaskCache.put(taskId, cachedInitial);
        }
        final CloneTask cached = cachedInitial;

        task.setStatus("RUNNING");
        task.setStartedAt(LocalDateTime.now());
        cloneTaskService.updateTask(task);
        cached.setStatus("RUNNING");

        int cloneDepth = task.getCloneDepth() != null ? task.getCloneDepth() : DEFAULT_CLONE_DEPTH;
        int maxRepoSizeMb = task.getMaxRepoSizeMb() != null ? task.getMaxRepoSizeMb() : DEFAULT_MAX_REPO_SIZE_MB;

        try {
            File dir = new File(task.getTargetDir());
            int maxCount = task.getTotalRepos() != null && task.getTotalRepos() > 0
                    ? task.getTotalRepos() : Integer.MAX_VALUE;

            // 分页获取所有匹配仓库
            List<GithubRepo> allRepos = new ArrayList<>();
            int pageNum = 1;
            int batchSize = 500;
            while (allRepos.size() < maxCount && !isTaskCancelled(taskId)) {
                IPage<GithubRepo> repoPage = githubRepoService.findPage(
                        pageNum, batchSize,
                        task.getKeyword(), task.getLanguage(),
                        task.getSortBy(), task.getSortOrder(),
                        task.getDateField(), task.getStartDate(), task.getEndDate(),
                        task.getCategoryIds());
                if (repoPage.getRecords().isEmpty()) {
                    break;
                }
                for (GithubRepo repo : repoPage.getRecords()) {
                    if (allRepos.size() >= maxCount) break;
                    allRepos.add(repo);
                }
                pageNum++;
            }

            if (isTaskCancelled(taskId)) {
                task.setStatus("FAILED");
                task.setErrorMessage("用户取消");
                task.setFinishedAt(LocalDateTime.now());
                cloneTaskService.updateTask(task);
                cached.setStatus("FAILED");
                cached.setErrorMessage("用户取消");
                return;
            }

            task.setTotalRepos(allRepos.size());
            cloneTaskService.updateTask(task);
            cached.setTotalRepos(allRepos.size());

            int concurrency = task.getConcurrency() != null && task.getConcurrency() > 0
                    ? task.getConcurrency() : 5;
            ExecutorService executor = Executors.newFixedThreadPool(concurrency);
            List<CompletableFuture<Void>> futures = new ArrayList<>();
            final Object writeLock = new Object();

            for (GithubRepo repo : allRepos) {
                if (isTaskCancelled(taskId)) break;

                CompletableFuture<Void> future = CompletableFuture.runAsync(() -> {
                    if (isTaskCancelled(taskId)) return;

                    CloneResult result;
                    try {
                        result = doCloneWithRetry(repo.getFullName(), repo.getRepoName(), dir, repo.getHtmlUrl(),
                                false, cloneDepth, maxRepoSizeMb, taskId);
                    } catch (Exception e) {
                        result = new CloneResult();
                        result.setFullName(repo.getFullName());
                        result.setStatus("FAILED");
                        result.setMessage(e.getMessage());
                    }

                    CloneTaskItem item = new CloneTaskItem();
                    item.setTaskId(taskId);
                    item.setFullName(repo.getFullName());
                    item.setStatus(result.getStatus());
                    item.setMessage(result.getMessage());
                    item.setCreatedAt(LocalDateTime.now());
                    cloneTaskItemMapper.insert(item);

                    synchronized (writeLock) {
                        switch (result.getStatus()) {
                            case "CLONED": cached.setCompletedRepos(cached.getCompletedRepos() + 1); break;
                            case "FAILED": cached.setFailedRepos(cached.getFailedRepos() + 1); break;
                            case "SKIPPED": cached.setSkippedRepos(cached.getSkippedRepos() + 1); break;
                        }
                        cached.getResults().add(result);

                        task.setCompletedRepos(cached.getCompletedRepos());
                        task.setFailedRepos(cached.getFailedRepos());
                        task.setSkippedRepos(cached.getSkippedRepos());
                        cloneTaskService.updateTask(task);
                    }

                    log.info("Clone {}: {} -> {}", repo.getFullName(), result.getStatus(), result.getMessage());
                }, executor);
                futures.add(future);
            }

            CompletableFuture.allOf(futures.toArray(new CompletableFuture[0])).join();
            executor.shutdown();

            // 清理取消标记
            cancelledTasks.remove(taskId);

            if (isTaskCancelled(taskId)) {
                task.setStatus("FAILED");
                task.setErrorMessage("用户取消");
            } else {
                task.setStatus("COMPLETED");
            }
            task.setCompletedRepos(cached.getCompletedRepos());
            task.setFailedRepos(cached.getFailedRepos());
            task.setSkippedRepos(cached.getSkippedRepos());
            task.setFinishedAt(LocalDateTime.now());
            cloneTaskService.updateTask(task);

            cached.setStatus(task.getStatus());
            cached.setCompletedRepos(task.getCompletedRepos());
            cached.setFailedRepos(task.getFailedRepos());
            cached.setSkippedRepos(task.getSkippedRepos());

            saveSubdirectoryToHistory(task.getSubDirectory());

            log.info("Clone task {} done: {}/{} success, {} skipped, {} failed",
                    taskId, task.getCompletedRepos(), task.getTotalRepos(),
                    task.getSkippedRepos(), task.getFailedRepos());

        } catch (Exception e) {
            log.error("Clone task {} failed", taskId, e);
            task.setStatus("FAILED");
            task.setErrorMessage("Clone 任务执行失败: " + e.getMessage());
            task.setFinishedAt(LocalDateTime.now());
            cloneTaskService.updateTask(task);
            cached.setStatus("FAILED");
            cached.setErrorMessage(task.getErrorMessage());
            cancelledTasks.remove(taskId);
        } finally {
            scheduleCacheCleanup(taskId, false);
        }
    }

    private void scheduleCacheCleanup(String taskId, boolean wasCached) {
        if (wasCached) return;
        scheduledExecutor.schedule(() -> {
            runningTaskCache.remove(taskId);
            cancelledTasks.remove(taskId);
        }, 5, TimeUnit.SECONDS);
    }

    // ======================== 核心克隆方法 ========================

    /**
     * 带自动重试的克隆方法
     */
    private CloneResult doCloneWithRetry(String fullName, String repoName, File dir, String htmlUrl,
                                         boolean forceRetry, int cloneDepth, int maxRepoSizeMb, String taskId) {
        CloneResult lastResult = null;
        for (int attempt = 0; attempt < MAX_RETRY_ATTEMPTS; attempt++) {
            if (isTaskCancelled(taskId)) {
                CloneResult cancelled = new CloneResult();
                cancelled.setFullName(fullName);
                cancelled.setStatus("FAILED");
                cancelled.setMessage("任务已取消");
                return cancelled;
            }

            CloneResult result = doClone(fullName, repoName, dir, htmlUrl, forceRetry, cloneDepth, maxRepoSizeMb);

            // 成功或跳过，直接返回
            if ("CLONED".equals(result.getStatus()) || "SKIPPED".equals(result.getStatus())) {
                return result;
            }

            // 检查是否为不可重试错误
            if (isNonRetryableError(result.getMessage())) {
                if (attempt > 0) {
                    result.setMessage("[重试" + attempt + "次后放弃] " + result.getMessage());
                }
                return result;
            }

            lastResult = result;

            // 还有重试机会
            if (attempt < MAX_RETRY_ATTEMPTS - 1) {
                int delaySeconds = RETRY_BACKOFF_SECONDS[attempt];
                log.info("Clone {} 失败，{}秒后第{}次重试: {}", fullName, delaySeconds, attempt + 2, result.getMessage());
                try {
                    Thread.sleep(delaySeconds * 1000L);
                } catch (InterruptedException ignored) {
                    Thread.currentThread().interrupt();
                    return result;
                }
                // 清理上次残留的目录
                File repoDir = new File(dir, repoName);
                deleteDirectory(repoDir);
            }
        }

        if (lastResult != null) {
            lastResult.setMessage("[已重试" + MAX_RETRY_ATTEMPTS + "次] " + lastResult.getMessage());
        }
        return lastResult;
    }

    /**
     * 判断是否为不可重试的错误
     */
    private boolean isNonRetryableError(String message) {
        if (message == null) return false;
        String lowerMsg = message.toLowerCase();
        for (String pattern : NON_RETRYABLE_ERRORS) {
            if (lowerMsg.contains(pattern.toLowerCase())) {
                return true;
            }
        }
        return false;
    }

    /**
     * 删除目录（递归），忽略异常
     */
    private void deleteDirectory(File dir) {
        if (dir == null || !dir.exists()) return;
        try {
            Files.walk(dir.toPath())
                    .sorted(Comparator.reverseOrder())
                    .map(Path::toFile)
                    .forEach(File::delete);
        } catch (IOException e) {
            log.warn("清理残留目录失败: {} - {}", dir.getAbsolutePath(), e.getMessage());
        }
    }

    public String buildCloneUrl(String htmlUrl) {
        String proxyUrl = configService.getValue("clone.proxy.url", "");
        if (proxyUrl != null && !proxyUrl.trim().isEmpty()) {
            String trimmed = proxyUrl.trim();
            if (!trimmed.endsWith("/")) {
                trimmed += "/";
            }
            return trimmed + htmlUrl;
        }
        return htmlUrl + ".git";
    }

    /**
     * 执行单个仓库的 git clone（单次，不含重试）
     *
     * @param cloneDepth    克隆深度，0=完整克隆，>0=浅克隆
     * @param maxRepoSizeMb 最大仓库大小(MB)，超过则跳过，0=不限制
     */
    private CloneResult doClone(String fullName, String repoName, File dir, String htmlUrl,
                                boolean forceRetry, int cloneDepth, int maxRepoSizeMb) {
        CloneResult result = new CloneResult();
        result.setFullName(fullName);

        if (repoName == null || repoName.trim().isEmpty()) {
            result.setStatus("FAILED");
            result.setMessage("仓库名称为空");
            return result;
        }

        File repoDir = new File(dir, repoName);
        if (repoDir.exists()) {
            if (forceRetry) {
                deleteDirectory(repoDir);
                if (repoDir.exists()) {
                    result.setStatus("FAILED");
                    result.setMessage("目录已存在但无法删除: " + repoDir.getAbsolutePath());
                    return result;
                }
            } else {
                result.setStatus("SKIPPED");
                result.setMessage("目录已存在");
                return result;
            }
        }

        try {
            String cloneUrl = buildCloneUrl(htmlUrl);

            // 构建 git clone 命令，支持 --depth 浅克隆
            List<String> command = new ArrayList<>();
            command.add("git");
            command.add("clone");
            if (cloneDepth > 0) {
                command.add("--depth");
                command.add(String.valueOf(cloneDepth));
            }
            command.add(cloneUrl);
            command.add(repoDir.getAbsolutePath());

            ProcessBuilder pb = new ProcessBuilder(command);
            pb.directory(dir);
            pb.redirectErrorStream(true);
            Process p = pb.start();

            String output = new String(p.getInputStream().readAllBytes(), java.nio.charset.StandardCharsets.UTF_8);
            if (!p.waitFor(DEFAULT_CLONE_TIMEOUT_SECONDS, TimeUnit.SECONDS)) {
                p.destroyForcibly();
                result.setStatus("FAILED");
                result.setMessage("git clone 超时(" + DEFAULT_CLONE_TIMEOUT_SECONDS + "s): "
                        + (output.length() > 500 ? output.substring(0, 500) + "..." : output).trim());
                deleteDirectory(repoDir);
                return result;
            }
            int exitCode = p.exitValue();
            if (exitCode == 0) {
                result.setStatus("CLONED");
                result.setMessage("成功" + (cloneDepth > 0 ? " (浅克隆 depth=" + cloneDepth + ")" : ""));
            } else {
                result.setStatus("FAILED");
                String trimmedOutput = output.length() > 500 ? output.substring(0, 500) + "..." : output;
                result.setMessage("git clone exit code: " + exitCode + " - " + trimmedOutput.trim());
                deleteDirectory(repoDir);
            }
        } catch (Exception e) {
            result.setStatus("FAILED");
            result.setMessage(e.getClass().getSimpleName() + ": " + e.getMessage());
            deleteDirectory(repoDir);
        }
        return result;
    }
}
