import { Test } from '@nestjs/testing';
import { LoggingService } from '../../src/logging/logging.service';
import * as fs from 'fs';
import * as path from 'path';

describe('LoggingService', () => {
    let service: LoggingService;

    beforeEach(async () => {
        jest.clearAllMocks();
        const module = await Test.createTestingModule({
            providers: [LoggingService],
        }).compile();
        service = module.get(LoggingService);
    });

    afterEach(() => {
        service.onModuleDestroy();
    });

    describe('log methods', () => {
        it('应支持 info 日志', () => {
            expect(() => service.log('test message', 'TestContext')).not.toThrow();
        });

        it('应支持 error 日志（字符串）', () => {
            expect(() => service.error('error message')).not.toThrow();
        });

        it('应支持 error 日志（Error 对象）', () => {
            expect(() => service.error(new Error('test error'))).not.toThrow();
        });

        it('应支持 warn 日志', () => {
            expect(() => service.warn('warning', 'TestContext')).not.toThrow();
        });

        it('应支持 debug 日志', () => {
            expect(() => service.debug('debug info')).not.toThrow();
        });
    });

    describe('getLogFiles', () => {
        it('应返回日志文件列表', () => {
            const files = service.getLogFiles();
            expect(Array.isArray(files)).toBe(true);
            files.forEach((f) => {
                expect(f).toHaveProperty('name');
                expect(f).toHaveProperty('size');
                expect(f).toHaveProperty('mtime');
            });
        });
    });

    describe('readLogFile', () => {
        it('不存在的文件应返回空字符串', () => {
            const result = service.readLogFile('nonexistent.log');
            expect(result).toBe('');
        });

        it('非法文件名（非 .log）应返回空字符串', () => {
            const result = service.readLogFile('../../../etc/passwd');
            expect(result).toBe('');
        });

        it('存在的日志文件应返回内容', () => {
            const files = service.getLogFiles();
            if (files.length > 0) {
                const result = service.readLogFile(files[0].name);
                expect(typeof result).toBe('string');
            }
        });
    });

    describe('clearLogFile', () => {
        it('不存在的文件应返回 false', () => {
            const result = service.clearLogFile('nonexistent.log');
            expect(result).toBe(false);
        });

        it('非法文件名应返回 false', () => {
            const result = service.clearLogFile('/etc/passwd');
            expect(result).toBe(false);
        });
    });
});
