import * as path from 'path';

import type { MysqlConnectionConfig } from '../../domain/connections/ConnectionConfig';
import type {
	SqlExportBatchFailureItem,
	SqlExportBatchResult,
	SqlExportBatchSuccessItem,
	SqlExportBatchTableTarget,
} from '../../domain/export/SqlExportBatchResult';
import type { SqlExportKind } from '../../domain/export/SqlExportDocument';
import type { SqlExportFormatId } from '../../domain/export/SqlExportFormat';
import {
	getSqlExportFormat,
	SQL_EXPORT_FORMAT,
} from '../../domain/export/SqlExportFormat';
import type { SqlExportTaskProgressReporter } from '../../domain/export/SqlExportTaskProgress';
import type { CancellationSignal } from '../../domain/tasks/CancellationSignal';
import {
	isOperationCanceledError,
	throwIfCancellationRequested,
} from '../../domain/tasks/CancellationSignal';
import type { ExportMySqlTableUseCase } from './ExportMySqlTableUseCase';
import type { SaveSqlExportDocumentUseCase } from './SaveSqlExportDocumentUseCase';

/**
 * 描述 MySQL 多表批量 SQL 导出请求。
 */
export interface ExportMySqlTablesBatchInput {
	/**
	 * 保存需要批量导出的表目标列表。
	 */
	readonly tables: readonly SqlExportBatchTableTarget[];

	/**
	 * 保存本次批量导出的 SQL 内容类型。
	 */
	readonly kind: SqlExportKind;

	/**
	 * 保存批量 SQL 文件输出目录。
	 */
	readonly targetDirectory: string;

	/**
	 * 保存可选的长任务取消信号。
	 */
	readonly cancellationSignal?: CancellationSignal;

	/**
	 * 保存可选的导出任务进度回调。
	 */
	readonly progressReporter?: SqlExportTaskProgressReporter;
}

/**
 * 批量导出 MySQL 多张表的 SQL 文件。
 */
export class ExportMySqlTablesBatchUseCase {
	/**
	 * 创建 MySQL 多表批量导出用例。
	 *
	 * @param exportMySqlTableUseCase 用于复用单表 SQL 文档生成能力。
	 * @param saveSqlExportDocumentUseCase 用于复用 SQL 文件保存能力。
	 */
	public constructor(
		private readonly exportMySqlTableUseCase: ExportMySqlTableUseCase,
		private readonly saveSqlExportDocumentUseCase: SaveSqlExportDocumentUseCase
	) {}

	/**
	 * 执行 MySQL 多表批量导出。
	 *
	 * @param connection MySQL 连接配置。
	 * @param input 批量导出请求。
	 * @returns 批量导出的逐表结果和汇总数据。
	 */
	public async execute(
		connection: MysqlConnectionConfig,
		input: ExportMySqlTablesBatchInput
	): Promise<SqlExportBatchResult> {
		const targetDirectory = input.targetDirectory.trim();
		const tables = this.normalizeTables(input.tables);

		if (targetDirectory.length === 0) {
			throw new Error('SQL 导出需要提供目标目录。');
		}

		if (tables.length === 0) {
			throw new Error('请至少选择一张要导出的 MySQL 表。');
		}

		const successes: SqlExportBatchSuccessItem[] = [];
		const failures: SqlExportBatchFailureItem[] = [];

		this.reportProgress(input.progressReporter, {
			completedItems: 0,
			totalItems: tables.length,
			message: `正在准备导出 ${tables.length} 张 MySQL 表...`,
			percentage: 0,
		});

		for (const [index, table] of tables.entries()) {
			throwIfCancellationRequested(input.cancellationSignal);
			const itemStartedAt = new Date();
			const completedItems = index;
			const targetName = `${table.schemaName}.${table.tableName}`;

			this.reportProgress(input.progressReporter, {
				completedItems,
				totalItems: tables.length,
				message: `正在导出 ${targetName}...`,
				percentage: this.calculatePercentage(completedItems, tables.length),
			});

			try {
				const document = await this.exportMySqlTableUseCase.execute(
					connection,
					table,
					input.kind
				);
				const filePath = this.createTableExportFilePath(
					targetDirectory,
					table,
					input.kind,
					document.format
				);
				const saveResult = await this.saveSqlExportDocumentUseCase.execute(
					document,
					filePath
				);
				const itemEndedAt = new Date();

				if (saveResult.success) {
					successes.push({
						...table,
						filePath: saveResult.filePath,
						startedAt: itemStartedAt.toISOString(),
						endedAt: itemEndedAt.toISOString(),
						durationMs: itemEndedAt.getTime() - itemStartedAt.getTime(),
					});
				} else {
					failures.push({
						...table,
						filePath: saveResult.filePath ?? filePath,
						errorMessage: saveResult.errorMessage,
						startedAt: itemStartedAt.toISOString(),
						endedAt: itemEndedAt.toISOString(),
						durationMs: itemEndedAt.getTime() - itemStartedAt.getTime(),
					});
				}
			} catch (error) {
				if (isOperationCanceledError(error)) {
					throw error;
				}

				const itemEndedAt = new Date();
				failures.push({
					...table,
					filePath: this.createTableExportFilePath(
						targetDirectory,
						table,
						input.kind,
						SQL_EXPORT_FORMAT.id
					),
					errorMessage: error instanceof Error ? error.message : String(error),
					startedAt: itemStartedAt.toISOString(),
					endedAt: itemEndedAt.toISOString(),
					durationMs: itemEndedAt.getTime() - itemStartedAt.getTime(),
				});
			}

			this.reportProgress(input.progressReporter, {
				completedItems: index + 1,
				totalItems: tables.length,
				message: `已导出 ${index + 1}/${tables.length} 张 MySQL 表。`,
				percentage: this.calculatePercentage(index + 1, tables.length),
			});
		}

		this.reportProgress(input.progressReporter, {
			completedItems: tables.length,
			totalItems: tables.length,
			message: 'MySQL 批量导出完成。',
			percentage: 100,
		});

		return {
			kind: input.kind,
			targetDirectory,
			totalCount: tables.length,
			successCount: successes.length,
			failureCount: failures.length,
			successes,
			failures,
		};
	}

	/**
	 * 归一化并校验批量导出的表目标列表。
	 *
	 * @param tables 原始表目标列表。
	 * @returns 去除空白后的表目标列表。
	 */
	private normalizeTables(
		tables: readonly SqlExportBatchTableTarget[]
	): SqlExportBatchTableTarget[] {
		return tables.map((table) => {
			const schemaName = table.schemaName.trim();
			const tableName = table.tableName.trim();

			if (schemaName.length === 0) {
				throw new Error('批量导出 MySQL 表需要提供 schema 名称。');
			}

			if (tableName.length === 0) {
				throw new Error('批量导出 MySQL 表需要提供表名。');
			}

			return {
				schemaName,
				tableName,
			};
		});
	}

	/**
	 * 创建单表批量导出的 SQL 文件路径。
	 *
	 * @param targetDirectory 批量导出的目标目录。
	 * @param table 当前导出的表目标。
	 * @param kind SQL 导出类型。
	 * @param formatId SQL 导出格式标识。
	 * @returns 单表 SQL 文件完整路径。
	 */
	private createTableExportFilePath(
		targetDirectory: string,
		table: SqlExportBatchTableTarget,
		kind: SqlExportKind,
		formatId: SqlExportFormatId
	): string {
		const format = getSqlExportFormat(formatId);
		const schemaName = this.sanitizeFileNameSegment(table.schemaName);
		const tableName = this.sanitizeFileNameSegment(table.tableName);
		const fileName = `${schemaName}.${tableName}.${kind}.${format.fileExtension}`;

		return path.join(targetDirectory, fileName);
	}

	/**
	 * 清理 SQL 导出文件名中的路径敏感字符。
	 *
	 * @param segment 原始文件名片段。
	 * @returns 可安全拼接到本地文件名中的片段。
	 */
	private sanitizeFileNameSegment(segment: string): string {
		const sanitizedSegment = segment.replace(/[\\/:*?"<>|]/g, '_').trim();

		if (sanitizedSegment.length === 0) {
			return 'unnamed';
		}

		return sanitizedSegment;
	}

	/**
	 * 计算长任务完成百分比。
	 *
	 * @param completedItems 已完成对象数量。
	 * @param totalItems 总对象数量。
	 * @returns 限制在 0 到 100 的完成百分比。
	 */
	private calculatePercentage(
		completedItems: number,
		totalItems: number
	): number {
		if (totalItems <= 0) {
			return 100;
		}

		return Math.min(100, Math.max(0, (completedItems / totalItems) * 100));
	}

	/**
	 * 向可选进度回调安全上报进度。
	 *
	 * @param progressReporter 可选的导出进度回调。
	 * @param progress 当前导出任务进度。
	 */
	private reportProgress(
		progressReporter: SqlExportTaskProgressReporter | undefined,
		progress: Parameters<SqlExportTaskProgressReporter>[0]
	): void {
		progressReporter?.(progress);
	}
}
