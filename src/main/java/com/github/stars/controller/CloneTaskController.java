package com.github.stars.controller;

import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.github.stars.entity.CloneTask;
import com.github.stars.entity.CloneTaskItem;
import com.github.stars.service.CloneService;
import com.github.stars.service.CloneTaskService;
import org.springframework.web.bind.annotation.*;

import javax.annotation.Resource;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Clone 任务管理 - 历史任务查询和删除
 */
@RestController
@RequestMapping("/api/clone/tasks")
public class CloneTaskController {

    @Resource
    private CloneTaskService cloneTaskService;

    @Resource
    private CloneService cloneService;

    /**
     * 分页查询所有 Clone 任务
     */
    @GetMapping
    public Map<String, Object> listTasks(
            @RequestParam(value = "page", defaultValue = "1") int page,
            @RequestParam(value = "size", defaultValue = "20") int size) {
        Map<String, Object> result = new LinkedHashMap<>();
        Page<CloneTask> taskPage = cloneTaskService.getTaskPage(page, size);
        result.put("success", true);
        result.put("records", taskPage.getRecords());
        result.put("total", taskPage.getTotal());
        result.put("size", taskPage.getSize());
        result.put("current", taskPage.getCurrent());
        result.put("pages", taskPage.getPages());
        return result;
    }

    /**
     * 查询单个任务详情（含关联项分页）
     */
    @GetMapping("/{taskId}")
    public Map<String, Object> getTaskDetail(
            @PathVariable String taskId,
            @RequestParam(value = "page", defaultValue = "1") int page,
            @RequestParam(value = "size", defaultValue = "100") int size) {
        Map<String, Object> result = new LinkedHashMap<>();
        CloneTask task = cloneTaskService.getTaskByTaskId(taskId);
        if (task == null) {
            result.put("success", false);
            result.put("message", "任务不存在");
            return result;
        }

        Page<CloneTaskItem> itemPage = cloneTaskService.getItemsByTaskId(taskId, page, size);
        task.setItems(itemPage.getRecords());

        result.put("success", true);
        result.put("task", task);
        result.put("items", itemPage.getRecords());
        result.put("total", itemPage.getTotal());
        result.put("size", itemPage.getSize());
        result.put("current", itemPage.getCurrent());
        result.put("pages", itemPage.getPages());
        return result;
    }

    /**
     * 分页查询某任务的克隆项
     */
    @GetMapping("/{taskId}/items")
    public Map<String, Object> listTaskItems(
            @PathVariable String taskId,
            @RequestParam(value = "page", defaultValue = "1") int page,
            @RequestParam(value = "size", defaultValue = "100") int size) {
        Map<String, Object> result = new LinkedHashMap<>();
        Page<CloneTaskItem> itemPage = cloneTaskService.getItemsByTaskId(taskId, page, size);
        result.put("success", true);
        result.put("records", itemPage.getRecords());
        result.put("total", itemPage.getTotal());
        result.put("size", itemPage.getSize());
        result.put("current", itemPage.getCurrent());
        result.put("pages", itemPage.getPages());
        return result;
    }

    /**
     * 重试失败项
     */
    @PostMapping("/{taskId}/retry")
    public Map<String, Object> retryTask(@PathVariable String taskId) {
        Map<String, Object> result = new LinkedHashMap<>();
        try {
            CloneTask task = cloneTaskService.getTaskByTaskId(taskId);
            if (task == null) {
                result.put("success", false);
                result.put("message", "任务不存在");
                return result;
            }
            if ("RUNNING".equals(task.getStatus()) || "PENDING".equals(task.getStatus())) {
                result.put("success", false);
                result.put("message", "任务正在执行中，无法重试");
                return result;
            }
            List<CloneTaskItem> failedItems = cloneTaskService.getFailedItemsByTaskId(taskId);
            if (failedItems.isEmpty()) {
                result.put("success", false);
                result.put("message", "没有需要重试的失败项");
                return result;
            }
            cloneService.retryFailedClones(taskId);
            result.put("success", true);
            result.put("message", "已开始重试 " + failedItems.size() + " 个失败项");
            result.put("retryCount", failedItems.size());
        } catch (Exception e) {
            result.put("success", false);
            result.put("message", "重试失败: " + e.getMessage());
        }
        return result;
    }

    /**
     * 删除 Clone 任务及所有关联项
     */
    @DeleteMapping("/{taskId}")
    public Map<String, Object> deleteTask(@PathVariable String taskId) {
        Map<String, Object> result = new LinkedHashMap<>();
        cloneTaskService.deleteTaskByTaskId(taskId);
        result.put("success", true);
        result.put("message", "任务已删除");
        return result;
    }
}
