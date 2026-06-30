import type { Sqlite3ConnectionConfig } from '../../domain/connections/ConnectionConfig';

/**
 * 描述 SQLite3 资源树流程返回的表元数据。
 */
export interface Sqlite3TableMetadata {
	readonly name: string;
	readonly type: 'table' | 'view';
}

/**
 * 向应用层提供 SQLite3 表和视图元数据。
 */
export interface Sqlite3MetadataProvider {
	/**
	 * 列出当前 SQLite3 文件中可见的表和视图。
	 *
	 * @param connection SQLite3 连接配置。
	 * @returns 可见的表和视图列表。
	 */
	listTables(
		connection: Sqlite3ConnectionConfig
	): Promise<readonly Sqlite3TableMetadata[]>;
}
