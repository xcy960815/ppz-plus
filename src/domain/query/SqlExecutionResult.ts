/**
 * 表示 SQL 结果集中可安全序列化和渲染的单元格值。
 */
export type SqlExecutionCellValue = string | number | boolean | null;

/**
 * 描述 SQL 查询结果中的字段。
 */
export interface SqlExecutionField {
	readonly name: string;
}

/**
 * 描述单条 SQL 或多语句中的一个 SQL 结果集。
 */
export interface SqlExecutionResultSet {
	readonly isQuery: boolean;
	readonly fields: readonly SqlExecutionField[];
	readonly rows: readonly Record<string, SqlExecutionCellValue>[];
	readonly affectedRows: number | null;
	readonly metadata: readonly SqlExecutionResultMetadataEntry[];
}

/**
 * 描述非查询 SQL 返回的 key/value 执行摘要。
 */
export interface SqlExecutionResultMetadataEntry {
	readonly key: string;
	readonly value: SqlExecutionCellValue;
}

/**
 * 描述一次 SQL 执行的统一结果。
 */
export interface SqlExecutionResult {
	readonly sql: string;
	readonly success: boolean;
	readonly isQuery: boolean;
	readonly fields: readonly SqlExecutionField[];
	readonly rows: readonly Record<string, SqlExecutionCellValue>[];
	readonly affectedRows: number | null;
	readonly durationMs: number;
	readonly resultSets: readonly SqlExecutionResultSet[];
	readonly errorMessage?: string;
}
