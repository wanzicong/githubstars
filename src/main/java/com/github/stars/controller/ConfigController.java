package com.github.stars.controller;

import com.github.stars.entity.SystemConfig;
import com.github.stars.service.SystemConfigService;
import org.springframework.web.bind.annotation.*;

import javax.annotation.Resource;
import java.util.*;

@RestController
@RequestMapping("/api/config")
public class ConfigController {

    @Resource
    private SystemConfigService configService;

    /**
     * 获取所有配置项
     */
    @GetMapping
    public List<Map<String, Object>> getAllConfig() {
        List<SystemConfig> configs = configService.listAll();
        List<Map<String, Object>> result = new ArrayList<>();
        for (SystemConfig config : configs) {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", config.getId());
            item.put("configKey", config.getConfigKey());
            item.put("configValue", config.getConfigValue()); // 完整值（用于编辑）
            // 敏感字段脱敏显示
            if (config.getConfigKey().contains("token") || config.getConfigKey().contains("api_key")) {
                String val = config.getConfigValue();
                if (val != null && val.length() > 8) {
                    item.put("displayValue", val.substring(0, 4) + "****" + val.substring(val.length() - 4));
                } else if (val != null && !val.isEmpty()) {
                    item.put("displayValue", "****");
                } else {
                    item.put("displayValue", "");
                }
                item.put("sensitive", true);
            } else {
                item.put("displayValue", config.getConfigValue());
                item.put("sensitive", false);
            }
            item.put("description", config.getDescription());
            result.add(item);
        }
        return result;
    }

    /**
     * 批量保存配置
     */
    @PostMapping
    public Map<String, Object> saveConfig(@RequestBody Map<String, String> body) {
        Map<String, Object> result = new LinkedHashMap<>();
        try {
            configService.batchUpdate(body);
            result.put("success", true);
            result.put("message", "配置已保存");
        } catch (Exception e) {
            result.put("success", false);
            result.put("message", "保存失败: " + e.getMessage());
        }
        return result;
    }

    /**
     * 重新加载配置缓存
     */
    @PostMapping("/reload")
    public Map<String, Object> reloadConfig() {
        Map<String, Object> result = new LinkedHashMap<>();
        configService.reloadCache();
        result.put("success", true);
        result.put("message", "配置缓存已刷新");
        return result;
    }
}
