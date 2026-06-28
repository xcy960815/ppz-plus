import type { JsonFileReader } from '../import/JsonFileReader';
import { JsonDocumentParser } from '../import/JsonDocumentParser';
import type { MySqlTableDataProvider } from '../mysql/MySqlTableDataProvider';
import type { MysqlConnectionConfig } from '../../domain/connections/ConnectionConfig';
import type { JsonTableImportTarget } from '../../domain/import/JsonFileImportResult';
import type { ImportPreviewResult } from '../../domain/import/ImportPreviewResult';

/**
 * 生成 MySQL JSON 文件导入预览的应用用例。
 */
export class PreviewMySqlJsonFileImportUseCase {
	/**
	 * 保存导入预览中展示的最大行数。
	 */
	private static readonly previewRowLimit = 5;

	/**
	 * 创建 MySQL JSON 文件导入预览用例。
	 *
	 * @param jsonFileReader 用于读取 JSON 文件内容的基础设施能力。
	 * @param jsonDocumentParser 用于解析 JSON 文本的解析器。
	 * @param mySqlTableDataProvider 用于读取目标表字段信息。
	 */
	public constructor(
		private readonly jsonFileReader: JsonFileReader,
		private readonly jsonDocumentParser: JsonDocumentParser,
		private readonly mySqlTableDataProvider: MySqlTableDataProvider
	) {}

	/**
	 * 读取 JSON 文件并生成导入预览。
	 *
	 * @param connection MySQL 连接配置。
	 * @param target JSON 导入目标表。
	 * @param filePath JSON 文件路径。
	 * @returns 导入预览结果。
	 */
	public async execute(
		connection: MysqlConnectionConfig,
		target: JsonTableImportTarget,
		filePath: string
	): Promise<ImportPreviewResult> {
		try {
			if (filePath.trim().length === 0) {
				return {
					success: false,
					errorMessage: 'JSON file path is required.',
				};
			}

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
					errorMessage: `JSON object contains fields that do not exist in the target table: ${unknownHeaders.join(', ')}.`,
				};
			}

			return {
				success: true,
				totalRows: json.rows.length,
				headers: json.headers,
				rows: json.rows
					.slice(0, PreviewMySqlJsonFileImportUseCase.previewRowLimit)
					.map((row) => json.headers.map((header) => row[header] ?? null)),
			};
		} catch (error) {
			return {
				success: false,
				errorMessage: error instanceof Error ? error.message : String(error),
			};
		}
	}
}
