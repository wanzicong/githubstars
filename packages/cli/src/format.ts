/**
 * CLI 输出格式化工具
 */

import chalk from 'chalk';

export function formatTable(headers: string[], rows: string[][]): string {
  const colWidths = headers.map((h, i) => {
    const maxDataWidth = Math.max(...rows.map(r => (r[i] || '').length));
    return Math.max(h.length, maxDataWidth);
  });

  const separator = colWidths.map(w => '─'.repeat(w + 2)).join('┼');
  const headerLine = headers.map((h, i) => ` ${h.padEnd(colWidths[i])} `).join('│');

  const dataLines = rows.map(row =>
    row.map((cell, i) => ` ${(cell || '').padEnd(colWidths[i])} `).join('│')
  );

  return [
    `┌${colWidths.map(w => '─'.repeat(w + 2)).join('┬')}┐`,
    `│${headerLine}│`,
    `├${separator}┤`,
    ...dataLines.map(line => `│${line}│`),
    `└${colWidths.map(w => '─'.repeat(w + 2)).join('┴')}┘`,
  ].join('\n');
}

export function formatKeyValue(key: string, value: string | number | null | undefined): string {
  const displayValue = value === null || value === undefined ? '-' : String(value);
  return `${chalk.cyan(key)}: ${displayValue}`;
}

export function formatStatus(status: string): string {
  switch (status?.toUpperCase()) {
    case 'COMPLETED':
    case '成功':
      return chalk.green(status);
    case 'FAILED':
    case '失败':
      return chalk.red(status);
    case 'PROCESSING':
    case '进行中':
      return chalk.yellow(status);
    case 'PENDING':
    case '待处理':
      return chalk.gray(status);
    case 'PARTIAL':
      return chalk.yellow(status);
    default:
      return status;
  }
}

export function formatProgress(completed: number, total: number): string {
  if (total === 0) return chalk.gray('0%');
  const percent = Math.round((completed / total) * 100);
  const bar = '█'.repeat(Math.floor(percent / 5)) + '░'.repeat(20 - Math.floor(percent / 5));
  return `[${bar}] ${percent}% (${completed}/${total})`;
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function formatDate(date: string | null | undefined): string {
  if (!date) return '-';
  return new Date(date).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatNumber(num: number): string {
  return num.toLocaleString('zh-CN');
}

export function printSuccess(message: string): void {
  console.log(chalk.green('✓ ') + message);
}

export function printError(message: string): void {
  console.error(chalk.red('✗ ') + message);
}

export function printWarning(message: string): void {
  console.log(chalk.yellow('⚠ ') + message);
}

export function printInfo(message: string): void {
  console.log(chalk.blue('ℹ ') + message);
}

export function printHeader(title: string): void {
  console.log('');
  console.log(chalk.bold.underline(title));
  console.log('');
}

export function printJson(data: unknown): void {
  console.log(JSON.stringify(data, (_key, value) =>
    typeof value === 'bigint' ? Number(value) : value
  , 2));
}

export function printCsv(headers: string[], rows: string[][]): void {
  console.log(headers.join(','));
  rows.forEach(row => {
    console.log(row.map(cell => `"${(cell || '').replace(/"/g, '""')}"`).join(','));
  });
}
