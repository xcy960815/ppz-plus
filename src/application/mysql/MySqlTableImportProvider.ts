import type {
	MySqlTableInsertValue,
} from './MySqlTableDataProvider';
import type {
	TableImportResult,
	TableImportTarget,
} from '../../domain/import/TableImportResult';
import type { MysqlConnectionConfig } from '../../domain/connections/ConnectionConfig';
import type { ImportTaskProgressReporter } from '../../domain/import/ImportTaskProgress';
import type { CancellationSignal } from '../../domain/tasks/CancellationSignal';

/**
 * 表示准备写入 MySQL 的结构化导入行。
 */
export type MySqlTableImportRow = Readonly<
	Record<string, MySqlTableInsertValue>
>;

/**
 * 向应用层提供 MySQL 表级结构化数据导入能力。
 */
export interface MySqlTableImportProvider {
	/**
	 * 将结构化数据行导入到指定 MySQL 表。
	 *
	 * @param {MysqlConnectionConfig} connection MySQL 连接配置。
	 * @param {TableImportTarget} target 导入目标表。
	 * @param {readonly MySqlTableImportRow[]} rows 准备写入的数据行。
	 * @param {ImportTaskProgressReporter} progressReporter 可选的导入进度回调。
	 * @param {CancellationSignal} cancellationSignal 可选的长任务取消信号。
	 * @returns {Promise<TableImportResult>} 表级导入结果。
	 */
	importRows(
		connection: MysqlConnectionConfig,
		target: TableImportTarget,
		rows: readonly MySqlTableImportRow[],
		progressReporter?: ImportTaskProgressReporter,
		cancellationSignal?: CancellationSignal
	): Promise<TableImportResult>;
}
