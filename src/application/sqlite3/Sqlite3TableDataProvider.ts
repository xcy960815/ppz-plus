import type { Sqlite3ConnectionConfig } from '../../domain/connections/ConnectionConfig';
import type {
	TableCellValue,
	TableColumnMetadata,
	TableFilterCondition,
	TableFilterConditionValue,
	TableFilterOperator,
	TableQueryOptions,
	TableRowPage,
	TableSortDirection,
	TableSortOptions,
} from '../shared/TableDataTypes';

/**
 * 表示 SQLite3 表数据页中渲染的可序列化单元格值。
 */
export type Sqlite3TableCellValue = TableCellValue;

/**
 * 表示新增单行记录时可写入的字段值。
 */
export type Sqlite3TableInsertValue = Sqlite3TableCellValue;

/**
 * 描述新增单行记录时提交的字段值。
 */
export type Sqlite3TableInsertValues = Readonly<
	Record<string, Sqlite3TableInsertValue>
>;

/**
 * 描述更新单行记录时定位原行的字段值。
 */
export type Sqlite3TableRowIdentityValues = Readonly<
	Record<string, Sqlite3TableCellValue>
>;

/**
 * 描述更新单行记录时提交的新字段值。
 */
export type Sqlite3TableUpdateValues = Readonly<
	Record<string, Sqlite3TableCellValue>
>;

/**
 * 描述 SQLite3 表数据页中可见的字段。
 */
export type Sqlite3TableColumnMetadata = TableColumnMetadata;

/**
 * 描述 SQLite3 表数据排序方向。
 */
export type Sqlite3TableSortDirection = TableSortDirection;

/**
 * 描述 SQLite3 表数据排序条件。
 */
export type Sqlite3TableSortOptions = TableSortOptions;

/**
 * 描述 SQLite3 表数据过滤操作符。
 */
export type Sqlite3TableFilterOperator = TableFilterOperator;

/**
 * 描述 SQLite3 表数据过滤条件值。
 */
export type Sqlite3TableFilterConditionValue = TableFilterConditionValue;

/**
 * 描述 SQLite3 表数据单条字段过滤条件。
 */
export type Sqlite3TableFilterCondition = TableFilterCondition;

/**
 * 描述 SQLite3 表数据页查询选项。
 */
export type Sqlite3TableQueryOptions = TableQueryOptions;

/**
 * 描述 SQLite3 数据流程返回的一页表行。
 */
export type Sqlite3TableRowPage = TableRowPage;

/**
 * 描述 SQLite3 单行新增结果。
 */
export interface Sqlite3TableInsertResult {
	readonly affectedRows: number;
	readonly insertId: string | number | null;
	readonly sql: string;
}

/**
 * 描述 SQLite3 单行更新结果。
 */
export interface Sqlite3TableUpdateResult {
	readonly affectedRows: number;
	readonly sql: string;
}

/**
 * 描述 SQLite3 单行删除结果。
 */
export interface Sqlite3TableDeleteResult {
	readonly affectedRows: number;
	readonly sql: string;
}

/**
 * 向应用层提供 SQLite3 表结构、行数据和单行写入能力。
 */
export interface Sqlite3TableDataProvider {
	/**
	 * 列出选中 SQLite3 表的字段。
	 *
	 * @param {Sqlite3ConnectionConfig} connection SQLite3 连接配置。
	 * @param {string} tableName 需要加载字段的表。
	 * @returns {Promise<readonly Sqlite3TableColumnMetadata[]>} 归一化后的字段元数据。
	 */
	listColumns(
		connection: Sqlite3ConnectionConfig,
		tableName: string
	): Promise<readonly Sqlite3TableColumnMetadata[]>;

	/**
	 * 列出选中 SQLite3 表的一页行数据。
	 *
	 * @param {Sqlite3ConnectionConfig} connection SQLite3 连接配置。
	 * @param {string} tableName 需要加载行数据的表。
	 * @param {number} pageIndex 从 0 开始的页码。
	 * @param {number} pageSize 每页请求的行数。
	 * @param {Sqlite3TableQueryOptions} options 排序和过滤等查询选项。
	 * @returns {Promise<Sqlite3TableRowPage>} 分页行数据。
	 */
	listRowPage(
		connection: Sqlite3ConnectionConfig,
		tableName: string,
		pageIndex: number,
		pageSize: number,
		options?: Sqlite3TableQueryOptions
	): Promise<Sqlite3TableRowPage>;

	/**
	 * 向选中 SQLite3 表新增一条记录。
	 *
	 * @param {Sqlite3ConnectionConfig} connection SQLite3 连接配置。
	 * @param {string} tableName 需要新增记录的表。
	 * @param {Sqlite3TableInsertValues} values 需要显式写入的字段值。
	 * @returns {Promise<Sqlite3TableInsertResult>} 单行新增结果。
	 */
	insertRow(
		connection: Sqlite3ConnectionConfig,
		tableName: string,
		values: Sqlite3TableInsertValues
	): Promise<Sqlite3TableInsertResult>;

	/**
	 * 更新选中 SQLite3 表中的一条记录。
	 *
	 * @param {Sqlite3ConnectionConfig} connection SQLite3 连接配置。
	 * @param {string} tableName 需要更新记录的表。
	 * @param {Sqlite3TableRowIdentityValues} identityValues 用于定位原行的字段值。
	 * @param {Sqlite3TableUpdateValues} values 需要更新的新字段值。
	 * @returns {Promise<Sqlite3TableUpdateResult>} 单行更新结果。
	 */
	updateRow(
		connection: Sqlite3ConnectionConfig,
		tableName: string,
		identityValues: Sqlite3TableRowIdentityValues,
		values: Sqlite3TableUpdateValues
	): Promise<Sqlite3TableUpdateResult>;

	/**
	 * 删除选中 SQLite3 表中的一条记录。
	 *
	 * @param {Sqlite3ConnectionConfig} connection SQLite3 连接配置。
	 * @param {string} tableName 需要删除记录的表。
	 * @param {Sqlite3TableRowIdentityValues} identityValues 用于定位原行的字段值。
	 * @returns {Promise<Sqlite3TableDeleteResult>} 单行删除结果。
	 */
	deleteRow(
		connection: Sqlite3ConnectionConfig,
		tableName: string,
		identityValues: Sqlite3TableRowIdentityValues
	): Promise<Sqlite3TableDeleteResult>;
}
