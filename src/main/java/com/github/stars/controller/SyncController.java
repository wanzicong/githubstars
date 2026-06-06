package com.github.stars.controller;

import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.github.stars.entity.SyncLog;
import com.github.stars.service.SyncService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

/**
 * 同步管理控制器
 */
@RestController
@RequestMapping("/sync")
public class SyncController {

    @Autowired
    private SyncService syncService;

    /**
     * 触发手动同步
     */
    @PostMapping("/manual")
    public Map<String, Object> manualSync() {
        Map<String, Object> result = new HashMap<>();
        if (syncService.isSyncing()) {
            result.put("success", false);
            result.put("message", "已有同步任务在执行中，请稍后再试");
            return result;
        }

        syncService.doManualSync();
        result.put("success", true);
        result.put("message", "同步任务已启动");
        return result;
    }

    /**
     * 获取当前同步状态（轮询）
     */
    @GetMapping("/status")
    public Map<String, Object> syncStatus() {
        return syncService.getSyncStatus();
    }

    /**
     * 同步日志分页列表
     */
    @GetMapping("/logs")
    public Map<String, Object> syncLogs(
            @RequestParam(defaultValue = "1") int pageNum,
            @RequestParam(defaultValue = "10") int pageSize) {
        Page<SyncLog> page = syncService.getSyncLogs(pageNum, pageSize);
        Map<String, Object> result = new HashMap<>();
        result.put("records", page.getRecords());
        result.put("total", page.getTotal());
        result.put("pages", page.getPages());
        result.put("current", page.getCurrent());
        return result;
    }
}
