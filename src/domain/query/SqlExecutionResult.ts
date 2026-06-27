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
	readonly errorMessage?: string;
}
