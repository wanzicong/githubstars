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
    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
        return next.handle().pipe(map((data) => this.convertBigInt(data)));
    }

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
