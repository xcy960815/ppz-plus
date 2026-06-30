import type { PostgreSqlConnectionConfig } from '../../domain/connections/ConnectionConfig';
import type {
	SqlExportDocument,
	SqlExportKind,
	SqlExportSchemaTarget,
	SqlExportTableTarget,
} from '../../domain/export/SqlExportDocument';

/**
 * 描述 PostgreSQL 表级 SQL 导出目标。
 */
export interface PostgreSqlExportTableTarget extends SqlExportTableTarget {
	readonly databaseName: string;
}

/**
 * 描述 PostgreSQL schema 级 SQL 导出目标。
 */
export interface PostgreSqlExportSchemaTarget extends SqlExportSchemaTarget {
	readonly databaseName: string;
}

/**
 * 描述 PostgreSQL database 级 SQL 导出目标。
 */
export interface PostgreSqlExportDatabaseTarget {
	readonly databaseName: string;
}

/**
 * 向应用层提供 PostgreSQL SQL 导出能力。
 */
export interface PostgreSqlExportProvider {
	/**
	 * 导出指定 PostgreSQL 表的 SQL 文档。
	 *
	 * @param connection PostgreSQL 连接配置。
	 * @param target 表级导出目标。
	 * @param kind 导出的 SQL 内容类型。
	 * @returns 生成后的 SQL 导出文档。
	 */
	exportTable(
		connection: PostgreSqlConnectionConfig,
		target: PostgreSqlExportTableTarget,
		kind: SqlExportKind
	): Promise<SqlExportDocument>;

	/**
	 * 导出指定 PostgreSQL schema 的 SQL 文档。
	 *
	 * @param connection PostgreSQL 连接配置。
	 * @param target schema 级导出目标。
	 * @param kind 导出的 SQL 内容类型。
	 * @returns 生成后的 SQL 导出文档。
	 */
	exportSchema(
		connection: PostgreSqlConnectionConfig,
		target: PostgreSqlExportSchemaTarget,
		kind: SqlExportKind
	): Promise<SqlExportDocument>;

	/**
	 * 导出指定 PostgreSQL database 的 SQL 文档。
	 *
	 * @param connection PostgreSQL 连接配置。
	 * @param target database 级导出目标。
	 * @param kind 导出的 SQL 内容类型。
	 * @returns 生成后的 SQL 导出文档。
	 */
	exportDatabase(
		connection: PostgreSqlConnectionConfig,
		target: PostgreSqlExportDatabaseTarget,
		kind: SqlExportKind
	): Promise<SqlExportDocument>;
}
