import type { MySqlDriverConnectionInput } from './MySqlConnectionAdapter';

/**
 * mysql2 底层驱动返回的单行数据形状。
 *
 * 与 mysql2 的 RowDataPacket 行为一致（可同时通过 key 和 index 访问），
 * 但定义为自有约束类型，避免直接从包导入依赖。
 */
export type MySqlQueryResultRow = Record<string | number, unknown>;

/**
 * mysql2 字段元数据的最小形状。
 */
export interface MySqlField {
	readonly name: string;
}

/**
 * mysql2 非查询执行结果形状。
 */
export interface MySqlStatementResult {
	readonly affectedRows?: number;
	readonly insertId?: number | string;
	readonly serverStatus?: number;
	readonly warningStatus?: number;
	readonly [key: string | number]: unknown;
}

/**
 * mysql2 查询 rows 返回值。
 *
 * 单语句时返回 RowDataPacket[]；
 * 多语句时返回 (RowDataPacket[] | OkPacket | ResultSetHeader)[]。
 */
export type MySqlQueryRows =
	| readonly MySqlQueryResultRow[]
	| readonly (MySqlQueryResultRow[] | MySqlStatementResult)[];

/**
 * mysql2 字段返回值。
 *
 * 单语句时返回 MySqlField[]；
 * 多语句时返回 (MySqlField[] | undefined)[]。
 */
export type MySqlQueryResultFields =
	| readonly MySqlField[]
	| readonly (readonly MySqlField[] | undefined)[];

/**
 * mysql2 promise Connection 的最小运行时接口。
 */
export interface MySqlRuntimeClient {
	query(
		sql: string,
		values?: readonly unknown[]
	): Promise<[MySqlQueryRows, MySqlQueryResultFields]>;
	end(): Promise<void>;
}

/**
 * mysql2 promise 模块的最小运行时接口。
 */
export interface MySqlRuntimeModule {
	createConnection(
		options: MySqlDriverConnectionInput
	): Promise<MySqlRuntimeClient>;
}
