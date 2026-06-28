import type { CsvFileReader } from '../import/CsvFileReader';
import { CsvDocumentParser } from '../import/CsvDocumentParser';
import { ImportColumnMapper } from '../import/ImportColumnMapper';
import type { MySqlTableDataProvider } from '../mysql/MySqlTableDataProvider';
import type { MysqlConnectionConfig } from '../../domain/connections/ConnectionConfig';
import type { CsvTableImportTarget } from '../../domain/import/CsvFileImportResult';
import type { ImportMappingPreparationResult } from '../../domain/import/ImportColumnMapping';

/**
 * 准备 MySQL CSV 导入字段映射配置的应用用例。
 */
export class PrepareMySqlCsvImportMappingUseCase {
	/**
	 * 创建 MySQL CSV 导入字段映射准备用例。
	 *
	 * @param csvFileReader 用于读取 CSV 文件内容的基础设施能力。
	 * @param csvDocumentParser 用于解析 CSV 文本的解析器。
	 * @param importColumnMapper 用于生成默认字段映射。
	 * @param mySqlTableDataProvider 用于读取目标表字段信息。
	 */
	public constructor(
		private readonly csvFileReader: CsvFileReader,
		private readonly csvDocumentParser: CsvDocumentParser,
		private readonly importColumnMapper: ImportColumnMapper,
		private readonly mySqlTableDataProvider: MySqlTableDataProvider
	) {}

	/**
	 * 解析源字段和目标字段，并生成默认映射。
	 *
	 * @param connection MySQL 连接配置。
	 * @param target CSV 导入目标表。
	 * @param filePath CSV 文件路径。
	 * @returns 字段映射配置准备结果。
	 */
	public async execute(
		connection: MysqlConnectionConfig,
		target: CsvTableImportTarget,
		filePath: string
	): Promise<ImportMappingPreparationResult> {
		try {
			const csv = this.csvDocumentParser.parse(
				await this.csvFileReader.readText(filePath.trim())
			);
			const columns = await this.mySqlTableDataProvider.listColumns(
				connection,
				target.schemaName,
				target.tableName
			);
			const targetFields = columns.map((column) => column.name);

			return {
				success: true,
				sourceFields: csv.headers,
				targetFields,
				defaultMappings: this.importColumnMapper.createDefaultMappings(
					csv.headers,
					targetFields
				),
			};
		} catch (error) {
			return {
				success: false,
				errorMessage: error instanceof Error ? error.message : String(error),
			};
		}
	}
}
