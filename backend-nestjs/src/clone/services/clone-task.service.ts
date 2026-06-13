import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class CloneTaskService {
    constructor(private readonly prisma: PrismaService) {}

    /** P0-5: 从数据库恢复最大 taskCounter 编号 */
    async getMaxTaskCounterNumber(): Promise<number> {
        const result = await this.prisma.$queryRawUnsafe<Array<{ num: string }>>(
            `SELECT MAX(CAST(SUBSTRING(task_id, 7) AS UNSIGNED)) AS num FROM clone_task WHERE task_id LIKE 'clone_%'`,
        );
        const num = result?.[0]?.num ? parseInt(result[0].num) : 0;
        return num;
    }

    async getTaskPage(page: number, size: number) {
        const [total, records] = await Promise.all([
            this.prisma.cloneTask.count(),
            this.prisma.cloneTask.findMany({
                orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }],
                skip: (page - 1) * size,
                take: size,
            }),
        ]);

        // 重新统计已完成任务的计数
        for (const task of records) {
            if (task.status !== 'RUNNING' && task.status !== 'PENDING') {
                const [completed, failed, skipped] = await Promise.all([
                    this.prisma.cloneTaskItem.count({ where: { taskId: task.taskId, status: 'CLONED' } }),
                    this.prisma.cloneTaskItem.count({ where: { taskId: task.taskId, status: 'FAILED' } }),
                    this.prisma.cloneTaskItem.count({ where: { taskId: task.taskId, status: 'SKIPPED' } }),
                ]);
                if (task.completedRepos !== completed || task.failedRepos !== failed || task.skippedRepos !== skipped) {
                    await this.prisma.cloneTask.update({
                        where: { taskId: task.taskId },
                        data: { completedRepos: completed, failedRepos: failed, skippedRepos: skipped },
                    });
                    (task as any).completedRepos = completed;
                    (task as any).failedRepos = failed;
                    (task as any).skippedRepos = skipped;
                }
            }
        }
        return { records, total, size, current: page, pages: Math.ceil(total / size) };
    }

    async getTaskDetail(taskId: string, page: number, size: number, status: string) {
        const task = await this.prisma.cloneTask.findUnique({ where: { taskId } });
        if (!task) return null;
        const where: any = { taskId };
        if (status) where.status = status;
        const [total, items] = await Promise.all([
            this.prisma.cloneTaskItem.count({ where }),
            this.prisma.cloneTaskItem.findMany({ where, orderBy: { createdAt: 'asc' }, skip: (page - 1) * size, take: size }),
        ]);
        return { task, items, total, size, current: page, pages: Math.ceil(total / size) };
    }

    async getItemsByTaskId(taskId: string, page: number, size: number, status: string) {
        const where: any = { taskId };
        if (status) where.status = status;
        const [total, records] = await Promise.all([
            this.prisma.cloneTaskItem.count({ where }),
            this.prisma.cloneTaskItem.findMany({ where, orderBy: { createdAt: 'asc' }, skip: (page - 1) * size, take: size }),
        ]);
        return { records, total, size, current: page, pages: Math.ceil(total / size) };
    }

    async togglePin(taskId: string) {
        const task = await this.prisma.cloneTask.findUnique({ where: { taskId } });
        if (!task) throw new Error('任务不存在');
        const newVal = task.pinned === 1 ? 0 : 1;
        await this.prisma.cloneTask.update({ where: { taskId }, data: { pinned: newVal } });
        return newVal === 1;
    }

    async deleteTaskByTaskId(taskId: string) {
        await this.prisma.cloneTaskItem.deleteMany({ where: { taskId } });
        await this.prisma.cloneTask.delete({ where: { taskId } });
    }

    async hasActiveTask() {
        const count = await this.prisma.cloneTask.count({ where: { status: { in: ['RUNNING', 'PENDING'] } } });
        return count > 0;
    }

    async getTaskIdsWithFailedItems(): Promise<string[]> {
        const rows = await this.prisma.cloneTaskItem.findMany({
            where: { status: { in: ['FAILED', 'SKIPPED'] } },
            select: { taskId: true },
            distinct: ['taskId'],
        });
        return rows.map((r) => r.taskId);
    }

    async getTaskByTaskId(taskId: string) {
        return this.prisma.cloneTask.findUnique({ where: { taskId } });
    }

    async getItemByTaskIdAndFullName(taskId: string, fullName: string) {
        return this.prisma.cloneTaskItem.findFirst({ where: { taskId, fullName } });
    }

    async countItemsByTaskIdAndStatus(taskId: string, status: string) {
        return this.prisma.cloneTaskItem.count({ where: { taskId, status } });
    }

    async getTaskCountByStatus(status: string) {
        return this.prisma.cloneTask.count({ where: { status } });
    }

    async insertItem(item: { taskId: string; fullName: string; status: string; message?: string }) {
        return this.prisma.cloneTaskItem.create({ data: { ...item, createdAt: new Date() } });
    }
}
