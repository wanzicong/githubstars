package com.github.stars.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.github.stars.entity.GithubRepo;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import javax.annotation.Resource;
import java.io.File;
import java.io.IOException;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.regex.Pattern;

/**
 * 批量 Clone 服务 - 后台异步执行 git clone
 */
@Service
public class CloneService {

    private static final Logger log = LoggerFactory.getLogger(CloneService.class);
    private static final int MAX_CONCURRENT = 5;
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

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final Object historyLock = new Object();

    private final Map<String, CloneTask> tasks = new ConcurrentHashMap<>();
    private final AtomicInteger taskCounter = new AtomicInteger(0);
    private volatile String activeTaskId;

    public static class CloneTask {
        public String taskId;
        public String status; // PENDING, RUNNING, COMPLETED, FAILED
        public String errorMessage;
        public int totalRepos;
        public int completedRepos;
        public int failedRepos;
        public int skippedRepos;
        public List<CloneResult> results;
        public CloneTask() { results = Collections.synchronizedList(new ArrayList<>()); }
    }

    public static class CloneResult {
        public String fullName;
        public String status; // CLONED, FAILED, SKIPPED
        public String message;
    }

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
        if (activeTaskId == null) {
            return false;
        }
        CloneTask task = tasks.get(activeTaskId);
        return task != null && ("PENDING".equals(task.status) || "RUNNING".equals(task.status));
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

    public String startBatchClone(String keyword, String language, String categoryIds, int maxCount, String subDirectory) {
        synchronized (this) {
            if (hasActiveTask()) {
                throw new IllegalStateException("已有 Clone 任务正在执行，请等待完成后再试");
            }
        }

        final String safeSubDir = sanitizeSubdirectory(subDirectory);
        resolveCloneDirectory(safeSubDir);

        String taskId = "clone_" + taskCounter.incrementAndGet();
        CloneTask task = new CloneTask();
        task.taskId = taskId;
        task.status = "PENDING";
        tasks.put(taskId, task);
        activeTaskId = taskId;

        final String tid = taskId;
        new Thread(() -> executeClone(tid, keyword, language, categoryIds, maxCount, safeSubDir)).start();
        return taskId;
    }

    public CloneTask getTask(String taskId) {
        return tasks.get(taskId);
    }

    private void executeClone(String taskId, String keyword, String language, String categoryIds, int maxCount, String subDirectory) {
        CloneTask task = tasks.get(taskId);
        if (task == null) {
            return;
        }

        task.status = "RUNNING";
        try {
            File dir = resolveCloneDirectory(subDirectory);
            List<GithubRepo> repos = githubRepoService.findPage(1, maxCount, keyword, language,
                    "starred_at", "desc", null, null, null, categoryIds).getRecords();
            task.totalRepos = repos.size();

            final Object lock = new Object();
            List<Thread> threads = new ArrayList<>();

            for (GithubRepo repo : repos) {
                Thread t = new Thread(() -> {
                    CloneResult r = new CloneResult();
                    r.fullName = repo.getFullName();

                    String repoName = repo.getRepoName();
                    if (repoName == null || repoName.trim().isEmpty()) {
                        r.status = "FAILED";
                        r.message = "仓库名称为空";
                        synchronized (lock) { task.failedRepos++; }
                        task.results.add(r);
                        return;
                    }

                    File repoDir = new File(dir, repoName);
                    if (repoDir.exists()) {
                        r.status = "SKIPPED";
                        r.message = "目录已存在";
                        synchronized (lock) { task.skippedRepos++; }
                    } else {
                        try {
                            ProcessBuilder pb = new ProcessBuilder("git", "clone", repo.getHtmlUrl() + ".git", repoDir.getAbsolutePath());
                            pb.directory(dir);
                            pb.redirectErrorStream(true);
                            Process p = pb.start();
                            int exitCode = p.waitFor();
                            if (exitCode == 0) {
                                r.status = "CLONED";
                                r.message = "成功";
                                synchronized (lock) { task.completedRepos++; }
                            } else {
                                r.status = "FAILED";
                                r.message = "git clone exit code: " + exitCode;
                                synchronized (lock) { task.failedRepos++; }
                            }
                        } catch (Exception e) {
                            r.status = "FAILED";
                            r.message = e.getMessage();
                            synchronized (lock) { task.failedRepos++; }
                        }
                    }
                    task.results.add(r);
                    log.info("Clone {}: {} -> {}", r.fullName, r.status, r.message);
                });
                threads.add(t);
            }

            int running = 0;
            Iterator<Thread> it = threads.iterator();
            List<Thread> active = new ArrayList<>();
            while (it.hasNext() || !active.isEmpty()) {
                while (running < MAX_CONCURRENT && it.hasNext()) {
                    Thread t = it.next();
                    active.add(t);
                    t.start();
                    running++;
                }
                for (int i = active.size() - 1; i >= 0; i--) {
                    Thread t = active.get(i);
                    try {
                        t.join(1000);
                    } catch (InterruptedException e) {
                        Thread.currentThread().interrupt();
                        task.status = "FAILED";
                        task.errorMessage = "任务被中断";
                        return;
                    }
                    if (!t.isAlive()) {
                        active.remove(i);
                        running--;
                    }
                }
            }

            task.status = "COMPLETED";
            saveSubdirectoryToHistory(subDirectory);
            log.info("Clone task {} done: {}/{} success, {} skipped, {} failed",
                    taskId, task.completedRepos, task.totalRepos, task.skippedRepos, task.failedRepos);
        } catch (IllegalArgumentException | IllegalStateException e) {
            task.status = "FAILED";
            task.errorMessage = e.getMessage();
            log.error("Clone task {} failed: {}", taskId, e.getMessage());
        } catch (Exception e) {
            task.status = "FAILED";
            task.errorMessage = "Clone 任务执行失败: " + e.getMessage();
            log.error("Clone task {} failed", taskId, e);
        } finally {
            if (taskId.equals(activeTaskId)) {
                activeTaskId = null;
            }
        }
    }
}
