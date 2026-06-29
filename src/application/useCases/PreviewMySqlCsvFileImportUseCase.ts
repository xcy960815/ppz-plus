import type { CsvFileReader } from '../import/CsvFileReader';
import { CsvDocumentParser } from '../import/CsvDocumentParser';
import { ImportColumnMapper } from '../import/ImportColumnMapper';
import type { MySqlTableDataProvider } from '../mysql/MySqlTableDataProvider';
import type { MysqlConnectionConfig } from '../../domain/connections/ConnectionConfig';
import type { CsvTableImportTarget } from '../../domain/import/CsvFileImportResult';
import type { ImportColumnMapping } from '../../domain/import/ImportColumnMapping';
import type { ImportPreviewResult } from '../../domain/import/ImportPreviewResult';

/**
 * 生成 MySQL CSV 文件导入预览的应用用例。
 */
export class PreviewMySqlCsvFileImportUseCase {
	/**
	 * 保存导入预览中展示的最大行数。
	 */
	private static readonly previewRowLimit = 5;

	/**
	 * 创建 MySQL CSV 文件导入预览用例。
	 *
	 * @param csvFileReader 用于读取 CSV 文件内容的基础设施能力。
	 * @param csvDocumentParser 用于解析 CSV 文本的解析器。
	 * @param importColumnMapper 用于应用导入字段映射。
	 * @param mySqlTableDataProvider 用于读取目标表字段信息。
	 */
	public constructor(
		private readonly csvFileReader: CsvFileReader,
		private readonly csvDocumentParser: CsvDocumentParser,
		private readonly importColumnMapper: ImportColumnMapper,
		private readonly mySqlTableDataProvider: MySqlTableDataProvider
	) {}

	/**
	 * 读取 CSV 文件并生成导入预览。
	 *
	 * @param connection MySQL 连接配置。
	 * @param target CSV 导入目标表。
	 * @param filePath CSV 文件路径。
	 * @param mappings 可选的字段映射配置。
	 * @returns 导入预览结果。
	 */
	public async execute(
		connection: MysqlConnectionConfig,
		target: CsvTableImportTarget,
		filePath: string,
		mappings?: readonly ImportColumnMapping[]
	): Promise<ImportPreviewResult> {
		try {
			if (filePath.trim().length === 0) {
				return {
					success: false,
					errorMessage: 'CSV 文件路径不能为空。',
				};
			}

			const csv = this.csvDocumentParser.parse(
				await this.csvFileReader.readText(filePath.trim())
			);
			const columns = await this.mySqlTableDataProvider.listColumns(
				connection,
				target.schemaName,
				target.tableName
			);
			const targetFields = columns.map((column) => column.name);
			const headers = this.importColumnMapper.mapHeaders(
				csv.headers,
				targetFields,
				mappings
			);
			const rows = this.importColumnMapper.mapRows(
				csv.rows,
				csv.headers,
				targetFields,
				mappings,
				(row, sourceName) => row[sourceName]
			);

			return {
				success: true,
				totalRows: csv.rows.length,
				headers,
				rows: rows
					.slice(0, PreviewMySqlCsvFileImportUseCase.previewRowLimit)
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
