import type {
	MySqlTableImportProvider,
	MySqlTableImportRow,
} from '../../application/mysql/MySqlTableImportProvider';
import type {
	TableImportResult,
	TableImportTarget,
} from '../../domain/import/TableImportResult';
import type { MysqlConnectionConfig } from '../../domain/connections/ConnectionConfig';
import type { ImportTaskProgressReporter } from '../../domain/import/ImportTaskProgress';
import type { CancellationSignal } from '../../domain/tasks/CancellationSignal';
import {
	isOperationCanceledError,
	throwIfCancellationRequested,
} from '../../domain/tasks/CancellationSignal';
import { MySqlConnectionAdapter } from './MySqlConnectionAdapter';
import { MySqlRuntimeLoader } from './MySqlRuntimeLoader';

/**
 * 通过 mysql2 promise 驱动执行 MySQL 表级结构化数据导入。
 */
export class Mysql2TableImportProvider implements MySqlTableImportProvider {
	/**
	 * 保存单次批量插入的最大行数，避免生成过长 SQL。
	 */
	private static readonly batchSize = 500;

	/**
	 * 创建基于 mysql2 的表级导入提供者。
	 *
	 * @param mySqlConnectionAdapter 用于归一化连接选项的适配器。
	 * @param mySqlRuntimeLoader 用于延迟解析 mysql2 运行时的加载器。
	 */
	public constructor(
		private readonly mySqlConnectionAdapter: MySqlConnectionAdapter,
		private readonly mySqlRuntimeLoader: MySqlRuntimeLoader
	) {}

	/**
	 * 将结构化数据行批量写入目标 MySQL 表。
	 *
	 * @param connection MySQL 连接配置。
	 * @param target 导入目标表。
	 * @param rows 准备写入的数据行。
	 * @param progressReporter 可选的导入进度回调。
	 * @param cancellationSignal 可选的长任务取消信号。
	 * @returns 表级导入结果。
	 */
	public async importRows(
		connection: MysqlConnectionConfig,
		target: TableImportTarget,
		rows: readonly MySqlTableImportRow[],
		progressReporter?: ImportTaskProgressReporter,
		cancellationSignal?: CancellationSignal
	): Promise<TableImportResult> {
		const startedAt = Date.now();
		let runtimeConnection:
			| {
					query(sql: string, values?: readonly unknown[]): Promise<[unknown, unknown]>;
					end(): Promise<void>;
			  }
			| undefined;

		try {
			if (rows.length === 0) {
				return {
					success: false,
					durationMs: 0,
					insertedRows: 0,
					errorMessage: '导入文件不包含数据行。',
				};
			}

			throwIfCancellationRequested(cancellationSignal);
			this.reportProgress(progressReporter, 0, rows.length);
			const mysql = await this.mySqlRuntimeLoader.loadMySqlPromiseModule();
			runtimeConnection = await mysql.createConnection(
				this.mySqlConnectionAdapter.resolveDriverOptions(connection)
			);
			await runtimeConnection.query('START TRANSACTION');

			let insertedRows = 0;
			for (
				let index = 0;
				index < rows.length;
				index += Mysql2TableImportProvider.batchSize
			) {
				throwIfCancellationRequested(cancellationSignal);
				const chunk = rows.slice(
					index,
					index + Mysql2TableImportProvider.batchSize
				);
				const [result] = await runtimeConnection.query(
					this.createInsertSql(target, chunk),
					this.flattenValues(chunk)
				);
				insertedRows += this.readNumberProperty(result, 'affectedRows');
				this.reportProgress(
					progressReporter,
					Math.min(index + chunk.length, rows.length),
					rows.length
				);
			}

			await runtimeConnection.query('COMMIT');

			return {
				success: true,
				durationMs: Date.now() - startedAt,
				insertedRows,
			};
		} catch (error) {
			if (runtimeConnection) {
				try {
					await runtimeConnection.query('ROLLBACK');
				} catch {
					/**
					 * 导入错误优先，回滚失败不覆盖主要错误。
					 */
				}
			}

			if (isOperationCanceledError(error)) {
				throw error;
			}

			return {
				success: false,
				durationMs: Date.now() - startedAt,
				insertedRows: 0,
				errorMessage: error instanceof Error ? error.message : String(error),
			};
		} finally {
			if (runtimeConnection) {
				try {
					await runtimeConnection.end();
				} catch {
					/**
					 * 导入结果优先，关闭连接失败不覆盖主要结果。
					 */
				}
			}
		}
	}

	/**
	 * 向调用方报告表级导入进度。
	 *
	 * @param progressReporter 可选的导入进度回调。
	 * @param completedRows 已完成的导入行数。
	 * @param totalRows 本次导入总行数。
	 */
	private reportProgress(
		progressReporter: ImportTaskProgressReporter | undefined,
		completedRows: number,
		totalRows: number
	): void {
		if (!progressReporter) {
			return;
		}

		const percentage =
			totalRows === 0 ? 0 : Math.round((completedRows / totalRows) * 100);
		progressReporter({
			completedRows,
			totalRows,
			percentage,
			message: `已导入 ${completedRows}/${totalRows} 行。`,
		});
	}

	/**
	 * 创建批量插入 SQL。
	 *
	 * @param target 导入目标表。
	 * @param rows 当前批次的数据行。
	 * @returns 可执行的批量插入 SQL。
	 */
	private createInsertSql(
		target: TableImportTarget,
		rows: readonly MySqlTableImportRow[]
	): string {
		const columns = Object.keys(rows[0] ?? {});
		if (columns.length === 0) {
			throw new Error('导入需要表头行。');
		}

		const tableSql = this.escapeQualifiedTableName(
			target.schemaName,
			target.tableName
		);
		const columnSql = columns
			.map((columnName) => this.escapeIdentifier(columnName))
			.join(', ');
		const rowPlaceholderSql = `(${columns.map(() => '?').join(', ')})`;
		const valuesSql = rows.map(() => rowPlaceholderSql).join(', ');

		return `INSERT INTO ${tableSql} (${columnSql}) VALUES ${valuesSql}`;
	}

	/**
	 * 将多行结构化数据值展开为 mysql2 参数数组。
	 *
	 * @param rows 当前批次的数据行。
	 * @returns 展平后的参数数组。
	 */
	private flattenValues(rows: readonly MySqlTableImportRow[]): readonly unknown[] {
		const columns = Object.keys(rows[0] ?? {});
		return rows.flatMap((row) => columns.map((columnName) => row[columnName]));
	}

	/**
	 * 从 mysql2 执行结果中读取数字属性。
	 *
	 * @param result mysql2 返回的执行结果。
	 * @param propertyName 需要读取的属性名。
	 * @returns 读取到的数字值，无法识别时返回 0。
	 */
	private readNumberProperty(result: unknown, propertyName: string): number {
		if (!result || typeof result !== 'object') {
			return 0;
		}

		const value = Reflect.get(result, propertyName);
		return typeof value === 'number' ? value : 0;
	}

	/**
	 * 转义 MySQL 标识符以便放入原始 SQL 字符串。
	 *
	 * @param identifier 待转义的标识符。
	 * @returns 转义后的标识符。
	 */
	private escapeIdentifier(identifier: string): string {
		return `\`${identifier.replaceAll('`', '``')}\``;
	}

	/**
	 * 转义完整 schema.table 引用以便用于原始 SQL。
	 *
	 * @param schemaName 表所属的 schema。
	 * @param tableName 选中的表名。
	 * @returns 转义后的完整表名。
	 */
	private escapeQualifiedTableName(
		schemaName: string,
		tableName: string
	): string {
		return `${this.escapeIdentifier(schemaName)}.${this.escapeIdentifier(tableName)}`;
	}
}
