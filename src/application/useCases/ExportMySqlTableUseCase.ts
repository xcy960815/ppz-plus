import type { MysqlConnectionConfig } from '../../domain/connections/ConnectionConfig';
import type {
	SqlExportDocument,
	SqlExportKind,
	SqlExportTableTarget,
} from '../../domain/export/SqlExportDocument';
import type { MySqlExportProvider } from '../mysql/MySqlExportProvider';

/**
 * 导出 MySQL 表级 SQL 文档的应用用例。
 */
export class ExportMySqlTableUseCase {
	/**
	 * 创建 MySQL 表导出用例。
	 *
	 * @param mySqlExportProvider 用于生成 SQL 导出内容的提供者。
	 */
	public constructor(private readonly mySqlExportProvider: MySqlExportProvider) {}

	/**
	 * 导出指定 MySQL 表的 SQL 内容。
	 *
	 * @param connection MySQL 连接配置。
	 * @param target 表级导出目标。
	 * @param kind 导出的 SQL 内容类型。
	 * @returns 生成后的 SQL 导出文档。
	 */
	public async execute(
		connection: MysqlConnectionConfig,
		target: SqlExportTableTarget,
		kind: SqlExportKind
	): Promise<SqlExportDocument> {
		if (target.schemaName.trim().length === 0) {
			throw new Error('导出 MySQL 表需要提供 schema 名称。');
		}

		if (target.tableName.trim().length === 0) {
			throw new Error('导出 MySQL 表需要提供表名。');
		}

		return this.mySqlExportProvider.exportTable(connection, target, kind);
	}
}
