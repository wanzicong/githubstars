/**
 * CLI 配置管理
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

export interface CliConfig {
  baseUrl: string;
  outputFormat: 'table' | 'json' | 'csv';
  pageSize: number;
  defaultConcurrency: number;
  defaultTargetDir: string;
}

const CONFIG_FILE = path.join(os.homedir(), '.githubstars-cli.json');

const DEFAULT_CONFIG: CliConfig = {
  baseUrl: 'http://localhost:10002',
  outputFormat: 'table',
  pageSize: 20,
  defaultConcurrency: 5,
  defaultTargetDir: path.join(os.homedir(), 'github-stars'),
};

let cachedConfig: CliConfig | null = null;

export function getConfig(): CliConfig {
  if (cachedConfig) return cachedConfig;

  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const content = fs.readFileSync(CONFIG_FILE, 'utf-8');
      const saved = JSON.parse(content);
      cachedConfig = { ...DEFAULT_CONFIG, ...saved };
    } else {
      cachedConfig = { ...DEFAULT_CONFIG };
    }
  } catch {
    cachedConfig = { ...DEFAULT_CONFIG };
  }

  return cachedConfig!;
}

export function saveConfig(config: Partial<CliConfig>): void {
  const current = getConfig();
  const merged = { ...current, ...config };
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(merged, null, 2), 'utf-8');
  cachedConfig = merged;
}

export function resetConfig(): void {
  if (fs.existsSync(CONFIG_FILE)) {
    fs.unlinkSync(CONFIG_FILE);
  }
  cachedConfig = null;
}
