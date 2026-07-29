/** 判断 Claude CLI 是否因为本地会话文件丢失而无法恢复数据库中保存的 sessionId。 */
export function isMissingConversationError(stderr: string): boolean {
    return stderr.toLowerCase().includes('no conversation found with session id');
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
