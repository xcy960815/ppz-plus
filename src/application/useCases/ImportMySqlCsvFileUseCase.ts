import type { CsvFileReader } from '../import/CsvFileReader';
import { CsvDocumentParser } from '../import/CsvDocumentParser';
import type {
	MySqlTableImportProvider,
	MySqlTableImportRow,
} from '../mysql/MySqlTableImportProvider';
import type { MySqlTableDataProvider } from '../mysql/MySqlTableDataProvider';
import type { MysqlConnectionConfig } from '../../domain/connections/ConnectionConfig';
import type {
	CsvFileImportResult,
	CsvTableImportTarget,
} from '../../domain/import/CsvFileImportResult';

/**
 * 导入 MySQL CSV 文件的应用用例。
 */
export class ImportMySqlCsvFileUseCase {
	/**
	 * 创建 MySQL CSV 文件导入用例。
	 *
	 * @param csvFileReader 用于读取 CSV 文件内容的基础设施能力。
	 * @param csvDocumentParser 用于解析 CSV 文本的解析器。
	 * @param mySqlTableDataProvider 用于读取目标表字段信息。
	 * @param mySqlTableImportProvider 用于执行 MySQL 表级行写入。
	 */
	public constructor(
		private readonly csvFileReader: CsvFileReader,
		private readonly csvDocumentParser: CsvDocumentParser,
		private readonly mySqlTableDataProvider: MySqlTableDataProvider,
		private readonly mySqlTableImportProvider: MySqlTableImportProvider
	) {}

	/**
	 * 读取并导入指定 CSV 文件。
	 *
	 * @param connection MySQL 连接配置。
	 * @param target CSV 导入目标表。
	 * @param filePath CSV 文件路径。
	 * @returns CSV 文件导入结果。
	 */
	public async execute(
		connection: MysqlConnectionConfig,
		target: CsvTableImportTarget,
		filePath: string
	): Promise<CsvFileImportResult> {
		const validationError = this.validateInput(target, filePath);
		if (validationError) {
			return validationError;
		}

		try {
			const csv = this.csvDocumentParser.parse(
				await this.csvFileReader.readText(filePath.trim())
			);
			const columns = await this.mySqlTableDataProvider.listColumns(
				connection,
				target.schemaName,
				target.tableName
			);
			const unknownHeaders = csv.headers.filter(
				(header) => !columns.some((column) => column.name === header)
			);

			if (unknownHeaders.length > 0) {
				return {
					success: false,
					durationMs: 0,
					insertedRows: 0,
					errorMessage: `CSV header contains columns that do not exist in the target table: ${unknownHeaders.join(', ')}.`,
				};
			}

			const rows = csv.rows.map((row) =>
				Object.fromEntries(
					csv.headers.map((header) => [header, row[header]])
				)
			) as MySqlTableImportRow[];

			return this.mySqlTableImportProvider.importRows(connection, target, rows);
		} catch (error) {
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
	 * @param target CSV 导入目标表。
	 * @param filePath CSV 文件路径。
	 * @returns 输入无效时返回失败结果，否则返回空。
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
				errorMessage: 'Schema name is required for MySQL CSV import.',
			};
		}

		if (target.tableName.trim().length === 0) {
			return {
				success: false,
				durationMs: 0,
				insertedRows: 0,
				errorMessage: 'Table name is required for MySQL CSV import.',
			};
		}

		if (filePath.trim().length === 0) {
			return {
				success: false,
				durationMs: 0,
				insertedRows: 0,
				errorMessage: 'CSV file path is required.',
			};
		}

		return undefined;
	}
}
