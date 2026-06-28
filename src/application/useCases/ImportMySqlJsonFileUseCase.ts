import type { JsonFileReader } from '../import/JsonFileReader';
import { JsonDocumentParser } from '../import/JsonDocumentParser';
import type {
	MySqlTableImportProvider,
	MySqlTableImportRow,
} from '../mysql/MySqlTableImportProvider';
import type { MySqlTableDataProvider } from '../mysql/MySqlTableDataProvider';
import type { MysqlConnectionConfig } from '../../domain/connections/ConnectionConfig';
import type {
	JsonFileImportResult,
	JsonTableImportTarget,
} from '../../domain/import/JsonFileImportResult';

/**
 * 导入 MySQL JSON 文件的应用用例。
 */
export class ImportMySqlJsonFileUseCase {
	/**
	 * 创建 MySQL JSON 文件导入用例。
	 *
	 * @param jsonFileReader 用于读取 JSON 文件内容的基础设施能力。
	 * @param jsonDocumentParser 用于解析 JSON 文本的解析器。
	 * @param mySqlTableDataProvider 用于读取目标表字段信息。
	 * @param mySqlTableImportProvider 用于执行 MySQL 表级行写入。
	 */
	public constructor(
		private readonly jsonFileReader: JsonFileReader,
		private readonly jsonDocumentParser: JsonDocumentParser,
		private readonly mySqlTableDataProvider: MySqlTableDataProvider,
		private readonly mySqlTableImportProvider: MySqlTableImportProvider
	) {}

	/**
	 * 读取并导入指定 JSON 文件。
	 *
	 * @param connection MySQL 连接配置。
	 * @param target JSON 导入目标表。
	 * @param filePath JSON 文件路径。
	 * @returns JSON 文件导入结果。
	 */
	public async execute(
		connection: MysqlConnectionConfig,
		target: JsonTableImportTarget,
		filePath: string
	): Promise<JsonFileImportResult> {
		const validationError = this.validateInput(target, filePath);
		if (validationError) {
			return validationError;
		}

		try {
			const json = this.jsonDocumentParser.parse(
				await this.jsonFileReader.readText(filePath.trim())
			);
			const columns = await this.mySqlTableDataProvider.listColumns(
				connection,
				target.schemaName,
				target.tableName
			);
			const unknownHeaders = json.headers.filter(
				(header) => !columns.some((column) => column.name === header)
			);

			if (unknownHeaders.length > 0) {
				return {
					success: false,
					durationMs: 0,
					insertedRows: 0,
					errorMessage: `JSON object contains fields that do not exist in the target table: ${unknownHeaders.join(', ')}.`,
				};
			}

			const rows = json.rows.map((row) =>
				Object.fromEntries(
					json.headers.map((header) => [header, row[header] ?? null])
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
	 * 校验 JSON 导入的基础输入。
	 *
	 * @param target JSON 导入目标表。
	 * @param filePath JSON 文件路径。
	 * @returns 输入无效时返回失败结果，否则返回空。
	 */
	private validateInput(
		target: JsonTableImportTarget,
		filePath: string
	): JsonFileImportResult | undefined {
		if (target.schemaName.trim().length === 0) {
			return {
				success: false,
				durationMs: 0,
				insertedRows: 0,
				errorMessage: 'Schema name is required for MySQL JSON import.',
			};
		}

		if (target.tableName.trim().length === 0) {
			return {
				success: false,
				durationMs: 0,
				insertedRows: 0,
				errorMessage: 'Table name is required for MySQL JSON import.',
			};
		}

		if (filePath.trim().length === 0) {
			return {
				success: false,
				durationMs: 0,
				insertedRows: 0,
				errorMessage: 'JSON file path is required.',
			};
		}

		return undefined;
	}
}
