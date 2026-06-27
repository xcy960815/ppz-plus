/**
 * 表示 SQL 导出的内容类型。
 */
export type SqlExportKind = 'ddl' | 'dml' | 'both';

/**
 * 描述表级 SQL 导出目标。
 */
export interface SqlExportTableTarget {
	readonly schemaName: string;
	readonly tableName: string;
}

/**
 * 描述 schema 级 SQL 导出目标。
 */
export interface SqlExportSchemaTarget {
	readonly schemaName: string;
}

/**
 * 描述 SQL 导出目标。
 */
export type SqlExportTarget = SqlExportTableTarget | SqlExportSchemaTarget;

/**
 * 描述一次 SQL 导出生成的文档内容。
 */
export interface SqlExportDocument {
	readonly title: string;
	readonly kind: SqlExportKind;
	readonly target: SqlExportTarget;
	readonly content: string;
}
