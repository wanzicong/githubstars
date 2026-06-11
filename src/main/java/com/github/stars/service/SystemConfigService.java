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
import java.util.LinkedHashMap;
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
        ensureDefaultConfigs();
        reloadCache();
        log.info("系统配置加载完成，共 {} 项", cache.size());
    }

    private void ensureDefaultConfigs() {
        Map<String, String[]> defaults = new LinkedHashMap<>();
        defaults.put("github.username", new String[]{"wanzicong", "GitHub 用户名，用于同步 Star 仓库"});
        defaults.put("github.token", new String[]{"", "GitHub Personal Access Token，用于提高 API 限额"});
        defaults.put("deepseek.api_key", new String[]{"", "DeepSeek API Key，用于 AI 分析、翻译和分类"});
        defaults.put("deepseek.api_url", new String[]{"https://api.deepseek.com/v1/chat/completions", "DeepSeek Chat Completions API 地址"});
        defaults.put("deepseek.model", new String[]{"deepseek-chat", "DeepSeek 模型名称"});
        defaults.put("clone.directory", new String[]{"D:/github-stars", "批量 Clone 的基础保存目录"});
        defaults.put("clone.proxy.url", new String[]{"", "GitHub 克隆代理加速前缀，如 https://gh-proxy.org/，为空则不使用代理"});
        defaults.put("clone.subdirectory.history", new String[]{"[]", "Clone 子目录历史记录，系统自动维护"});
        defaults.put("clone.subdirectory.last", new String[]{"", "上次选择的 Clone 子目录，系统自动维护"});

        for (Map.Entry<String, String[]> entry : defaults.entrySet()) {
            String key = entry.getKey();
            SystemConfig existing = configMapper.selectOne(
                    new LambdaQueryWrapper<SystemConfig>().eq(SystemConfig::getConfigKey, key)
            );
            if (existing == null) {
                SystemConfig config = new SystemConfig();
                config.setConfigKey(key);
                config.setConfigValue(entry.getValue()[0]);
                config.setDescription(entry.getValue()[1]);
                config.setCreatedAt(LocalDateTime.now());
                config.setUpdatedAt(LocalDateTime.now());
                configMapper.insert(config);
            } else if (existing.getDescription() == null || existing.getDescription().isEmpty()) {
                existing.setDescription(entry.getValue()[1]);
                existing.setUpdatedAt(LocalDateTime.now());
                configMapper.updateById(existing);
            }
        }
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
