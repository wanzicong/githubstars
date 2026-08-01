/** 判断 Claude CLI 是否因为本地会话文件丢失而无法恢复数据库中保存的 sessionId。 */
export function isMissingConversationError(stderr: string): boolean {
    return stderr.toLowerCase().includes('no conversation found with session id');
}

/**
 * 判断错误是否为「子进程管道破裂」类瞬态错误（EPIPE / 子进程异常退出）。
 * 这类错误多发生在长任务高频输出时 Claude Code 子进程提前退出、SDK 再写 stdin 触发，
 * 属于可重试的瞬态故障，重试一次通常可恢复。
 */
export function isTransientPipeError(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error);
    const lower = message.toLowerCase();
    return lower.includes('epipe') || lower.includes('exited with code 1') || lower.includes('process aborted');
}

/**
 * 判断错误是否为「请求超出模型上下文窗口」（token 超限）。
 * 第三方网关（如 DeepSeek）在长会话 resume 后首包超过上下文窗口时返回 400，
 * 属于持续性错误（重试无效），需要重开新会话 + 摘要续聊来恢复。
 */
export function isTokenOverflowError(error: unknown): boolean {
    if (error === null || error === undefined) return false;
    let message: string;
    if (error instanceof Error) {
        message = error.message;
    } else if (typeof error === 'string') {
        message = error;
    } else {
        message = JSON.stringify(error);
    }
    const lower = message.toLowerCase();
    return (
        lower.includes('exceeded model token limit') ||
        lower.includes('prompt is too long') ||
        lower.includes('context length exceeded') ||
        lower.includes('maximum context length')
    );
}

interface SessionMessage {
    type: string;
    subtype?: string;
    session_id?: string;
}

/** result 中的 ID 对应可恢复的主会话文件；init ID 在部分代理模式下可能只是队列会话。 */
export function selectResumableSessionId(messages: SessionMessage[]): string | undefined {
    const resultMessage = [...messages].reverse().find((message) => message.type === 'result' && message.session_id);
    if (resultMessage?.session_id) return resultMessage.session_id;
    return messages.find((message) => message.type === 'system' && message.subtype === 'init' && message.session_id)?.session_id;
}
