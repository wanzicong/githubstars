/**
 * 筛选参数类型接口
 *
 * 统一列表查询中常用的筛选、排序、日期范围参数类型定义，
 * 消除 github-repo.service.ts 中四处重复的内联参数类型。
 */

/** 基础筛选参数 */
export interface BaseFilterParams {
    keyword?: string;
    language?: string;
    sortBy?: string;
    sortOrder?: string;
}

/** 日期范围筛选参数 */
interface DateRangeParams {
    dateField?: string;
    startDate?: string;
    endDate?: string;
}

/** 完整筛选参数（基础 + 日期 + 翻译状态 + 分类） */
export interface FilterParams extends BaseFilterParams, DateRangeParams {
    untranslatedOnly?: boolean;
    /** 分类筛选：分类 ID，含其所有后代分类（service 内自动展开） */
    categoryId?: number;
}

/** 带分页的筛选参数 */
export interface PaginatedFilterParams extends FilterParams {
    page?: number;
    size?: number;
}
