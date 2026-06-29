import type { PostgreSqlConnectionConfig } from '../../domain/connections/ConnectionConfig';

/**
 * 描述 PostgreSQL 资源树流程返回的 database 元数据。
 */
export interface PostgreSqlDatabaseMetadata {
	readonly name: string;
}

/**
 * 描述 PostgreSQL 资源树流程返回的 schema 元数据。
 */
export interface PostgreSqlSchemaMetadata {
	readonly databaseName: string;
	readonly name: string;
}

/**
 * 描述 PostgreSQL 资源树流程返回的表元数据。
 */
export interface PostgreSqlTableMetadata {
	readonly databaseName: string;
	readonly schemaName: string;
	readonly name: string;
}

/**
 * 向应用层提供 PostgreSQL database、schema 和表元数据。
 */
export interface PostgreSqlMetadataProvider {
	/**
	 * 列出当前 PostgreSQL 连接可见的 database。
	 *
	 * @param connection PostgreSQL 连接配置。
	 * @returns 可见的 database 列表。
	 */
	listDatabases(
		connection: PostgreSqlConnectionConfig
	): Promise<readonly PostgreSqlDatabaseMetadata[]>;

	/**
	 * 列出指定 PostgreSQL database 下的 schema。
	 *
	 * @param connection PostgreSQL 连接配置。
	 * @param databaseName 需要连接并加载 schema 的 database。
	 * @returns 可见的 schema 列表。
	 */
	listSchemas(
		connection: PostgreSqlConnectionConfig,
		databaseName: string
	): Promise<readonly PostgreSqlSchemaMetadata[]>;

	/**
	 * 列出指定 PostgreSQL schema 下的表。
	 *
	 * @param connection PostgreSQL 连接配置。
	 * @param databaseName 需要连接的 database。
	 * @param schemaName 需要加载表的 schema。
	 * @returns 该 schema 下可见的表。
	 */
	listTables(
		connection: PostgreSqlConnectionConfig,
		databaseName: string,
		schemaName: string
	): Promise<readonly PostgreSqlTableMetadata[]>;
}
