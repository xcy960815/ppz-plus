import type { MysqlConnectionConfig } from '../../domain/connections/ConnectionConfig';

/**
 * 描述 MySQL 资源树流程返回的 schema 元数据。
 */
export interface MySqlSchemaMetadata {
	readonly name: string;
}

/**
 * 描述 MySQL 资源树流程返回的表元数据。
 */
export interface MySqlTableMetadata {
	readonly schemaName: string;
	readonly name: string;
}

/**
 * 向应用层提供 MySQL schema 和表元数据。
 */
export interface MySqlMetadataProvider {
	/**
	 * 列出当前 MySQL 连接可见的 schema。
	 *
	 * @param connection MySQL 连接配置。
	 * @returns 可见的 schema 列表。
	 */
	listSchemas(
		connection: MysqlConnectionConfig
	): Promise<readonly MySqlSchemaMetadata[]>;

	/**
	 * 列出选中 MySQL schema 下的表。
	 *
	 * @param connection MySQL 连接配置。
	 * @param schemaName 需要加载表的 schema。
	 * @returns 该 schema 下可见的表。
	 */
	listTables(
		connection: MysqlConnectionConfig,
		schemaName: string
	): Promise<readonly MySqlTableMetadata[]>;
}
