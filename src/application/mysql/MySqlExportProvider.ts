import type { MysqlConnectionConfig } from '../../domain/connections/ConnectionConfig';
import type {
	SqlExportDocument,
	SqlExportKind,
	SqlExportTableTarget,
} from '../../domain/export/SqlExportDocument';

/**
 * 向应用层提供 MySQL SQL 导出能力。
 */
export interface MySqlExportProvider {
	/**
	 * 导出指定 MySQL 表的 SQL 文档。
	 *
	 * @param connection MySQL 连接配置。
	 * @param target 表级导出目标。
	 * @param kind 导出的 SQL 内容类型。
	 * @returns 生成后的 SQL 导出文档。
	 */
	exportTable(
		connection: MysqlConnectionConfig,
		target: SqlExportTableTarget,
		kind: SqlExportKind
	): Promise<SqlExportDocument>;
}
