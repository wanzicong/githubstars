import { z } from 'zod';

export const LocalizationFieldsSchema = z.enum(['description', 'readme', 'both']);

export const LocalizeRepositorySchema = z.object({
    repoId: z.number().int().positive(),
    fields: LocalizationFieldsSchema.default('both'),
    force: z.boolean().default(false),
});

export type LocalizeRepositoryDto = z.infer<typeof LocalizeRepositorySchema>;

export const LocalizeBatchSchema = z.object({
    repoIds: z.array(z.number().int().positive()).min(1).max(2000),
    fields: LocalizationFieldsSchema.default('both'),
    force: z.boolean().default(false),
    concurrency: z.number().int().min(1).max(5).default(2),
});

export type LocalizeBatchDto = z.infer<typeof LocalizeBatchSchema>;

export const LocalizationTaskSchema = z.object({
    taskId: z.number().int().positive(),
});

export type LocalizationTaskDto = z.infer<typeof LocalizationTaskSchema>;
