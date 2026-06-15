/**
 * @githubstars/shared — 前后端共享类型定义与工具函数。
 *
 * 架构层级：基础库层，被 backend 和 frontend 共同依赖。
 *
 * @callers
 *   - @githubstars/backend — NestJS 后端
 *   - @githubstars/frontend — React 前端
 *
 * @depends 无外部依赖（纯 TypeScript 类型 + 工具函数）
 */

export * from './types/index.js';
