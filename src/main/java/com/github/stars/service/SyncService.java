package com.github.stars.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.github.stars.entity.GithubRepo;
import com.github.stars.entity.SyncLog;
import com.github.stars.mapper.GithubRepoMapper;
import com.github.stars.mapper.SyncLogMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Async;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * 同步服务
 * 负责从 GitHub API 同步 Star 数据到本地数据库
 */
@Service
public class SyncService {

    private static final Logger log = LoggerFactory.getLogger(SyncService.class);

    /** 同步锁，防止重复同步 */
    private final AtomicBoolean syncing = new AtomicBoolean(false);

    /** 当前同步状态信息 */
    private volatile String syncStatus = "空闲";
    private volatile LocalDateTime lastSyncTime;
    private volatile int lastSyncCount;

    @Autowired
    private GithubApiService githubApiService;

    @Autowired
    private GithubRepoMapper githubRepoMapper;

    @Autowired
    private SyncLogMapper syncLogMapper;

    /**
     * 手动触发同步（异步执行）
     * 返回是否成功触发
     */
    @Async("syncExecutor")
    public void doManualSync() {
        doSync("手动同步");
    }

    /**
     * 定时同步：每天凌晨 2 点执行
     */
    @Scheduled(cron = "0 0 2 * * ?")
    public void doScheduledSync() {
        log.info("定时同步任务开始执行");
        doSync("定时同步");
    }

    /**
     * 执行同步逻辑
     */
    private void doSync(String syncType) {
        if (!syncing.compareAndSet(false, true)) {
            log.warn("已有同步任务在执行中，跳过本次 {}", syncType);
            return;
        }

        SyncLog syncLog = new SyncLog();
        syncLog.setSyncType(syncType);
        syncLog.setStatus("进行中");
        syncLog.setStartedAt(LocalDateTime.now());
        syncLog.setCreatedAt(LocalDateTime.now());
        syncLogMapper.insert(syncLog);

        syncStatus = "同步中...";

        try {
            // 1. 从 GitHub API 获取所有 Star 仓库
            syncStatus = "正在从 GitHub 获取数据...";
            List<GithubRepo> remoteRepos = githubApiService.fetchAllStarredRepos();
            syncLog.setTotalCount(remoteRepos.size());

            // 2. 获取数据库中现有的所有仓库（以 full_name 为 key）
            List<GithubRepo> localRepos = githubRepoMapper.selectList(null);
            Map<String, GithubRepo> localRepoMap = new HashMap<>();
            for (GithubRepo local : localRepos) {
                localRepoMap.put(local.getFullName(), local);
            }

            // 3. 同步数据：新增或更新
            syncStatus = "正在同步到数据库...";
            int syncedCount = 0;
            Map<String, Boolean> remoteFullNames = new HashMap<>();

            for (GithubRepo remote : remoteRepos) {
                remoteFullNames.put(remote.getFullName(), true);
                GithubRepo local = localRepoMap.get(remote.getFullName());

                if (local == null) {
                    // 新增
                    remote.setCreatedAt(LocalDateTime.now());
                    remote.setUpdatedAt(LocalDateTime.now());
                    githubRepoMapper.insert(remote);
                    syncedCount++;
                } else {
                    // 更新
                    remote.setId(local.getId());
                    remote.setCreatedAt(local.getCreatedAt());
                    remote.setUpdatedAt(LocalDateTime.now());
                    githubRepoMapper.updateById(remote);
                    syncedCount++;
                }
            }

            // 4. 标记已取消 Star 的仓库（从数据库删除不再存在的记录）
            for (GithubRepo local : localRepos) {
                if (!remoteFullNames.containsKey(local.getFullName())) {
                    githubRepoMapper.deleteById(local.getId());
                    log.info("删除已取消 Star 的仓库: {}", local.getFullName());
                }
            }

            // 5. 更新同步日志
            syncLog.setSyncedCount(syncedCount);
            syncLog.setStatus("成功");
            syncLog.setFinishedAt(LocalDateTime.now());
            syncLogMapper.updateById(syncLog);

            lastSyncTime = LocalDateTime.now();
            lastSyncCount = syncedCount;
            syncStatus = "同步完成";
            log.info("{} 完成, 共同步 {} 个仓库", syncType, syncedCount);

        } catch (Exception e) {
            log.error("{} 失败", syncType, e);
            syncLog.setStatus("失败");
            syncLog.setErrorMessage(e.getMessage());
            syncLog.setFinishedAt(LocalDateTime.now());
            syncLogMapper.updateById(syncLog);
            syncStatus = "同步失败: " + e.getMessage();
        } finally {
            syncing.set(false);
        }
    }

    /**
     * 获取当前同步状态
     */
    public Map<String, Object> getSyncStatus() {
        Map<String, Object> status = new HashMap<>();
        status.put("syncing", syncing.get());
        status.put("status", syncStatus);
        status.put("lastSyncTime", lastSyncTime);
        status.put("lastSyncCount", lastSyncCount);

        // 获取数据库中的总仓库数
        Long totalRepos = githubRepoMapper.selectCount(null);
        status.put("totalRepos", totalRepos);

        // 获取最近一次成功的同步日志
        LambdaQueryWrapper<SyncLog> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(SyncLog::getStatus, "成功")
               .orderByDesc(SyncLog::getFinishedAt)
               .last("LIMIT 1");
        SyncLog lastSuccessLog = syncLogMapper.selectOne(wrapper);
        if (lastSuccessLog != null) {
            status.put("lastSuccessTime", lastSuccessLog.getFinishedAt());
            status.put("lastSuccessCount", lastSuccessLog.getSyncedCount());
        }

        return status;
    }

    /**
     * 获取同步日志（分页）
     */
    public Page<SyncLog> getSyncLogs(int pageNum, int pageSize) {
        Page<SyncLog> page = new Page<>(pageNum, pageSize);
        LambdaQueryWrapper<SyncLog> wrapper = new LambdaQueryWrapper<>();
        wrapper.orderByDesc(SyncLog::getCreatedAt);
        return syncLogMapper.selectPage(page, wrapper);
    }

    /**
     * 判断是否正在同步
     */
    public boolean isSyncing() {
        return syncing.get();
    }
}
