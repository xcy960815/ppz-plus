import type { MysqlConnectionConfig } from '../../domain/connections/ConnectionConfig';
import type {
	TableCellValue,
	TableColumnMetadata,
	TableFilterCondition,
	TableFilterConditionValue,
	TableFilterOperator,
	TableFilterOptions,
	TableQueryOptions,
	TableRowPage,
	TableSortDirection,
	TableSortOptions,
} from '../shared/TableDataTypes';

/**
 * 表示 MySQL 表数据页中渲染的可序列化单元格值。
 */
export type MySqlTableCellValue = TableCellValue;

/**
 * 表示新增单行记录时可写入的字段值。
 */
export type MySqlTableInsertValue = MySqlTableCellValue;

/**
 * 描述新增单行记录时提交的字段值。
 */
export type MySqlTableInsertValues = Readonly<
	Record<string, MySqlTableInsertValue>
>;

/**
 * 描述更新单行记录时定位原行的字段值。
 */
export type MySqlTableRowIdentityValues = Readonly<
	Record<string, MySqlTableCellValue>
>;

/**
 * 描述更新单行记录时提交的新字段值。
 */
export type MySqlTableUpdateValues = Readonly<
	Record<string, MySqlTableCellValue>
>;

/**
 * 描述 MySQL 表数据页中可见的字段。
 */
export type MySqlTableColumnMetadata = TableColumnMetadata;

/**
 * 描述 MySQL 表数据排序方向。
 */
export type MySqlTableSortDirection = TableSortDirection;

/**
 * 描述 MySQL 表数据排序条件。
 */
export type MySqlTableSortOptions = TableSortOptions;

/**
 * 描述 MySQL 表数据过滤操作符。
 */
export type MySqlTableFilterOperator = TableFilterOperator;

/**
 * 描述 MySQL 表数据过滤条件值。
 */
export type MySqlTableFilterConditionValue = TableFilterConditionValue;

/**
 * 描述 MySQL 表数据单条字段过滤条件。
 */
export type MySqlTableFilterCondition = TableFilterCondition;

/**
 * 描述 MySQL 表数据过滤条件。
 */
export type MySqlTableFilterOptions = TableFilterOptions;

/**
 * 描述 MySQL 表数据页查询选项。
 */
export type MySqlTableQueryOptions = TableQueryOptions;

/**
 * 描述 MySQL 数据流程返回的一页表行。
 */
export type MySqlTableRowPage = TableRowPage;

/**
 * 描述 MySQL 单行新增结果。
 */
export interface MySqlTableInsertResult {
	readonly affectedRows: number;
	readonly insertId: string | number | null;
	readonly sql: string;
}

/**
 * 描述 MySQL 单行更新结果。
 */
export interface MySqlTableUpdateResult {
	readonly affectedRows: number;
	readonly sql: string;
}

/**
 * 描述 MySQL 单行删除结果。
 */
export interface MySqlTableDeleteResult {
	readonly affectedRows: number;
	readonly sql: string;
}

/**
 * 向应用层提供 MySQL 表结构、行数据和单行写入能力。
 */
export interface MySqlTableDataProvider {
	/**
	 * 列出选中 MySQL 表的字段。
	 *
	 * @param {MysqlConnectionConfig} connection MySQL 连接配置。
	 * @param {string} schemaName 表所属的 schema。
	 * @param {string} tableName 需要加载字段的表。
	 * @returns {Promise<readonly MySqlTableColumnMetadata[]>} 归一化后的字段元数据。
	 */
	listColumns(
		connection: MysqlConnectionConfig,
		schemaName: string,
		tableName: string
	): Promise<readonly MySqlTableColumnMetadata[]>;

	/**
	 * 列出选中 MySQL 表的一页只读行数据。
	 *
	 * @param {MysqlConnectionConfig} connection MySQL 连接配置。
	 * @param {string} schemaName 表所属的 schema。
	 * @param {string} tableName 需要加载行数据的表。
	 * @param {number} pageIndex 从 0 开始的页码。
	 * @param {number} pageSize 每页请求的行数。
	 * @param {MySqlTableQueryOptions} options 排序和过滤等查询选项。
	 * @returns {Promise<MySqlTableRowPage>} 分页行数据。
	 */
	listRowPage(
		connection: MysqlConnectionConfig,
		schemaName: string,
		tableName: string,
		pageIndex: number,
		pageSize: number,
		options?: MySqlTableQueryOptions
	): Promise<MySqlTableRowPage>;

	/**
	 * 向选中 MySQL 表新增一条记录。
	 *
	 * @param {MysqlConnectionConfig} connection MySQL 连接配置。
	 * @param {string} schemaName 表所属的 schema。
	 * @param {string} tableName 需要新增记录的表。
	 * @param {MySqlTableInsertValues} values 需要显式写入的字段值，未出现的字段使用数据库默认值。
	 * @returns {Promise<MySqlTableInsertResult>} 单行新增结果。
	 */
	insertRow(
		connection: MysqlConnectionConfig,
		schemaName: string,
		tableName: string,
		values: MySqlTableInsertValues
	): Promise<MySqlTableInsertResult>;

	/**
	 * 更新选中 MySQL 表中的一条记录。
	 *
	 * @param {MysqlConnectionConfig} connection MySQL 连接配置。
	 * @param {string} schemaName 表所属的 schema。
	 * @param {string} tableName 需要更新记录的表。
	 * @param {MySqlTableRowIdentityValues} identityValues 用于定位原行的字段值。
	 * @param {MySqlTableUpdateValues} values 需要更新的新字段值。
	 * @returns {Promise<MySqlTableUpdateResult>} 单行更新结果。
	 */
	updateRow(
		connection: MysqlConnectionConfig,
		schemaName: string,
		tableName: string,
		identityValues: MySqlTableRowIdentityValues,
		values: MySqlTableUpdateValues
	): Promise<MySqlTableUpdateResult>;

	/**
	 * 删除选中 MySQL 表中的一条记录。
	 *
	 * @param {MysqlConnectionConfig} connection MySQL 连接配置。
	 * @param {string} schemaName 表所属的 schema。
	 * @param {string} tableName 需要删除记录的表。
	 * @param {MySqlTableRowIdentityValues} identityValues 用于定位原行的字段值。
	 * @returns {Promise<MySqlTableDeleteResult>} 单行删除结果。
	 */
	deleteRow(
		connection: MysqlConnectionConfig,
		schemaName: string,
		tableName: string,
		identityValues: MySqlTableRowIdentityValues
	): Promise<MySqlTableDeleteResult>;
}
