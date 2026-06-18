import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';
import { z } from 'zod';

/**
 * 基于 Zod schema 的通用验证管道
 *
 * 替代 NestJS 内置的 ValidationPipe（需要 class-validator），
 * 利用项目已安装的 Zod 进行输入验证和类型转换。
 *
 * 用法：
 *   @Body(new ZodValidationPipe(MySchema)) body: z.infer<typeof MySchema>
 *
 * 或全局注册（main.ts）：
 *   app.useGlobalPipes(new ZodValidationPipe())  — 需要 @Body 带 schema 参数
 */
@Injectable()
export class ZodValidationPipe<T extends z.ZodType = z.ZodType> implements PipeTransform {
    constructor(private readonly schema?: T) {}

    transform(value: unknown): z.infer<T> {
        if (!this.schema) {
            return value as z.infer<T>;
        }
        const result = this.schema.safeParse(value);
        if (!result.success) {
            const errors = result.error.issues
                .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
                .join('; ');
            throw new BadRequestException(`输入验证失败: ${errors}`);
        }
        return result.data;
    }
}
