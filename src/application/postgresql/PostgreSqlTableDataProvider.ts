import type { PostgreSqlConnectionConfig } from '../../domain/connections/ConnectionConfig';
import type {
	TableColumnMetadata,
	TableQueryOptions,
	TableRowPage,
} from '../shared/TableDataTypes';

/**
 * 向应用层提供 PostgreSQL 表结构和只读行数据。
 */
export interface PostgreSqlTableDataProvider {
	/**
	 * 列出选中 PostgreSQL 表的字段。
	 *
	 * @param connection PostgreSQL 连接配置。
	 * @param databaseName 表所属的 database。
	 * @param schemaName 表所属的 schema。
	 * @param tableName 需要加载字段的表。
	 * @returns 归一化后的字段元数据。
	 */
	listColumns(
		connection: PostgreSqlConnectionConfig,
		databaseName: string,
		schemaName: string,
		tableName: string
	): Promise<readonly TableColumnMetadata[]>;

	/**
	 * 列出选中 PostgreSQL 表的一页只读行数据。
	 *
	 * @param connection PostgreSQL 连接配置。
	 * @param databaseName 表所属的 database。
	 * @param schemaName 表所属的 schema。
	 * @param tableName 需要加载行数据的表。
	 * @param pageIndex 从 0 开始的页码。
	 * @param pageSize 每页请求的行数。
	 * @param options 排序和过滤等查询选项。
	 * @returns 分页行数据。
	 */
	listRowPage(
		connection: PostgreSqlConnectionConfig,
		databaseName: string,
		schemaName: string,
		tableName: string,
		pageIndex: number,
		pageSize: number,
		options?: TableQueryOptions
	): Promise<TableRowPage>;
}
