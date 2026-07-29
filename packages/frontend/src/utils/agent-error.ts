const QUOTA_ERROR_PATTERN =
    /usage limit|billing cycle|quota.{0,20}(?:exceeded|reached|exhausted)|insufficient.{0,20}(?:credit|balance)|额度.{0,10}(?:不足|用完|耗尽)|余额不足/iu
const AUTH_ERROR_PATTERN = /(?:status code |http )?401|unauthorized|authentication|invalid api key|认证失败|密钥无效/iu
const PERMISSION_ERROR_PATTERN = /(?:status code |http )?403|permission_error|forbidden|无权访问|权限不足/iu
const CONNECTION_ERROR_PATTERN = /econnrefused|connection refused|fetch failed|network error|socket hang up|代理连接/iu
const SHELL_ERROR_PATTERN = /no suitable shell found|posix shell environment|未找到可用 shell/iu
const PROCESS_EXIT_PATTERN = /(?:claude code )?process exited with code \d+/iu

/**
 * 将 Agent/Claude CLI 的技术错误转换为用户可理解、可执行的提示。
 *
 * 后端无法始终从 Claude Agent SDK 子进程取得上游响应体，因此对通用退出码
 * 给出最常见的渠道、额度和代理排查方向，避免直接暴露无意义的 exit code。
 */
export function getAgentFriendlyErrorMessage(error: unknown): string {
    let raw = ''
    if (error instanceof Error) {
        raw = error.message
    } else if (typeof error === 'string') {
        raw = error
    }

    if (QUOTA_ERROR_PATTERN.test(raw)) {
        return '模型服务额度已用完，请在 CC Switch 中更换可用渠道或补充当前渠道额度后重试。'
    }
    if (AUTH_ERROR_PATTERN.test(raw)) {
        return '模型服务认证失败，请检查 CC Switch 当前渠道的 API Key 或登录状态后重试。'
    }
    if (PERMISSION_ERROR_PATTERN.test(raw)) {
        return '当前模型渠道拒绝了请求，请检查账户权限、模型权限或渠道配置后重试。'
    }
    if (CONNECTION_ERROR_PATTERN.test(raw)) {
        return '模型代理连接失败，请确认 CC Switch 已启动且当前渠道可用，然后重试。'
    }
    if (SHELL_ERROR_PATTERN.test(raw)) {
        return '智能体运行环境配置异常（未找到可用 Shell），请联系管理员检查容器配置。'
    }
    if (PROCESS_EXIT_PATTERN.test(raw)) {
        return '模型服务暂时不可用。常见原因是当前渠道额度不足、认证失效或代理连接异常；请在 CC Switch 中检查当前渠道和剩余额度后重试。'
    }

    return raw || '智能体处理失败，请稍后重试。'
}
