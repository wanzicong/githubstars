package com.github.stars.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.github.stars.entity.CloneTask;
import com.github.stars.entity.CloneTaskItem;
import com.github.stars.mapper.CloneTaskItemMapper;
import com.github.stars.mapper.CloneTaskMapper;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import javax.annotation.Resource;
import java.util.List;
import java.util.stream.Collectors;

/**
 * Clone 任务持久化服务
 */
@Service
public class CloneTaskService {

    @Resource
    private CloneTaskMapper cloneTaskMapper;

    @Resource
    private CloneTaskItemMapper cloneTaskItemMapper;

    /**
     * 创建任务
     */
    public void createTask(CloneTask task) {
        cloneTaskMapper.insert(task);
    }

    /**
     * 按主键更新任务
     */
    public void updateTask(CloneTask task) {
        cloneTaskMapper.updateById(task);
    }

    /**
     * 按 taskId 查询单个任务
     */
    public CloneTask getTaskByTaskId(String taskId) {
        LambdaQueryWrapper<CloneTask> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(CloneTask::getTaskId, taskId);
        return cloneTaskMapper.selectOne(wrapper);
    }

    /**
     * 分页查询所有任务（按创建时间降序）
     */
    public Page<CloneTask> getTaskPage(int page, int size) {
        Page<CloneTask> pageParam = new Page<>(page, size);
        LambdaQueryWrapper<CloneTask> wrapper = new LambdaQueryWrapper<>();
        wrapper.orderByDesc(CloneTask::getCreatedAt);
        return cloneTaskMapper.selectPage(pageParam, wrapper);
    }

    /**
     * 分页查询某任务的关联项（按创建时间升序）
     *
     * @param status 可选状态筛选：CLONED/FAILED/SKIPPED，为空时查全部
     */
    public Page<CloneTaskItem> getItemsByTaskId(String taskId, int page, int size, String status) {
        Page<CloneTaskItem> pageParam = new Page<>(page, size);
        LambdaQueryWrapper<CloneTaskItem> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(CloneTaskItem::getTaskId, taskId);
        if (StringUtils.hasText(status)) {
            wrapper.eq(CloneTaskItem::getStatus, status);
        }
        wrapper.orderByAsc(CloneTaskItem::getCreatedAt);
        return cloneTaskItemMapper.selectPage(pageParam, wrapper);
    }

    /**
     * 插入单项
     */
    public void insertItem(CloneTaskItem item) {
        cloneTaskItemMapper.insert(item);
    }

    /**
     * 删除任务及所有关联项
     */
    public void deleteTaskByTaskId(String taskId) {
        LambdaQueryWrapper<CloneTask> taskWrapper = new LambdaQueryWrapper<>();
        taskWrapper.eq(CloneTask::getTaskId, taskId);
        cloneTaskMapper.delete(taskWrapper);

        LambdaQueryWrapper<CloneTaskItem> itemWrapper = new LambdaQueryWrapper<>();
        itemWrapper.eq(CloneTaskItem::getTaskId, taskId);
        cloneTaskItemMapper.delete(itemWrapper);
    }

    /**
     * 检查是否存在活跃任务（RUNNING 或 PENDING）
     */
    public boolean hasActiveTask() {
        LambdaQueryWrapper<CloneTask> wrapper = new LambdaQueryWrapper<>();
        wrapper.in(CloneTask::getStatus, "RUNNING", "PENDING");
        return cloneTaskMapper.selectCount(wrapper) > 0;
    }

    /**
     * 统计某任务的总项数
     */
    public long countItemsByTaskId(String taskId) {
        LambdaQueryWrapper<CloneTaskItem> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(CloneTaskItem::getTaskId, taskId);
        return cloneTaskItemMapper.selectCount(wrapper);
    }

    /**
     * 查询所有有失败项的任务 ID（排除 PENDING）
     */
    public List<String> getTaskIdsWithFailedItems() {
        LambdaQueryWrapper<CloneTaskItem> wrapper = new LambdaQueryWrapper<>();
        wrapper.select(CloneTaskItem::getTaskId)
               .eq(CloneTaskItem::getStatus, "FAILED")
               .groupBy(CloneTaskItem::getTaskId);
        return cloneTaskItemMapper.selectList(wrapper).stream()
                .map(CloneTaskItem::getTaskId)
                .distinct()
                .collect(Collectors.toList());
    }

    /**
     * 按状态统计任务数
     */
    public long getTaskCountByStatus(String status) {
        LambdaQueryWrapper<CloneTask> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(CloneTask::getStatus, status);
        return cloneTaskMapper.selectCount(wrapper);
    }

    /**
     * 查询某任务的所有失败项
     */
    public List<CloneTaskItem> getFailedItemsByTaskId(String taskId) {
        LambdaQueryWrapper<CloneTaskItem> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(CloneTaskItem::getTaskId, taskId)
               .eq(CloneTaskItem::getStatus, "FAILED");
        return cloneTaskItemMapper.selectList(wrapper);
    }

    /**
     * 更新单项状态
     */
    public void updateItem(CloneTaskItem item) {
        cloneTaskItemMapper.updateById(item);
    }

    /**
     * 按 taskId 和 fullName 查询单项
     */
    public CloneTaskItem getItemByTaskIdAndFullName(String taskId, String fullName) {
        LambdaQueryWrapper<CloneTaskItem> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(CloneTaskItem::getTaskId, taskId)
               .eq(CloneTaskItem::getFullName, fullName);
        return cloneTaskItemMapper.selectOne(wrapper);
    }

    /**
     * 按 taskId 和 status 统计项数
     */
    public int countItemsByTaskIdAndStatus(String taskId, String status) {
        LambdaQueryWrapper<CloneTaskItem> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(CloneTaskItem::getTaskId, taskId)
               .eq(CloneTaskItem::getStatus, status);
        return cloneTaskItemMapper.selectCount(wrapper).intValue();
    }
}
