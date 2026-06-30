import type * as vscode from 'vscode';

import type { SqlExportTaskLogRepository } from '../../application/export/SqlExportTaskLogRepository';
import type { SqlExportTaskLogEntry } from '../../domain/export/SqlExportTaskLog';

/**
 * 将 SQL 导出任务日志保存到 VS Code 全局状态中。
 */
export class GlobalStateSqlExportTaskLogRepository
	implements SqlExportTaskLogRepository
{
	/**
	 * 定义保存 SQL 导出任务日志使用的全局状态键。
	 */
	private static readonly storageKey = 'ppz-plus.sqlExportTaskLogs';

	/**
	 * 定义保留的最近日志数量。
	 */
	private static readonly maxLogEntries = 100;

	/**
	 * 创建基于全局状态的 SQL 导出任务日志仓储。
	 *
	 * @param globalState VS Code 全局状态存储。
	 */
	public constructor(private readonly globalState: vscode.Memento) {}

	/**
	 * 追加一条 SQL 导出任务日志。
	 *
	 * @param {SqlExportTaskLogEntry} entry 需要保存的 SQL 导出任务日志。
	 */
	public async append(entry: SqlExportTaskLogEntry): Promise<void> {
		const nextEntries = [entry, ...this.readEntries()].slice(
			0,
			GlobalStateSqlExportTaskLogRepository.maxLogEntries
		);

		await this.globalState.update(
			GlobalStateSqlExportTaskLogRepository.storageKey,
			nextEntries
		);
	}

	/**
	 * 列出最近的 SQL 导出任务日志。
	 *
	 * @returns {Promise<readonly SqlExportTaskLogEntry[]>} 最近的 SQL 导出任务日志。
	 */
	public async listRecent(): Promise<readonly SqlExportTaskLogEntry[]> {
		return this.readEntries();
	}

	/**
	 * 从 VS Code 全局状态读取 SQL 导出任务日志。
	 *
	 * @returns {SqlExportTaskLogEntry[]} 已保存的 SQL 导出任务日志。
	 */
	private readEntries(): SqlExportTaskLogEntry[] {
		return this.globalState.get<SqlExportTaskLogEntry[]>(
			GlobalStateSqlExportTaskLogRepository.storageKey,
			[]
		);
	}
}
