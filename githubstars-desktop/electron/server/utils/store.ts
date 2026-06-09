/**
 * 简单的 JSON 文件配置存储（替代 electron-store，避免 ESM/CJS 兼容问题）
 */
import * as fs from 'fs';
import * as path from 'path';

type StoreSchema = {
  githubUsername: string;
  githubToken: string;
  deepseekApiKey: string;
  deepseekModel: string;
  deepseekApiUrl: string;
};

const defaults: StoreSchema = {
  githubUsername: 'wanzicong',
  githubToken: '',
  deepseekApiKey: '',
  deepseekModel: 'deepseek-chat',
  deepseekApiUrl: 'https://api.deepseek.com/v1/chat/completions',
};

let configPath = '';
let cache: StoreSchema | null = null;

function getConfigPath(): string {
  if (configPath) return configPath;

  try {
    const { app } = require('electron');
    if (app && app.getPath) {
      configPath = path.join(app.getPath('userData'), 'config.json');
      return configPath;
    }
  } catch {
    // 非 Electron 环境
  }

  configPath = path.join(process.cwd(), 'config.json');
  return configPath;
}

function load(): StoreSchema {
  if (cache) return cache;

  try {
    if (fs.existsSync(getConfigPath())) {
      const raw = fs.readFileSync(getConfigPath(), 'utf-8');
      const parsed = JSON.parse(raw);
      cache = { ...defaults, ...parsed };
    } else {
      cache = { ...defaults };
    }
  } catch {
    cache = { ...defaults };
  }

  return cache!;
}

function save(data: StoreSchema): void {
  const dir = path.dirname(getConfigPath());
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(getConfigPath(), JSON.stringify(data, null, 2), 'utf-8');
}

export const store = {
  get<K extends keyof StoreSchema>(key: K): StoreSchema[K] {
    return load()[key];
  },
  set<K extends keyof StoreSchema>(key: K, value: StoreSchema[K]): void {
    const data = load();
    data[key] = value;
    cache = data;
    save(data);
  },
  getAll(): StoreSchema {
    return { ...load() };
  },
};
