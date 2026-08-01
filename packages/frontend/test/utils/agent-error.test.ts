import { describe, expect, it } from 'vitest'
import { getAgentFriendlyErrorMessage } from '../../src/utils/agent-error'

describe('getAgentFriendlyErrorMessage', () => {
    it('应将模型额度错误转换为明确的处理建议', () => {
        const message = getAgentFriendlyErrorMessage(
            '403 {"error":{"type":"permission_error","message":"You have reached your usage limit for this billing cycle."}}',
        )

        expect(message).toBe('模型服务额度已用完，请在 CC Switch 中更换可用渠道或补充当前渠道额度后重试。')
    })

    it('应将 Claude CLI 通用退出码转换为渠道排查提示', () => {
        const message = getAgentFriendlyErrorMessage(new Error('Claude Code process exited with code 1'))

        expect(message).toContain('模型服务暂时不可用')
        expect(message).toContain('CC Switch')
        expect(message).not.toContain('exited with code')
    })

    it('应识别认证、权限、代理和 Shell 配置错误', () => {
        expect(getAgentFriendlyErrorMessage('HTTP 401 Unauthorized')).toContain('认证失败')
        expect(getAgentFriendlyErrorMessage('403 permission_error')).toContain('拒绝了请求')
        expect(getAgentFriendlyErrorMessage('connect ECONNREFUSED 127.0.0.1:15721')).toContain('代理连接失败')
        expect(getAgentFriendlyErrorMessage('No suitable shell found')).toContain('运行环境配置异常')
    })

    it('未知错误应保留原始可读信息，空错误应使用兜底提示', () => {
        expect(getAgentFriendlyErrorMessage(new Error('请求超时'))).toBe('请求超时')
        expect(getAgentFriendlyErrorMessage(null)).toBe('智能体处理失败，请稍后重试。')
    })
    it('EPIPE 管道错误应优先于通用退出码，不再误报为额度问题（回归：容器内 Shell 缺失导致 EPIPE 时文案误导）', () => {
        const message = getAgentFriendlyErrorMessage(new Error('Claude Code process exited with code 1：Error: write EPIPE'))

        expect(message).toContain('长任务在流式传输中被中断')
        expect(message).not.toContain('额度')
        expect(message).not.toContain('CC Switch')
    })

    it('包含 Shell 缺失信息的错误应提示运行环境配置异常', () => {
        const message = getAgentFriendlyErrorMessage(new Error('Claude Code process exited with code 1：No suitable shell found. Claude CLI requires a Posix shell environment.'))

        expect(message).toContain('运行环境配置异常')
        expect(message).not.toContain('额度')
    })
})