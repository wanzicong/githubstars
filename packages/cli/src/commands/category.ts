/**
 * 分类命令处理器
 */

import { api, type Category } from '../api.js';
import {
  formatTable,
  printSuccess,
  printError,
  printInfo,
  printHeader,
  printJson,
} from '../format.js';

function flattenCategories(categories: Category[], level = 0): Array<{ category: Category; level: number }> {
  const result: Array<{ category: Category; level: number }> = [];
  for (const category of categories) {
    result.push({ category, level });
    if (category.children && category.children.length > 0) {
      result.push(...flattenCategories(category.children, level + 1));
    }
  }
  return result;
}

export async function categoryList(format?: string): Promise<void> {
  try {
    const categories = await api.getCategoryTree();

    if (format === 'json') {
      printJson(categories);
      return;
    }

    printHeader('分类列表');

    const flat = flattenCategories(categories);
    const headers = ['ID', '名称', '图标', '描述'];
    const rows = flat.map(({ category, level }) => [
      String(category.id),
      '  '.repeat(level) + (level > 0 ? '└─ ' : '') + category.name,
      category.icon || '-',
      category.description || '-',
    ]);

    console.log(formatTable(headers, rows));
  } catch (error) {
    printError(`获取分类列表失败: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }
}

export async function categoryCreate(options: {
  name: string;
  parentId?: number;
  icon?: string;
  description?: string;
  format?: string;
}): Promise<void> {
  try {
    const result = await api.createCategory({
      name: options.name,
      parentId: options.parentId,
      icon: options.icon,
      description: options.description,
    });

    if (options.format === 'json') {
      printJson(result);
      return;
    }

    if (result.success) {
      printSuccess(result.message || '分类已创建');
    } else {
      printError(result.message || '创建分类失败');
    }
  } catch (error) {
    printError(`创建分类失败: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }
}

export async function categoryUpdate(
  id: number,
  options: {
    name?: string;
    parentId?: number;
    icon?: string;
    description?: string;
    sortOrder?: number;
    format?: string;
  }
): Promise<void> {
  try {
    const result = await api.updateCategory(id, {
      name: options.name,
      parentId: options.parentId,
      icon: options.icon,
      description: options.description,
      sortOrder: options.sortOrder,
    });

    if (options.format === 'json') {
      printJson(result);
      return;
    }

    if (result.success) {
      printSuccess(result.message || '分类已更新');
    } else {
      printError(result.message || '更新分类失败');
    }
  } catch (error) {
    printError(`更新分类失败: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }
}

export async function categoryDelete(id: number, format?: string): Promise<void> {
  try {
    const result = await api.deleteCategory(id);

    if (format === 'json') {
      printJson(result);
      return;
    }

    if (result.success) {
      printSuccess(result.message || '分类已删除');
    } else {
      printError(result.message || '删除分类失败');
    }
  } catch (error) {
    printError(`删除分类失败: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }
}

export async function categoryAddRepos(
  categoryId: number,
  repoIds: number[],
  format?: string
): Promise<void> {
  try {
    const result = await api.addRepoToCategory(categoryId, repoIds);

    if (format === 'json') {
      printJson(result);
      return;
    }

    if (result.success) {
      printSuccess(result.message || '仓库已添加到分类');
    } else {
      printError(result.message || '添加仓库失败');
    }
  } catch (error) {
    printError(`添加仓库到分类失败: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }
}

export async function categoryRemoveRepos(
  categoryId: number,
  repoIds: number[],
  format?: string
): Promise<void> {
  try {
    const result = await api.removeRepoFromCategory(categoryId, repoIds);

    if (format === 'json') {
      printJson(result);
      return;
    }

    if (result.success) {
      printSuccess(result.message || '仓库已从分类移除');
    } else {
      printError(result.message || '移除仓库失败');
    }
  } catch (error) {
    printError(`从分类移除仓库失败: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }
}
