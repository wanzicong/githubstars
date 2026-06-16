import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class CloneTaskService {
    private readonly logger = new Logger(CloneTaskService.name);

    constructor(private readonly prisma: PrismaService) {}

    /**
     * 从数据库恢复最大 taskCounter 编号，确保重启后任务编号连续
     *
     * @returns 当前最大的 taskCounter 数字编号
     */
    async getMaxTaskCounterNumber(): Promise<number> {
        const result = await this.prisma.$queryRawUnsafe<Array<{ num: string }>>(
            `SELECT MAX(CAST(SUBSTRING(task_id, 7) AS UNSIGNED)) AS num FROM clone_task WHERE task_id LIKE 'clone_%'`,
        );
        const num = result?.[0]?.num ? parseInt(result[0].num) : 0;
        return num;
    }

    /**
     * 分页查询克隆任务列表，对已完成/非活跃任务自动修正统计数据
     *
     * @param page 页码
     * @param size 每页数量
     * @returns 任务分页数据
     */
    async getTaskPage(page: number, size: number) {
        const [total, records] = await Promise.all([
            this.prisma.cloneTask.count(),
            this.prisma.cloneTask.findMany({
                orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }],
                skip: (page - 1) * size,
                take: size,
            }),
        ]);

        // 批量统计非活跃任务计数（替代 N+1 逐条查询）
        const nonActiveTaskIds = records.filter((t) => t.status !== 'RUNNING' && t.status !== 'PENDING').map((t) => t.taskId);

        if (nonActiveTaskIds.length > 0) {
            const counts = await this.prisma.$queryRawUnsafe<Array<{ task_id: string; status: string; cnt: bigint }>>(
                `SELECT task_id, status, COUNT(*) as cnt FROM clone_task_item WHERE task_id IN (${nonActiveTaskIds.map((id) => `'${id}'`).join(',')}) GROUP BY task_id, status`,
            );

            const countMap = new Map<string, { completed: number; failed: number; cloning: number; pending: number }>();
            for (const row of counts) {
                if (!countMap.has(row.task_id)) {
                    countMap.set(row.task_id, { completed: 0, failed: 0, cloning: 0, pending: 0 });
                }
                const entry = countMap.get(row.task_id)!;
                if (row.status === 'CLONED') entry.completed = Number(row.cnt);
                else if (row.status === 'FAILED') entry.failed = Number(row.cnt);
                else if (row.status === 'CLONING') entry.cloning = Number(row.cnt);
                else if (row.status === 'PENDING') entry.pending = Number(row.cnt);
            }

            for (const task of records) {
                const actual = countMap.get(task.taskId);
                if (!actual) continue;
                if (
                    task.completedRepos !== actual.completed ||
                    task.failedRepos !== actual.failed ||
                    task.skippedRepos !== 0
                ) {
                    await this.prisma.cloneTask.update({
                        where: { taskId: task.taskId },
                        data: {
                            completedRepos: actual.completed,
                            failedRepos: actual.failed,
                            skippedRepos: 0,
                        },
                    });
                    (task as any).completedRepos = actual.completed;
                    (task as any).failedRepos = actual.failed;
                    (task as any).skippedRepos = 0;
                }
            }
        }

        return { records, total, size, current: page, pages: Math.ceil(total / size) };
    }

    /**
     * 获取克隆任务详情，包含分页的任务项列表，可按状态筛选
     *
     * @param taskId 任务 ID
     * @param page 页码
     * @param size 每页数量
     * @param status 可选的状态筛选
     * @returns 任务详情及其分页子项，任务不存在时返回 null
     */
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

    /**
     * 分页查询指定任务的任务项列表，可按状态筛选
     *
     * @param taskId 任务 ID
     * @param page 页码
     * @param size 每页数量
     * @param status 可选的状态筛选
     * @returns 任务项分页数据
     */
    async getItemsByTaskId(taskId: string, page: number, size: number, status: string) {
        const where: any = { taskId };
        if (status) where.status = status;
        const [total, records] = await Promise.all([
            this.prisma.cloneTaskItem.count({ where }),
            this.prisma.cloneTaskItem.findMany({ where, orderBy: { createdAt: 'asc' }, skip: (page - 1) * size, take: size }),
        ]);
        return { records, total, size, current: page, pages: Math.ceil(total / size) };
    }

    /**
     * 切换任务的置顶状态
     *
     * @param taskId 任务 ID
     * @returns 是否已置顶
     * @throws 任务不存在时抛出异常
     */
    async togglePin(taskId: string) {
        const task = await this.prisma.cloneTask.findUnique({ where: { taskId } });
        if (!task) throw new Error('任务不存在');
        const newVal = task.pinned === 1 ? 0 : 1;
        await this.prisma.cloneTask.update({ where: { taskId }, data: { pinned: newVal } });
        return newVal === 1;
    }

    /**
     * 根据任务 ID 删除任务及其所有任务项
     *
     * @param taskId 任务 ID
     */
    async deleteTaskByTaskId(taskId: string) {
        await this.prisma.cloneTaskItem.deleteMany({ where: { taskId } });
        await this.prisma.cloneTask.delete({ where: { taskId } });
    }

    /**
     * 检查是否有正在运行或等待中的克隆任务
     *
     * @returns 是否存在活跃任务
     */
    async hasActiveTask() {
        const count = await this.prisma.cloneTask.count({ where: { status: 'RUNNING' } });
        return count > 0;
    }

    /**
     * 查询所有存在失败或跳过项的任务 ID 列表
     *
     * @returns 任务 ID 数组
     */
    async getTaskIdsWithFailedItems(): Promise<string[]> {
        const rows = await this.prisma.cloneTaskItem.findMany({
            where: { status: { in: ['FAILED', 'PENDING'] } },
            select: { taskId: true },
            distinct: ['taskId'],
        });
        return rows.map((r) => r.taskId);
    }

    /**
     * 根据任务 ID 查询单个任务
     *
     * @param taskId 任务 ID
     * @returns 任务对象或 null
     */
    async getTaskByTaskId(taskId: string) {
        return this.prisma.cloneTask.findUnique({ where: { taskId } });
    }

    /**
     * 根据任务 ID 和仓库完整名称查询任务项
     *
     * @param taskId 任务 ID
     * @param fullName 仓库完整名称（如 user/repo）
     * @returns 任务项对象或 null
     */
    async getItemByTaskIdAndFullName(taskId: string, fullName: string) {
        return this.prisma.cloneTaskItem.findFirst({ where: { taskId, fullName } });
    }

    /**
     * 统计指定任务中特定状态的任务项数量
     *
     * @param taskId 任务 ID
     * @param status 任务项状态（CLONED/FAILED/SKIPPED 等）
     * @returns 数量
     */
    async countItemsByTaskIdAndStatus(taskId: string, status: string) {
        return this.prisma.cloneTaskItem.count({ where: { taskId, status } });
    }

    /**
     * 统计特定状态的任务总数
     *
     * @param status 任务状态（PENDING/RUNNING/COMPLETED/FAILED）
     * @returns 数量
     */
    async getTaskCountByStatus(status: string) {
        return this.prisma.cloneTask.count({ where: { status } });
    }

    /**
     * 创建一条新的克隆任务项记录
     *
     * @param item 任务项数据，包含 taskId、fullName、status 和可选的 message
     * @returns 创建后的任务项对象
     */
    async insertItem(item: { taskId: string; fullName: string; status: string; message?: string }) {
        return this.prisma.cloneTaskItem.create({ data: { ...item, createdAt: new Date() } });
    }
}
