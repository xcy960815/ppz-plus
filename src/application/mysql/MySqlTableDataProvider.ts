import type { MysqlConnectionConfig } from '../../domain/connections/ConnectionConfig';

/**
 * 表示 MySQL 表数据页中渲染的可序列化单元格值。
 */
export type MySqlTableCellValue = string | number | boolean | null;

/**
 * 描述 MySQL 表数据页中可见的字段。
 */
export interface MySqlTableColumnMetadata {
	readonly name: string;
	readonly dataType: string;
	readonly nullable: boolean;
	readonly isPrimaryKey: boolean;
	readonly extra: string;
}

/**
 * 描述 MySQL 表数据排序方向。
 */
export type MySqlTableSortDirection = 'asc' | 'desc';

/**
 * 描述 MySQL 表数据排序条件。
 */
export interface MySqlTableSortOptions {
	readonly columnName: string;
	readonly direction: MySqlTableSortDirection;
}

/**
 * 描述 MySQL 表数据过滤条件。
 */
export interface MySqlTableFilterOptions {
	readonly keyword: string;
}

/**
 * 描述 MySQL 表数据页查询选项。
 */
export interface MySqlTableQueryOptions {
	readonly sort?: MySqlTableSortOptions;
	readonly filter?: MySqlTableFilterOptions;
}

/**
 * 描述 MySQL 数据流程返回的一页表行。
 */
export interface MySqlTableRowPage {
	readonly pageIndex: number;
	readonly pageSize: number;
	readonly hasNextPage: boolean;
	readonly sql: string;
	readonly rows: readonly Record<string, MySqlTableCellValue>[];
}

/**
 * 向应用层提供只读 MySQL 表结构和行数据。
 */
export interface MySqlTableDataProvider {
	/**
	 * 列出选中 MySQL 表的字段。
	 *
	 * @param connection MySQL 连接配置。
	 * @param schemaName 表所属的 schema。
	 * @param tableName 需要加载字段的表。
	 * @returns 归一化后的字段元数据。
	 */
	listColumns(
		connection: MysqlConnectionConfig,
		schemaName: string,
		tableName: string
	): Promise<readonly MySqlTableColumnMetadata[]>;

	/**
	 * 列出选中 MySQL 表的一页只读行数据。
	 *
	 * @param connection MySQL 连接配置。
	 * @param schemaName 表所属的 schema。
	 * @param tableName 需要加载行数据的表。
	 * @param pageIndex 从 0 开始的页码。
	 * @param pageSize 每页请求的行数。
	 * @param options 排序和过滤等查询选项。
	 * @returns 分页行数据。
	 */
	listRowPage(
		connection: MysqlConnectionConfig,
		schemaName: string,
		tableName: string,
		pageIndex: number,
		pageSize: number,
		options?: MySqlTableQueryOptions
	): Promise<MySqlTableRowPage>;
}
