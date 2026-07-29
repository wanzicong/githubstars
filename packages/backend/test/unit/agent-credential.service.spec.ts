import { Logger } from '@nestjs/common';
import { AgentCredentialService } from '../../src/agent/agent-credential.service';
import { isMissingConversationError, selectResumableSessionId } from '../../src/agent/agent-error.utils';

describe('AgentCredentialService', () => {
    const originalApiKey = process.env.ANTHROPIC_API_KEY;
    const originalAuthToken = process.env.ANTHROPIC_AUTH_TOKEN;
    const originalBaseUrl = process.env.ANTHROPIC_BASE_URL;

    afterEach(() => {
        if (originalApiKey === undefined) delete process.env.ANTHROPIC_API_KEY;
        else process.env.ANTHROPIC_API_KEY = originalApiKey;
        if (originalAuthToken === undefined) delete process.env.ANTHROPIC_AUTH_TOKEN;
        else process.env.ANTHROPIC_AUTH_TOKEN = originalAuthToken;
        if (originalBaseUrl === undefined) delete process.env.ANTHROPIC_BASE_URL;
        else process.env.ANTHROPIC_BASE_URL = originalBaseUrl;
        jest.restoreAllMocks();
    });

    it('仅配置 ANTHROPIC_AUTH_TOKEN 时不应误报缺少模型凭据', async () => {
        delete process.env.ANTHROPIC_API_KEY;
        process.env.ANTHROPIC_AUTH_TOKEN = 'proxy-token';
        const config = { getValue: jest.fn().mockResolvedValue(undefined) };
        const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
        const service = new AgentCredentialService(config as never);

        await service.refreshCredentials();

        expect(process.env.ANTHROPIC_AUTH_TOKEN).toBe('proxy-token');
        expect(errorSpy).not.toHaveBeenCalledWith(expect.stringContaining('Anthropic 凭据'));
    });
});

describe('isMissingConversationError', () => {
    it('应识别容器重建后 SDK 会话文件丢失错误', () => {
        expect(isMissingConversationError('No conversation found with session ID: abc-123')).toBe(true);
        expect(isMissingConversationError('tokenization failed')).toBe(false);
    });
});

describe('selectResumableSessionId', () => {
    it('应优先使用 result 的主会话 ID，而不是 init 阶段的队列 ID', () => {
        expect(
            selectResumableSessionId([
                { type: 'system', subtype: 'init', session_id: 'queue-session' },
                { type: 'result', session_id: 'main-session' },
            ]),
        ).toBe('main-session');
    });
});
