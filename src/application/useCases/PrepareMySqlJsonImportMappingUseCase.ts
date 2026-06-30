import type { JsonFileReader } from '../import/JsonFileReader';
import { JsonDocumentParser } from '../import/JsonDocumentParser';
import { ImportColumnMapper } from '../import/ImportColumnMapper';
import type { MySqlTableDataProvider } from '../mysql/MySqlTableDataProvider';
import type { MysqlConnectionConfig } from '../../domain/connections/ConnectionConfig';
import type { JsonTableImportTarget } from '../../domain/import/JsonFileImportResult';
import type { ImportMappingPreparationResult } from '../../domain/import/ImportColumnMapping';

/**
 * 准备 MySQL JSON 导入字段映射配置的应用用例。
 */
export class PrepareMySqlJsonImportMappingUseCase {
	/**
	 * 创建 MySQL JSON 导入字段映射准备用例。
	 *
	 * @param jsonFileReader 用于读取 JSON 文件内容的基础设施能力。
	 * @param jsonDocumentParser 用于解析 JSON 文本的解析器。
	 * @param importColumnMapper 用于生成默认字段映射。
	 * @param mySqlTableDataProvider 用于读取目标表字段信息。
	 */
	public constructor(
		private readonly jsonFileReader: JsonFileReader,
		private readonly jsonDocumentParser: JsonDocumentParser,
		private readonly importColumnMapper: ImportColumnMapper,
		private readonly mySqlTableDataProvider: MySqlTableDataProvider
	) {}

	/**
	 * 解析源字段和目标字段，并生成默认映射。
	 *
	 * @param {MysqlConnectionConfig} connection MySQL 连接配置。
	 * @param {JsonTableImportTarget} target JSON 导入目标表。
	 * @param {string} filePath JSON 文件路径。
	 * @returns {Promise<ImportMappingPreparationResult>} 字段映射配置准备结果。
	 */
	public async execute(
		connection: MysqlConnectionConfig,
		target: JsonTableImportTarget,
		filePath: string
	): Promise<ImportMappingPreparationResult> {
		try {
			const json = this.jsonDocumentParser.parse(
				await this.jsonFileReader.readText(filePath.trim())
			);
			const columns = await this.mySqlTableDataProvider.listColumns(
				connection,
				target.schemaName,
				target.tableName
			);
			const targetFields = columns.map((column) => column.name);

			return {
				success: true,
				sourceFields: json.headers,
				targetFields,
				defaultMappings: this.importColumnMapper.createDefaultMappings(
					json.headers,
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
