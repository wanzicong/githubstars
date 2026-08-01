-- DropTable
-- 仓库中文化已从“任务式后端翻译”迁移为“智能体取原文→翻译→回写”模式，
-- translation_task / translation_task_item 两张任务表不再使用，随本次重构删除。
DROP TABLE IF EXISTS `translation_task_item`;
DROP TABLE IF EXISTS `translation_task`;
