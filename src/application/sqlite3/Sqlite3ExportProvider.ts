import type { Sqlite3ConnectionConfig } from '../../domain/connections/ConnectionConfig';
import type {
	SqlExportDocument,
	SqlExportKind,
	SqlExportTableTarget,
} from '../../domain/export/SqlExportDocument';

/**
 * 向应用层提供 SQLite3 SQL 导出能力。
 */
export interface Sqlite3ExportProvider {
	/**
	 * 导出指定 SQLite3 表的 SQL 文档。
	 *
	 * @param connection SQLite3 连接配置。
	 * @param target 表级导出目标。
	 * @param kind 导出的 SQL 内容类型。
	 * @returns 生成后的 SQL 导出文档。
	 */
	exportTable(
		connection: Sqlite3ConnectionConfig,
		target: SqlExportTableTarget,
		kind: SqlExportKind
	): Promise<SqlExportDocument>;
}
