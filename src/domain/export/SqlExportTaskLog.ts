import type { SqlExportKind } from './SqlExportDocument';

/**
 * 表示 SQL 导出任务的目标类型。
 */
export type SqlExportTaskTargetType = 'schema' | 'table';

/**
 * 表示 SQL 导出任务的最终状态。
 */
export type SqlExportTaskStatus = 'success' | 'failure';

/**
 * 描述一条 SQL 导出任务日志。
 */
export interface SqlExportTaskLogEntry {
	readonly id: string;
	readonly engine: 'mysql';
	readonly connectionName: string;
	readonly targetType: SqlExportTaskTargetType;
	readonly targetName: string;
	readonly kind: SqlExportKind;
	readonly status: SqlExportTaskStatus;
	readonly startedAt: string;
	readonly endedAt: string;
	readonly durationMs: number;
	readonly filePath?: string;
	readonly errorMessage?: string;
}

/**
 * 描述记录 SQL 导出任务日志时需要的输入。
 */
export type SqlExportTaskLogInput = Omit<SqlExportTaskLogEntry, 'id'>;
