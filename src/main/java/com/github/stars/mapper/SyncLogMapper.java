package com.github.stars.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.github.stars.entity.SyncLog;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface SyncLogMapper extends BaseMapper<SyncLog> {
}
