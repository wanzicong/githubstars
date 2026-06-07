package com.github.stars.service;

import com.github.stars.entity.GithubRepo;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import javax.annotation.Resource;
import java.io.BufferedReader;
import java.io.File;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * 批量 Clone 服务 - 后台异步执行 git clone
 */
@Service
public class CloneService {

    private static final Logger log = LoggerFactory.getLogger(CloneService.class);
    private static final int MAX_CONCURRENT = 5;

    @Resource
    private GithubRepoService githubRepoService;

    @Resource
    private SystemConfigService configService;

    private final Map<String, CloneTask> tasks = new ConcurrentHashMap<>();
    private final AtomicInteger taskCounter = new AtomicInteger(0);

    public static class CloneTask {
        public String taskId;
        public String status; // PENDING, RUNNING, COMPLETED, FAILED
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

    /**
     * 启动异步批量 Clone
     */
    public String startBatchClone(String keyword, String language, String categoryIds, int maxCount) {
        String taskId = "clone_" + taskCounter.incrementAndGet();

        CloneTask task = new CloneTask();
        task.taskId = taskId;
        task.status = "PENDING";
        tasks.put(taskId, task);

        // 异步执行
        final String tid = taskId;
        new Thread(() -> executeClone(tid, keyword, language, categoryIds, maxCount)).start();

        return taskId;
    }

    public CloneTask getTask(String taskId) {
        return tasks.get(taskId);
    }

    private void executeClone(String taskId, String keyword, String language, String categoryIds, int maxCount) {
        CloneTask task = tasks.get(taskId);
        if (task == null) return;

        task.status = "RUNNING";
        List<GithubRepo> repos = githubRepoService.findPage(1, maxCount, keyword, language,
                "starred_at", "desc", null, null, null, categoryIds).getRecords();
        task.totalRepos = repos.size();

        String cloneDir = configService.getValue("clone.directory", "D:/github-stars");
        File dir = new File(cloneDir);
        if (!dir.exists()) dir.mkdirs();

        // 信号量控制并发
        final Object lock = new Object();
        List<Thread> threads = new ArrayList<>();

        for (GithubRepo repo : repos) {
            Thread t = new Thread(() -> {
                CloneResult r = new CloneResult();
                r.fullName = repo.getFullName();

                File repoDir = new File(dir, repo.getRepoName());
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

        // 并发执行（最多 5 个同时）
        int running = 0;
        Iterator<Thread> it = threads.iterator();
        List<Thread> active = new ArrayList<>();
        while (it.hasNext() || !active.isEmpty()) {
            // 启动新线程直到达到并发上限
            while (running < MAX_CONCURRENT && it.hasNext()) {
                Thread t = it.next();
                active.add(t);
                t.start();
                running++;
            }
            // 等待任意线程完成
            for (int i = active.size() - 1; i >= 0; i--) {
                Thread t = active.get(i);
                try { t.join(1000); } catch (InterruptedException e) { Thread.currentThread().interrupt(); return; }
                if (!t.isAlive()) { active.remove(i); running--; }
            }
        }

        task.status = "COMPLETED";
        log.info("Clone task {} done: {}/{} success, {} skipped, {} failed",
                taskId, task.completedRepos, task.totalRepos, task.skippedRepos, task.failedRepos);
    }
}
