/**
 * formatNumberCn 工具函数测试
 *
 * 测试中文数字简写转换的各种边界情况。
 */
import { describe, it, expect } from 'vitest'
import { formatNumberCn } from '../../src/utils/format'

describe('formatNumberCn', () => {
    describe('基础边界', () => {
        it('0 → "0"', () => {
            expect(formatNumberCn(0)).toBe('0')
        })

        it('< 1000 返回原始数字字符串', () => {
            expect(formatNumberCn(1)).toBe('1')
            expect(formatNumberCn(999)).toBe('999')
        })

        it('1000 → "1千"', () => {
            expect(formatNumberCn(1000)).toBe('1千')
        })
    })

    describe('千位', () => {
        it('1049 → "1千"', () => {
            expect(formatNumberCn(1049)).toBe('1千')
        })

        it('5100 → "5千1百"', () => {
            expect(formatNumberCn(5100)).toBe('5千1百')
        })

        it('9999 → "9千9百"', () => {
            expect(formatNumberCn(9999)).toBe('9千9百')
        })
    })

    describe('万位', () => {
        it('10000 → "1万"', () => {
            expect(formatNumberCn(10000)).toBe('1万')
        })

        it('11000 → "1万1千"', () => {
            expect(formatNumberCn(11000)).toBe('1万1千')
        })

        it('61217 → "6万1千"', () => {
            expect(formatNumberCn(61217)).toBe('6万1千')
        })

        it('193336 → "19万3千"', () => {
            expect(formatNumberCn(193336)).toBe('19万3千')
        })

        it('100000 → "10万"', () => {
            expect(formatNumberCn(100000)).toBe('10万')
        })

        it('1000000 → "100万"', () => {
            expect(formatNumberCn(1000000)).toBe('100万')
        })
    })

    describe('精度边界', () => {
        it('10001 → "1万" (千位为0省略)', () => {
            expect(formatNumberCn(10001)).toBe('1万')
        })

        it('10099 → "1万" (千位为0)', () => {
            expect(formatNumberCn(10099)).toBe('1万')
        })
    })
})
