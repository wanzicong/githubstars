package com.github.stars.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.github.stars.entity.CloneTask;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface CloneTaskMapper extends BaseMapper<CloneTask> {

    /** 获取最大 taskCounter 编号 */
    @Select("SELECT COALESCE(MAX(CAST(SUBSTRING(task_id, 7) AS UNSIGNED)), 0) FROM clone_task WHERE task_id LIKE 'clone\\_%'")
    int selectMaxTaskCounterNumber();
}
