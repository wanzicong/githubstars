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

import javax.annotation.Resource;
import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.regex.Pattern;

/**
 * 批量 Clone 服务 - 后台异步执行 git clone，持久化任务进度到数据库
 */
@Service
public class CloneService {

    private static final Logger log = LoggerFactory.getLogger(CloneService.class);
    private static final int MAX_SUBDIRECTORY_HISTORY = 20;
    private static final String HISTORY_KEY = "clone.subdirectory.history";
    private static final String LAST_SUBDIRECTORY_KEY = "clone.subdirectory.last";
    private static final Pattern INVALID_SEGMENT = Pattern.compile("[<>:\"|?*\\x00-\\x1f]");
    private static final Set<String> WINDOWS_RESERVED = new HashSet<>(Arrays.asList(
            "CON", "PRN", "AUX", "NUL",
            "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8", "COM9",
            "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9"
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

    /**
     * 检查是否存在活跃的 Clone 任务（查数据库）
     */
    public boolean hasActiveTask() {
        return cloneTaskService.hasActiveTask();
    }

    /**
     * 校验并规范化子目录（相对路径）
     */
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

    /**
     * 解析最终 Clone 目录，并确保落在基础目录内
     */
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

    // ======================== 任务生命周期 ========================

    /**
     * 启动批量 Clone 任务（同步方法，创建任务记录后异步执行）
     */
    public String startBatchClone(String keyword, String language, String categoryIds, int maxCount,
                                  String subDirectory, String dateField, String startDate, String endDate,
                                  String sortBy, String sortOrder, int concurrency) {
        synchronized (this) {
            if (cloneTaskService.hasActiveTask()) {
                throw new IllegalStateException("已有 Clone 任务正在执行，请等待完成后再试");
            }
        }

        final String safeSubDir = sanitizeSubdirectory(subDirectory);
        File dir = resolveCloneDirectory(safeSubDir);

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
        cacheEntry.setResults(Collections.synchronizedList(new ArrayList<>()));
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
     * 重试失败项（异步执行）
     */
    @Async("cloneExecutor")
    public void retryFailedClones(String taskId) {
        CloneTask task = cloneTaskService.getTaskByTaskId(taskId);
        if (task == null) {
            log.error("Retry failed: task {} not found", taskId);
            return;
        }
        if (!"COMPLETED".equals(task.getStatus()) && !"FAILED".equals(task.getStatus())) {
            log.warn("Retry failed: task {} is still running, cannot retry", taskId);
            return;
        }

        List<CloneTaskItem> failedItems;
        try {
            failedItems = cloneTaskService.getFailedItemsByTaskId(taskId);
        } catch (Exception e) {
            log.error("Retry failed: query failed items error for {}", taskId, e);
            return;
        }
        if (failedItems.isEmpty()) {
            log.info("Retry failed: task {} has no failed items", taskId);
            return;
        }

        File dir = new File(task.getTargetDir());
        if (!dir.exists() || !dir.isDirectory()) {
            log.error("Retry failed: target dir {} not found for task {}", task.getTargetDir(), taskId);
            return;
        }

        // 用 CompletableFuture 并发重试
        int concurrency = Math.min(task.getConcurrency() != null && task.getConcurrency() > 0
                ? task.getConcurrency() : 5, failedItems.size());
        log.info("Starting retry for task {}: {} items, concurrency={}", taskId, failedItems.size(), concurrency);

        try {
            ExecutorService executor = Executors.newFixedThreadPool(concurrency);
            List<CompletableFuture<Void>> futures = new ArrayList<>();

            for (CloneTaskItem item : failedItems) {
                CompletableFuture<Void> future = CompletableFuture.runAsync(() -> {
                    CloneResult result;
                    try {
                        String repoName = item.getFullName().contains("/")
                                ? item.getFullName().substring(item.getFullName().lastIndexOf('/') + 1)
                                : item.getFullName();
                        String htmlUrl = "https://github.com/" + item.getFullName();
                        result = doClone(item.getFullName(), repoName, dir, htmlUrl, true);
                    } catch (Exception e) {
                        result = new CloneResult();
                        result.setFullName(item.getFullName());
                        result.setStatus("FAILED");
                        result.setMessage(e.getMessage());
                    }

                    // 更新 DB
                    item.setStatus(result.getStatus());
                    item.setMessage(result.getMessage());
                    cloneTaskService.updateItem(item);

                    log.info("Retry {}: {} -> {}", item.getFullName(), result.getStatus(), result.getMessage());
                }, executor);
                futures.add(future);
            }

            CompletableFuture.allOf(futures.toArray(new CompletableFuture[0])).join();
            executor.shutdown();

            // 更新任务计数
            int completed = cloneTaskService.countItemsByTaskIdAndStatus(taskId, "CLONED");
            int failed = cloneTaskService.countItemsByTaskIdAndStatus(taskId, "FAILED");
            int skipped = cloneTaskService.countItemsByTaskIdAndStatus(taskId, "SKIPPED");
            task.setCompletedRepos(completed);
            task.setFailedRepos(failed);
            task.setSkippedRepos(skipped);
            task.setStatus(completed > 0 && failed == 0 ? "COMPLETED" : task.getStatus());
            task.setFinishedAt(LocalDateTime.now());
            cloneTaskService.updateTask(task);

            log.info("Retry task {} done: success={}, failed={}, skipped={}",
                    taskId, completed, failed, skipped);
        } catch (Exception e) {
            log.error("Retry task {} failed with exception", taskId, e);
        }
    }

    /**
     * 异步执行批量 Clone（由 cloneExecutor 线程池调度）
     */
    @Async("cloneExecutor")
    public void executeBatchClone(String taskId) {
        // 从 DB 获取任务
        CloneTask task = cloneTaskService.getTaskByTaskId(taskId);
        if (task == null) {
            log.error("Clone task {} not found in DB", taskId);
            runningTaskCache.remove(taskId);
            return;
        }

        // 获取或初始化缓存（cachedInitial 可能在 if 中被重新赋值，用 final 引用传给 lambda）
        CloneTask cachedInitial = runningTaskCache.get(taskId);
        if (cachedInitial == null) {
            cachedInitial = new CloneTask();
            cachedInitial.setTaskId(taskId);
            cachedInitial.setResults(Collections.synchronizedList(new ArrayList<>()));
            runningTaskCache.put(taskId, cachedInitial);
        }
        final CloneTask cached = cachedInitial;

        // 标记运行中
        task.setStatus("RUNNING");
        task.setStartedAt(LocalDateTime.now());
        cloneTaskService.updateTask(task);
        cached.setStatus("RUNNING");

        try {
            File dir = new File(task.getTargetDir());
            int maxCount = task.getTotalRepos() != null && task.getTotalRepos() > 0
                    ? task.getTotalRepos() : Integer.MAX_VALUE;

            // 分页获取所有匹配仓库
            List<GithubRepo> allRepos = new ArrayList<>();
            int pageNum = 1;
            int batchSize = 500;
            while (allRepos.size() < maxCount) {
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
                    if (allRepos.size() >= maxCount) {
                        break;
                    }
                    allRepos.add(repo);
                }
                pageNum++;
            }

            // 更新总仓库数
            task.setTotalRepos(allRepos.size());
            cloneTaskService.updateTask(task);
            cached.setTotalRepos(allRepos.size());

            // 使用线程池并发执行 git clone
            int concurrency = task.getConcurrency() != null && task.getConcurrency() > 0
                    ? task.getConcurrency() : 5;
            ExecutorService executor = Executors.newFixedThreadPool(concurrency);
            List<CompletableFuture<Void>> futures = new ArrayList<>();
            final Object writeLock = new Object();

            for (GithubRepo repo : allRepos) {
                CompletableFuture<Void> future = CompletableFuture.runAsync(() -> {
                    CloneResult result;
                    try {
                        result = doClone(repo.getFullName(), repo.getRepoName(), dir, repo.getHtmlUrl(), false);
                    } catch (Exception e) {
                        result = new CloneResult();
                        result.setFullName(repo.getFullName());
                        result.setStatus("FAILED");
                        result.setMessage(e.getMessage());
                    }

                    // 持久化到 clone_task_item
                    CloneTaskItem item = new CloneTaskItem();
                    item.setTaskId(taskId);
                    item.setFullName(repo.getFullName());
                    item.setStatus(result.getStatus());
                    item.setMessage(result.getMessage());
                    item.setCreatedAt(LocalDateTime.now());
                    cloneTaskItemMapper.insert(item);

                    // 更新实时缓存
                    synchronized (writeLock) {
                        switch (result.getStatus()) {
                            case "CLONED":
                                cached.setCompletedRepos(cached.getCompletedRepos() + 1);
                                break;
                            case "FAILED":
                                cached.setFailedRepos(cached.getFailedRepos() + 1);
                                break;
                            case "SKIPPED":
                                cached.setSkippedRepos(cached.getSkippedRepos() + 1);
                                break;
                        }
                        cached.getResults().add(result);

                        // 每次同步 DB 计数（保证列表页与详情页数据一致）
                        task.setCompletedRepos(cached.getCompletedRepos());
                        task.setFailedRepos(cached.getFailedRepos());
                        task.setSkippedRepos(cached.getSkippedRepos());
                        cloneTaskService.updateTask(task);
                    }

                    log.info("Clone {}: {} -> {}", repo.getFullName(), result.getStatus(), result.getMessage());
                }, executor);
                futures.add(future);
            }

            // 等待全部完成
            CompletableFuture.allOf(futures.toArray(new CompletableFuture[0])).join();
            executor.shutdown();

            // 最终同步 DB
            task.setCompletedRepos(cached.getCompletedRepos());
            task.setFailedRepos(cached.getFailedRepos());
            task.setSkippedRepos(cached.getSkippedRepos());
            task.setStatus("COMPLETED");
            task.setFinishedAt(LocalDateTime.now());
            cloneTaskService.updateTask(task);

            cached.setStatus("COMPLETED");
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
        } finally {
            // 任务结束后，5 秒后从缓存移除，让前端有足够时间拉取最终状态
            new Timer().schedule(new TimerTask() {
                @Override
                public void run() {
                    runningTaskCache.remove(taskId);
                }
            }, 5000);
        }
    }

    /**
     * 执行单个仓库的 git clone
     *
     * @param forceRetry 强制重试模式：目录存在但为空时删除后重新克隆
     */
    private CloneResult doClone(String fullName, String repoName, File dir, String htmlUrl, boolean forceRetry) {
        CloneResult result = new CloneResult();
        result.setFullName(fullName);

        if (repoName == null || repoName.trim().isEmpty()) {
            result.setStatus("FAILED");
            result.setMessage("仓库名称为空");
            return result;
        }

        File repoDir = new File(dir, repoName);
        if (repoDir.exists()) {
            // 重试模式下：先删除整个目录再重新克隆
            if (forceRetry) {
                try {
                    Files.walk(repoDir.toPath())
                        .sorted(Comparator.reverseOrder())
                        .map(Path::toFile)
                        .forEach(File::delete);
                    log.info("Retry: removed dir {} before reclone", repoDir.getAbsolutePath());
                    if (repoDir.exists()) {
                        result.setStatus("FAILED");
                        result.setMessage("目录已存在但无法删除: " + repoDir.getAbsolutePath());
                        return result;
                    }
                    // 删除成功，继续往下执行 git clone
                } catch (IOException e) {
                    result.setStatus("FAILED");
                    result.setMessage("删除目录失败: " + e.getMessage());
                    return result;
                }
            } else {
                result.setStatus("SKIPPED");
                result.setMessage("目录已存在");
                return result;
            }
        }

        try {
            ProcessBuilder pb = new ProcessBuilder("git", "clone", htmlUrl + ".git", repoDir.getAbsolutePath());
            pb.directory(dir);
            pb.redirectErrorStream(true);
            Process p = pb.start();
            // 读取错误输出以便调试
            String errorOut = new String(p.getErrorStream().readAllBytes(), java.nio.charset.StandardCharsets.UTF_8);
            if (!p.waitFor(120, TimeUnit.SECONDS)) {
                p.destroyForcibly();
                result.setStatus("FAILED");
                result.setMessage("git clone 超时(120s): " + errorOut.trim());
                return result;
            }
            int exitCode = p.exitValue();
            if (exitCode == 0) {
                result.setStatus("CLONED");
                result.setMessage("成功");
            } else {
                result.setStatus("FAILED");
                result.setMessage("git clone exit code: " + exitCode + " - " + errorOut.trim());
            }
        } catch (Exception e) {
            result.setStatus("FAILED");
            result.setMessage(e.getMessage());
        }
        return result;
    }
}
