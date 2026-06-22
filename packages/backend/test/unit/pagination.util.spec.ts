import { buildPaginationResult } from '../../src/common/utils/pagination.util';

describe('buildPaginationResult', () => {
    it('应构建标准分页结果', () => {
        const result = buildPaginationResult(['a', 'b', 'c'], 25, 1, 10);
        expect(result.records).toEqual(['a', 'b', 'c']);
        expect(result.total).toBe(25);
        expect(result.size).toBe(10);
        expect(result.current).toBe(1);
        expect(result.pages).toBe(3);
    });

    it('空数据应返回空数组和正确页数', () => {
        const result = buildPaginationResult([], 0, 1, 10);
        expect(result.records).toEqual([]);
        expect(result.total).toBe(0);
        expect(result.pages).toBe(0);
    });

    it('单页数据应返回 pages=1', () => {
        const result = buildPaginationResult(['x'], 5, 1, 10);
        expect(result.pages).toBe(1);
    });

    it('第2页应正确设置 current', () => {
        const result = buildPaginationResult(['x', 'y'], 25, 2, 10);
        expect(result.current).toBe(2);
        expect(result.pages).toBe(3);
    });
});
