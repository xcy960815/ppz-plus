import type { SqlExportTaskLogEntry } from '../../domain/export/SqlExportTaskLog';

/**
 * 向应用层提供 SQL 导出任务日志持久化能力。
 */
export interface SqlExportTaskLogRepository {
	/**
	 * 追加一条 SQL 导出任务日志。
	 *
	 * @param {SqlExportTaskLogEntry} entry 需要保存的 SQL 导出任务日志。
	 */
	append(entry: SqlExportTaskLogEntry): Promise<void>;

	/**
	 * 列出最近的 SQL 导出任务日志。
	 *
	 * @returns {Promise<readonly SqlExportTaskLogEntry[]>} 最近的 SQL 导出任务日志。
	 */
	listRecent(): Promise<readonly SqlExportTaskLogEntry[]>;

	/**
	 * 清空所有 SQL 导出任务日志。
	 */
	clear(): Promise<void>;
}
