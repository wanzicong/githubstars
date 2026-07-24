/**
 * 数据库直连客户端
 */

import { PrismaClient } from '@prisma/client';
import path from 'node:path';
import fs from 'node:fs';

let prisma: PrismaClient | null = null;

function findBackendDir(): string | null {
  // 从 CLI 包位置向上查找
  let dir = path.resolve(import.meta.dirname || process.cwd(), '..', '..');
  if (fs.existsSync(path.join(dir, 'packages', 'backend', '.env'))) {
    return path.join(dir, 'packages', 'backend');
  }

  // 从当前工作目录查找
  dir = process.cwd();
  if (fs.existsSync(path.join(dir, 'packages', 'backend', '.env'))) {
    return path.join(dir, 'packages', 'backend');
  }

  // 从环境变量查找
  if (process.env.GITHUBSTARS_HOME) {
    const backendDir = path.join(process.env.GITHUBSTARS_HOME, 'packages', 'backend');
    if (fs.existsSync(path.join(backendDir, '.env'))) {
      return backendDir;
    }
  }

  return null;
}

export async function getDbClient(): Promise<PrismaClient> {
  if (prisma) return prisma;

  const backendDir = findBackendDir();
  if (!backendDir) {
    throw new Error('找不到后端目录。请在项目根目录执行或设置 GITHUBSTARS_HOME 环境变量');
  }

  // 加载 .env 文件
  const envPath = path.join(backendDir, '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    for (const line of envContent.split('\n')) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        if (key && valueParts.length > 0) {
          const value = valueParts.join('=').replace(/^["']|["']$/g, '');
          process.env[key.trim()] = value;
        }
      }
    }
  }

  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL 环境变量未配置。请检查 packages/backend/.env 文件');
  }

  prisma = new PrismaClient({
    datasourceUrl: process.env.DATABASE_URL,
  });

  await prisma.$connect();
  return prisma;
}

export async function closeDbClient(): Promise<void> {
  if (prisma) {
    await prisma.$disconnect();
    prisma = null;
  }
}
