import type { QueryResult } from 'pg';

/**
 * pg 驱动单行数据的形状。
 *
 * pg 的 QueryResultRow 是 `{ [column: string]: any }`,
 * 这里显式收窄为 `unknown` 值访问, 调用方通过 normalize 方法做类型收窄。
 */
export type PgQueryResultRow = Record<string, unknown>;

/**
 * pg Client 查询的最小返回形状。
 */
export type PgQueryResult = QueryResult;

/**
 * pg Client 的最小运行时接口。
 *
 * `query` 的泛型参数收窄了 `@types/pg` 的默认 any 行类型，
 * 让调用方在 `.rows` 上自动获得 `Record<string, unknown>` 推断。
 */
export interface PgRuntimeClient {
	connect(): Promise<void>;
	end(): Promise<void>;
	query<R extends Record<string, unknown> = Record<string, unknown>>(
		sql: string,
		values?: readonly unknown[]
	): Promise<QueryResult<R>>;
}

/**
 * pg 模块的最小运行时接口。
 */
export interface PgRuntimeModule {
	readonly Client: new (
		options: unknown
	) => PgRuntimeClient;
}
