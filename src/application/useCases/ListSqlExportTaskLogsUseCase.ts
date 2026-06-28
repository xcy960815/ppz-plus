import type { SqlExportTaskLogRepository } from '../export/SqlExportTaskLogRepository';
import type { SqlExportTaskLogEntry } from '../../domain/export/SqlExportTaskLog';

/**
 * 读取 SQL 导出任务日志的应用用例。
 */
export class ListSqlExportTaskLogsUseCase {
	/**
	 * 创建 SQL 导出任务日志读取用例。
	 *
	 * @param sqlExportTaskLogRepository 用于读取导出任务日志的仓储。
	 */
	public constructor(
		private readonly sqlExportTaskLogRepository: SqlExportTaskLogRepository
	) {}

	/**
	 * 读取最近的 SQL 导出任务日志。
	 *
	 * @returns 最近的 SQL 导出任务日志。
	 */
	public async execute(): Promise<readonly SqlExportTaskLogEntry[]> {
		return this.sqlExportTaskLogRepository.listRecent();
	}
}
