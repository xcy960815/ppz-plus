import type { CsvFileReader } from '../import/CsvFileReader';
import { CsvDocumentParser } from '../import/CsvDocumentParser';
import { ImportColumnMapper } from '../import/ImportColumnMapper';
import type {
	MySqlTableImportProvider,
} from '../mysql/MySqlTableImportProvider';
import type { MySqlTableDataProvider } from '../mysql/MySqlTableDataProvider';
import type { MysqlConnectionConfig } from '../../domain/connections/ConnectionConfig';
import type {
	CsvFileImportResult,
	CsvTableImportTarget,
} from '../../domain/import/CsvFileImportResult';
import type { ImportColumnMapping } from '../../domain/import/ImportColumnMapping';
import type { ImportTaskProgressReporter } from '../../domain/import/ImportTaskProgress';
import type { CancellationSignal } from '../../domain/tasks/CancellationSignal';
import {
	isOperationCanceledError,
	throwIfCancellationRequested,
} from '../../domain/tasks/CancellationSignal';

/**
 * 导入 MySQL CSV 文件的应用用例。
 */
export class ImportMySqlCsvFileUseCase {
	/**
	 * 创建 MySQL CSV 文件导入用例。
	 *
	 * @param csvFileReader 用于读取 CSV 文件内容的基础设施能力。
	 * @param csvDocumentParser 用于解析 CSV 文本的解析器。
	 * @param importColumnMapper 用于应用导入字段映射。
	 * @param mySqlTableDataProvider 用于读取目标表字段信息。
	 * @param mySqlTableImportProvider 用于执行 MySQL 表级行写入。
	 */
	public constructor(
		private readonly csvFileReader: CsvFileReader,
		private readonly csvDocumentParser: CsvDocumentParser,
		private readonly importColumnMapper: ImportColumnMapper,
		private readonly mySqlTableDataProvider: MySqlTableDataProvider,
		private readonly mySqlTableImportProvider: MySqlTableImportProvider
	) {}

	/**
	 * 读取并导入指定 CSV 文件。
	 *
	 * @param {MysqlConnectionConfig} connection MySQL 连接配置。
	 * @param {CsvTableImportTarget} target CSV 导入目标表。
	 * @param {string} filePath CSV 文件路径。
	 * @param {readonly ImportColumnMapping[]} mappings 可选的字段映射配置。
	 * @param {ImportTaskProgressReporter} progressReporter 可选的导入进度回调。
	 * @param {CancellationSignal} cancellationSignal 可选的长任务取消信号。
	 * @returns {Promise<CsvFileImportResult>} CSV 文件导入结果。
	 */
	public async execute(
		connection: MysqlConnectionConfig,
		target: CsvTableImportTarget,
		filePath: string,
		mappings?: readonly ImportColumnMapping[],
		progressReporter?: ImportTaskProgressReporter,
		cancellationSignal?: CancellationSignal
	): Promise<CsvFileImportResult> {
		const validationError = this.validateInput(target, filePath);
		if (validationError) {
			return validationError;
		}

		try {
			throwIfCancellationRequested(cancellationSignal);
			const csv = this.csvDocumentParser.parse(
				await this.csvFileReader.readText(filePath.trim())
			);
			throwIfCancellationRequested(cancellationSignal);
			const columns = await this.mySqlTableDataProvider.listColumns(
				connection,
				target.schemaName,
				target.tableName
			);
			throwIfCancellationRequested(cancellationSignal);
			const rows = this.importColumnMapper.mapRows(
				csv.rows,
				csv.headers,
				columns.map((column) => column.name),
				mappings,
				(row, sourceName) => row[sourceName]
			);

			return this.mySqlTableImportProvider.importRows(
				connection,
				target,
				rows,
				progressReporter,
				cancellationSignal
			);
		} catch (error) {
			if (isOperationCanceledError(error)) {
				throw error;
			}

			return {
				success: false,
				durationMs: 0,
				insertedRows: 0,
				errorMessage: error instanceof Error ? error.message : String(error),
			};
		}
	}

	/**
	 * 校验 CSV 导入的基础输入。
	 *
	 * @param {CsvTableImportTarget} target CSV 导入目标表。
	 * @param {string} filePath CSV 文件路径。
	 * @returns {CsvFileImportResult | undefined} 输入无效时返回失败结果，否则返回空。
	 */
	private validateInput(
		target: CsvTableImportTarget,
		filePath: string
	): CsvFileImportResult | undefined {
		if (target.schemaName.trim().length === 0) {
			return {
				success: false,
				durationMs: 0,
				insertedRows: 0,
				errorMessage: 'MySQL CSV 导入需要提供 schema 名称。',
			};
		}

		if (target.tableName.trim().length === 0) {
			return {
				success: false,
				durationMs: 0,
				insertedRows: 0,
				errorMessage: 'MySQL CSV 导入需要提供表名。',
			};
		}

		if (filePath.trim().length === 0) {
			return {
				success: false,
				durationMs: 0,
				insertedRows: 0,
				errorMessage: 'CSV 文件路径不能为空。',
			};
		}

		return undefined;
	}
}
