import type { SqlFileReader } from '../import/SqlFileReader';
import type { SqlFileImportPreviewResult } from '../../domain/import/SqlFileImportPreviewResult';

/**
 * 生成 MySQL SQL 文件导入预览的应用用例。
 */
export class PreviewMySqlSqlFileImportUseCase {
	/**
	 * 保存 SQL 文件预览展示的最大行数。
	 */
	private static readonly previewLineLimit = 20;

	/**
	 * 创建 MySQL SQL 文件导入预览用例。
	 *
	 * @param sqlFileReader 用于读取 SQL 文件内容的基础设施能力。
	 */
	public constructor(private readonly sqlFileReader: SqlFileReader) {}

	/**
	 * 读取 SQL 文件并生成导入预览。
	 *
	 * @param filePath SQL 文件路径。
	 * @returns SQL 文件导入预览结果。
	 */
	public async execute(filePath: string): Promise<SqlFileImportPreviewResult> {
		try {
			const normalizedFilePath = filePath.trim();
			if (normalizedFilePath.length === 0) {
				return {
					success: false,
					errorMessage: 'SQL file path is required.',
				};
			}

			const sql = await this.sqlFileReader.readText(normalizedFilePath);
			if (sql.trim().length === 0) {
				return {
					success: false,
					errorMessage: 'SQL file is empty.',
				};
			}

			const lines = sql.split(/\r\n|\r|\n/);
			return {
				success: true,
				totalLines: lines.length,
				previewText: lines
					.slice(0, PreviewMySqlSqlFileImportUseCase.previewLineLimit)
					.join('\n'),
			};
		} catch (error) {
			return {
				success: false,
				errorMessage: error instanceof Error ? error.message : String(error),
			};
		}
	}
}
