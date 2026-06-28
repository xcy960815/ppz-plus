/**
 * 描述结构化文件导入的目标表。
 */
export interface TableImportTarget {
	readonly schemaName: string;
	readonly tableName: string;
}

/**
 * 描述结构化文件导入执行后的归一化结果。
 */
export interface TableImportResult {
	readonly success: boolean;
	readonly durationMs: number;
	readonly insertedRows: number;
	readonly errorMessage?: string;
}
