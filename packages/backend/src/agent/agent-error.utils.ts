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
