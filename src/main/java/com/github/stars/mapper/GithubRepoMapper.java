package com.github.stars.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.github.stars.entity.GithubRepo;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface GithubRepoMapper extends BaseMapper<GithubRepo> {
}
