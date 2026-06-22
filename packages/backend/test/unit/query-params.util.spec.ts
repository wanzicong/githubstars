import { resolveSortField, resolveSortDir, parseLanguages, DATE_FIELD_MAP } from '../../src/common/utils/query-params.util';

describe('resolveSortField', () => {
    it('stars_count → starsCount', () => {
        expect(resolveSortField('stars_count')).toBe('starsCount');
    });

    it('forks_count → forksCount', () => {
        expect(resolveSortField('forks_count')).toBe('forksCount');
    });

    it('repo_updated_at → repoUpdatedAt', () => {
        expect(resolveSortField('repo_updated_at')).toBe('repoUpdatedAt');
    });

    it('starred_at → starredAt', () => {
        expect(resolveSortField('starred_at')).toBe('starredAt');
    });

    it('未传入时返回 stars_count 的映射（starsCount）', () => {
        expect(resolveSortField(undefined)).toBe('starsCount');
    });

    it('未知字段返回默认 fallback', () => {
        expect(resolveSortField('unknown_field')).toBe('starredAt');
    });

    it('空字符串返回 stars_count 的映射', () => {
        expect(resolveSortField('')).toBe('starsCount');
    });
});

describe('resolveSortDir', () => {
    it('asc → asc', () => {
        expect(resolveSortDir('asc')).toBe('asc');
    });

    it('desc → desc', () => {
        expect(resolveSortDir('desc')).toBe('desc');
    });

    it('未传入时默认 desc', () => {
        expect(resolveSortDir(undefined)).toBe('desc');
    });

    it('非法值默认 desc', () => {
        expect(resolveSortDir('invalid')).toBe('desc');
    });
});

describe('parseLanguages', () => {
    it('逗号分隔字符串 → 数组', () => {
        expect(parseLanguages('JavaScript,TypeScript')).toEqual(['JavaScript', 'TypeScript']);
    });

    it('单个语言 → 单元素数组', () => {
        expect(parseLanguages('Python')).toEqual(['Python']);
    });

    it('空字符串 → undefined', () => {
        expect(parseLanguages('')).toBeUndefined();
    });

    it('undefined → undefined', () => {
        expect(parseLanguages(undefined)).toBeUndefined();
    });

    it('含空格的逗号分隔（不trim空格）', () => {
        expect(parseLanguages('Go, Rust, Python')).toEqual(['Go', ' Rust', ' Python']);
    });
});

describe('DATE_FIELD_MAP', () => {
    it('应包含所有日期字段映射', () => {
        expect(DATE_FIELD_MAP).toHaveProperty('starred_at', 'starredAt');
        expect(DATE_FIELD_MAP).toHaveProperty('repo_created_at', 'repoCreatedAt');
        expect(DATE_FIELD_MAP).toHaveProperty('repo_updated_at', 'repoUpdatedAt');
        expect(DATE_FIELD_MAP).toHaveProperty('repo_pushed_at', 'repoPushedAt');
    });
});
