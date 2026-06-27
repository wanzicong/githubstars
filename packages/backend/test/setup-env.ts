/**
 * Jest 全局环境设置 — 测试环境隔离
 *
 * 在所有测试运行前加载 .env.test，确保测试使用独立的数据库（githubstars_test），
 * 不污染开发环境数据。
 *
 * 此文件通过 Jest 的 globalSetup 配置引用，在测试进程启动时最先执行。
 */
import { config } from 'dotenv';
import { resolve } from 'path';

export default async function setup() {
    const envTestPath = resolve(__dirname, '..', '.env.test');

    // 强制加载 .env.test 并覆盖已有环境变量
    const result = config({ path: envTestPath, override: true });

    if (result.error) {
        console.error(
            `\n[ERROR] 无法加载 .env.test 文件: ${envTestPath}\n` +
                '请确认 packages/backend/.env.test 存在。\n' +
                '可从 .env.example 复制: cp .env.example .env.test\n',
        );
        throw result.error;
    }

    // 设置测试环境标识
    process.env.NODE_ENV = 'test';

    console.log(
        `[Test Setup] 测试环境已加载 — DATABASE: ${process.env.DATABASE_URL?.match(/\/([^?]+)/)?.[1] ?? 'unknown'}, ` +
            `PORT: ${process.env.PORT}`,
    );
}
