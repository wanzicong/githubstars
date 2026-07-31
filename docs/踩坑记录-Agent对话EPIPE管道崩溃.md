# 踩坑记录 — Agent 对话 EPIPE 管道崩溃

> **记录日期**：2026-08-01
> **影响范围**：AI Agent 流式对话（/agent 页面 chat、query 端点）
> **严重级别**：高（长任务流式对话频繁中断，用户看到"请求失败"）

---

## 问题现象

在 `/agent` 页面进行对话，尤其是**多步骤、长耗时**的任务（如让 Agent 分析完整项目、连续调用几十次工具）时：

1. 前端弹出错误提示：`请求失败 / 模型服务暂时不可用`。
2. 后端日志出现：
   ```
   [AgentClientService] Claude CLI 执行失败: Error: write EPIPE
   [AgentController] Agent chat 失败: Claude Code process exited with code 1：Error: write EPIPE
   ```
3. 用户消息已入库，但 assistant 回复缺失或残缺。

---

## 根本原因

EPIPE（broken pipe）是**子进程管道破裂**错误，发生在 Claude Agent SDK 与 Claude Code CLI 子进程之间：

1. SDK 通过 `spawn` 启动 Claude Code 子进程，`stdio: ['pipe', 'pipe', stderr]`，其中 **stdin 是 SDK 往子进程写消息的管道**（见 `node_modules/@anthropic-ai/claude-agent-sdk/sdk.mjs` 的 `processStdin.write(data)`）。
2. 长任务高频输出时，**Claude Code 子进程可能提前退出/被杀**（内存、渠道额度耗尽、网关故障、信号中断等）。
3. 子进程死后，SDK 再往它的 stdin 写数据，操作系统返回 **EPIPE**，包装成 `Claude Code process exited with code 1` 抛出。

**关键点：EPIPE 是"结果"不是"原因"** —— 子进程先死了，写入才失败。真正的"因"要往子进程为什么退出上追（瞬态抖动 vs 渠道/额度等持续故障）。

**加剧因素**：当时后端持久化逻辑在中断/异常路径写死传空数组，导致已收集的部分回复也被丢弃（该问题已单独修复，见 `agent.controller.ts` 的 H2 持久化）。

---

## 正确做法

### 1. 识别瞬态管道错误并自动重试

在 `agent-error.utils.ts` 提供 `isTransientPipeError()`，匹配 `epipe` / `exited with code 1` / `process aborted`：

```typescript
export function isTransientPipeError(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error);
    const lower = message.toLowerCase();
    return lower.includes('epipe') || lower.includes('exited with code 1') || lower.includes('process aborted');
}
```

### 2. stream() 捕获后按配置次数重试

`agent-client.service.ts` 的 `stream()` 捕获到瞬态管道错误时，按 `agent.pipe_retry_count`（system_config，默认 1，0=禁用）自动重试同一 prompt/会话；全部失败才抛出带 stderr 诊断的错误。**重试只缓解瞬态故障，对渠道额度耗尽等持续性故障无效（需换渠道/充值）。**

### 3. 前端给出可操作的降级提示

`agent-error.ts` 对 EPIPE 场景提示用户"拆小任务 / 分步提问"，而不是笼统的"请求失败"。

### 4. 中断时也要持久化已收集的部分回复（H2 已有）

`agent.controller.ts` 把 blocks/draft 提升到 chat 作用域，`persistMessages` 移到 try/catch 之外，保证中断时部分回复不丢。

---

## 验证检查清单

- [ ] 长任务（几十次工具调用）跑完不中断；若中断，后端日志出现 `第 N/M 次重试` 且最终有结果。
- [ ] 中断场景下数据库 `agent_messages` 中 assistant 有部分回复而非完全缺失。
- [ ] 前端 EPIPE 报错显示"拆小任务/分步提问"类提示，而非裸 exit code。
- [ ] `curl /api/agent/chat` 长任务在弱网关下能自愈（瞬态）。

---

## 教训

1. **EPIPE 要追子进程为什么死，而不是只处理写入失败**。它是 SDK↔CLI 子进程管道问题，跟我们自己的 SSE 管道（后端→前端）不是一回事，别混淆。
2. **长任务流式天然脆弱**：子进程跑几十秒到几分钟，任何抖动都会放大。瞬态故障靠重试兜底，持续故障靠错误分类引导用户排查渠道。
3. **区分"瞬态"与"持续"故障**是兜底设计的前提——盲目重试持续故障（如额度耗尽）只会浪费配额并延迟报错。
4. **中断路径的持久化要和正常路径一视同仁**，否则"回复丢失"会和"管道崩溃"叠加，让排查更困难。

---

## 相关文件

- [agent-client.service.ts](../packages/backend/src/agent/agent-client.service.ts)（stream 重试、retryTransientPipeError）
- [agent-error.utils.ts](../packages/backend/src/agent/agent-error.utils.ts)（isTransientPipeError）
- [agent.controller.ts](../packages/backend/src/agent/agent.controller.ts)（H2 中断持久化）
- [agent-error.ts](../packages/frontend/src/utils/agent-error.ts)（前端错误分类提示）
