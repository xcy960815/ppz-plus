import type { JsonFileReader } from '../import/JsonFileReader';
import { JsonDocumentParser } from '../import/JsonDocumentParser';
import { ImportColumnMapper } from '../import/ImportColumnMapper';
import type { MySqlTableDataProvider } from '../mysql/MySqlTableDataProvider';
import type { MysqlConnectionConfig } from '../../domain/connections/ConnectionConfig';
import type { JsonTableImportTarget } from '../../domain/import/JsonFileImportResult';
import type { ImportColumnMapping } from '../../domain/import/ImportColumnMapping';
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
	 * @param importColumnMapper 用于应用导入字段映射。
	 * @param mySqlTableDataProvider 用于读取目标表字段信息。
	 */
	public constructor(
		private readonly jsonFileReader: JsonFileReader,
		private readonly jsonDocumentParser: JsonDocumentParser,
		private readonly importColumnMapper: ImportColumnMapper,
		private readonly mySqlTableDataProvider: MySqlTableDataProvider
	) {}

	/**
	 * 读取 JSON 文件并生成导入预览。
	 *
	 * @param connection MySQL 连接配置。
	 * @param target JSON 导入目标表。
	 * @param filePath JSON 文件路径。
	 * @param mappings 可选的字段映射配置。
	 * @returns 导入预览结果。
	 */
	public async execute(
		connection: MysqlConnectionConfig,
		target: JsonTableImportTarget,
		filePath: string,
		mappings?: readonly ImportColumnMapping[]
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
			const targetFields = columns.map((column) => column.name);
			const headers = this.importColumnMapper.mapHeaders(
				json.headers,
				targetFields,
				mappings
			);
			const rows = this.importColumnMapper.mapRows(
				json.rows,
				json.headers,
				targetFields,
				mappings,
				(row, sourceName) => row[sourceName] ?? null
			);

			return {
				success: true,
				totalRows: json.rows.length,
				headers,
				rows: rows
					.slice(0, PreviewMySqlJsonFileImportUseCase.previewRowLimit)
					.map((row) => headers.map((header) => row[header] ?? null)),
			};
		} catch (error) {
			return {
				success: false,
				errorMessage: error instanceof Error ? error.message : String(error),
			};
		}
	}
}
