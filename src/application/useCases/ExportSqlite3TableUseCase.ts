import type { Sqlite3ConnectionConfig } from '../../domain/connections/ConnectionConfig';
import type {
	SqlExportDocument,
	SqlExportKind,
	SqlExportTableTarget,
} from '../../domain/export/SqlExportDocument';
import type { Sqlite3ExportProvider } from '../sqlite3/Sqlite3ExportProvider';

/**
 * 导出 SQLite3 表 SQL 文档的应用用例。
 */
export class ExportSqlite3TableUseCase {
	/**
	 * 创建 SQLite3 表导出用例。
	 *
	 * @param sqlite3ExportProvider 用于生成 SQLite3 导出 SQL 的提供者。
	 */
	public constructor(
		private readonly sqlite3ExportProvider: Sqlite3ExportProvider
	) {}

	/**
	 * 导出指定 SQLite3 表。
	 *
	 * @param {Sqlite3ConnectionConfig} connection SQLite3 连接配置。
	 * @param {SqlExportTableTarget} target 表级导出目标。
	 * @param {SqlExportKind} kind 导出内容类型。
	 * @returns {Promise<SqlExportDocument>} 生成后的 SQL 导出文档。
	 */
	public async execute(
		connection: Sqlite3ConnectionConfig,
		target: SqlExportTableTarget,
		kind: SqlExportKind
	): Promise<SqlExportDocument> {
		if (target.tableName.trim().length === 0) {
			throw new Error('导出 SQLite3 表需要提供表名。');
		}

		return this.sqlite3ExportProvider.exportTable(connection, target, kind);
	}
}
