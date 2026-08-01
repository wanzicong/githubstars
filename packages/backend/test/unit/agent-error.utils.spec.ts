import { isTokenOverflowError } from '../../src/agent/agent-error.utils';

/**
 * 针对「第三方网关 token 超限（400 exceeded model token limit）未被识别」的测试。
 *
 * 根因：长会话 resume 后首包超过模型上下文窗口（如 262144），网关返回 400，
 * 但 isTransientPipeError 只认 EPIPE/退出码，导致该错误无法触发自动重开会话。
 */
describe('isTokenOverflowError — token 超限识别', () => {
    it('应识别 "exceeded model token limit" 网关 400 错误', () => {
        const err = new Error(
            'API Error: 400 {"error":{"type":"invalid_request_error","message":"Invalid request: Your request exceeded model token limit: 262144 (requested: 279306)"},"type":"error"}',
        );
        expect(isTokenOverflowError(err)).toBe(true);
    });

    it('应识别 "prompt is too long" 错误', () => {
        expect(isTokenOverflowError(new Error('prompt is too long: 279306 tokens > 262144 maximum'))).toBe(true);
    });

    it('应识别 "context length exceeded" / "maximum context length" 错误', () => {
        expect(isTokenOverflowError(new Error('This model maximum context length is 262144 tokens'))).toBe(true);
        expect(isTokenOverflowError('context length exceeded')).toBe(true);
    });

    it('不应把普通错误误判为 token 超限', () => {
        expect(isTokenOverflowError(new Error('write EPIPE'))).toBe(false);
        expect(isTokenOverflowError(new Error('process exited with code 1'))).toBe(false);
        expect(isTokenOverflowError(new Error('401 Unauthorized'))).toBe(false);
        expect(isTokenOverflowError('usage limit reached for this billing cycle')).toBe(false);
    });

    it('非 Error 输入应按字符串处理，空值返回 false', () => {
        expect(isTokenOverflowError('exceeded model token limit')).toBe(true);
        expect(isTokenOverflowError(null)).toBe(false);
        expect(isTokenOverflowError(undefined)).toBe(false);
    });
});
