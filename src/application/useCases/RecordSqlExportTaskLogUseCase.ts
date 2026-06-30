import { randomUUID } from 'node:crypto';

import type { SqlExportTaskLogRepository } from '../export/SqlExportTaskLogRepository';
import type {
	SqlExportTaskLogEntry,
	SqlExportTaskLogInput,
} from '../../domain/export/SqlExportTaskLog';

/**
 * 记录 SQL 导出任务日志的应用用例。
 */
export class RecordSqlExportTaskLogUseCase {
	/**
	 * 创建 SQL 导出任务日志记录用例。
	 *
	 * @param sqlExportTaskLogRepository 用于持久化导出任务日志的仓储。
	 */
	public constructor(
		private readonly sqlExportTaskLogRepository: SqlExportTaskLogRepository
	) {}

	/**
	 * 记录一条 SQL 导出任务日志。
	 *
	 * @param {SqlExportTaskLogInput} input 导出任务日志输入。
	 * @returns {Promise<SqlExportTaskLogEntry>} 已保存的导出任务日志。
	 */
	public async execute(
		input: SqlExportTaskLogInput
	): Promise<SqlExportTaskLogEntry> {
		const entry = {
			id: randomUUID(),
			...input,
		};

		await this.sqlExportTaskLogRepository.append(entry);
		return entry;
	}
}
