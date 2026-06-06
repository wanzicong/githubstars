package com.github.stars.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.github.stars.entity.SystemConfig;
import com.github.stars.mapper.SystemConfigMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import javax.annotation.PostConstruct;
import javax.annotation.Resource;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 系统配置服务（内存缓存 + 数据库持久化）
 */
@Service
public class SystemConfigService {

    private static final Logger log = LoggerFactory.getLogger(SystemConfigService.class);

    @Resource
    private SystemConfigMapper configMapper;

    /** 内存缓存，避免每次读数据库 */
    private final Map<String, String> cache = new ConcurrentHashMap<>();

    /**
     * 启动时加载全部配置到内存缓存
     */
    @PostConstruct
    public void init() {
        reloadCache();
        log.info("系统配置加载完成，共 {} 项", cache.size());
    }

    /**
     * 从数据库重新加载全部配置
     */
    public synchronized void reloadCache() {
        cache.clear();
        List<SystemConfig> configs = configMapper.selectList(null);
        for (SystemConfig config : configs) {
            if (config.getConfigValue() != null) {
                cache.put(config.getConfigKey(), config.getConfigValue());
            }
        }
    }

    /**
     * 获取配置值（优先从缓存）
     */
    public String getValue(String key) {
        return cache.get(key);
    }

    /**
     * 获取配置值（带默认值）
     */
    public String getValue(String key, String defaultValue) {
        String value = cache.get(key);
        return (value != null && !value.isEmpty()) ? value : defaultValue;
    }

    /**
     * 获取所有配置
     */
    public List<SystemConfig> listAll() {
        return configMapper.selectList(
                new LambdaQueryWrapper<SystemConfig>().orderByAsc(SystemConfig::getId)
        );
    }

    /**
     * 更新配置（写入数据库 + 刷新缓存）
     */
    public void update(String key, String value) {
        SystemConfig config = configMapper.selectOne(
                new LambdaQueryWrapper<SystemConfig>()
                        .eq(SystemConfig::getConfigKey, key)
        );
        if (config != null) {
            config.setConfigValue(value);
            config.setUpdatedAt(LocalDateTime.now());
            configMapper.updateById(config);
        } else {
            config = new SystemConfig();
            config.setConfigKey(key);
            config.setConfigValue(value);
            config.setCreatedAt(LocalDateTime.now());
            config.setUpdatedAt(LocalDateTime.now());
            configMapper.insert(config);
        }
        // 刷新缓存
        if (value != null && !value.isEmpty()) {
            cache.put(key, value);
        } else {
            cache.remove(key);
        }
        log.info("配置已更新: {}", key);
    }

    /**
     * 批量更新配置
     */
    public void batchUpdate(Map<String, String> updates) {
        for (Map.Entry<String, String> entry : updates.entrySet()) {
            update(entry.getKey(), entry.getValue());
        }
    }
}
