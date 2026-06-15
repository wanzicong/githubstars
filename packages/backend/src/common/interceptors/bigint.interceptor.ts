import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

/**
 * BigInt 序列化拦截器
 *
 * 递归转换响应体中的 BigInt 值为 Number，
 * 替代全局 BigInt.prototype.toJSON 猴子补丁。
 *
 * 注意：超过 Number.MAX_SAFE_INTEGER (2^53-1) 的值会丢失精度。
 * 对于 GitHub Stars 项目的 BigInt ID（自增主键），在实际运行中
 * 不会达到该上限，因此是安全的。
 */
@Injectable()
export class BigIntInterceptor implements NestInterceptor {
    /**
     * 拦截 HTTP 响应，递归转换 BigInt 为 Number
     *
     * 在 NestJS 默认的 JSON 序列化之前对响应数据做预处理，
     * 将 Prisma 返回的 BigInt 类型转换为安全的 Number 类型。
     *
     * @param context 执行上下文
     * @param next 调用处理链的下一环节
     * @returns Observable 流，其中的数据已完成 BigInt 转换
     */
    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
        return next.handle().pipe(map((data) => this.convertBigInt(data)));
    }

    /**
     * 递归转换 BigInt 值
     *
     * 遍历 value 的所有层级，将遇到的 BigInt 值转为 Number。
     * 支持 null/undefined、原始值、数组、普通对象的递归处理。
     * Date 等特殊对象不会被遍历内部属性，直接原样返回。
     *
     * @param value 需要转换的任意值
     * @returns 转换后的值，BigInt 已被替换为 Number
     */
    private convertBigInt(value: any): any {
        if (value === null || value === undefined) return value;
        if (typeof value === 'bigint') return Number(value);
        if (Array.isArray(value)) return value.map((v) => this.convertBigInt(v));
        if (typeof value === 'object' && value.constructor === Object) {
            const result: Record<string, any> = {};
            for (const [key, val] of Object.entries(value)) {
                result[key] = this.convertBigInt(val);
            }
            return result;
        }
        return value;
    }
}
