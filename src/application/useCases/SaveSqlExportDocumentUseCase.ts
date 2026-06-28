import type { SqlExportFileWriter } from '../export/SqlExportFileWriter';
import type { SqlExportDocument } from '../../domain/export/SqlExportDocument';
import type { SqlExportFileSaveResult } from '../../domain/export/SqlExportFileSaveResult';

/**
 * 保存 SQL 导出文档到本地文件的应用用例。
 */
export class SaveSqlExportDocumentUseCase {
	/**
	 * 创建 SQL 导出文件保存用例。
	 *
	 * @param sqlExportFileWriter 用于写入 SQL 导出文件的基础设施能力。
	 */
	public constructor(private readonly sqlExportFileWriter: SqlExportFileWriter) {}

	/**
	 * 将 SQL 导出文档保存到指定文件路径。
	 *
	 * @param document 已生成的 SQL 导出文档。
	 * @param filePath 用户选择的目标文件路径。
	 * @returns SQL 导出文件保存结果。
	 */
	public async execute(
		document: SqlExportDocument,
		filePath: string
	): Promise<SqlExportFileSaveResult> {
		const normalizedFilePath = filePath.trim();

		if (normalizedFilePath.length === 0) {
			return {
				success: false,
				errorMessage: 'SQL export file path is required.',
			};
		}

		if (document.content.trim().length === 0) {
			return {
				success: false,
				filePath: normalizedFilePath,
				errorMessage: 'SQL export content is empty.',
			};
		}

		try {
			await this.sqlExportFileWriter.writeText(
				normalizedFilePath,
				document.content
			);

			return {
				success: true,
				filePath: normalizedFilePath,
			};
		} catch (error) {
			return {
				success: false,
				filePath: normalizedFilePath,
				errorMessage: error instanceof Error ? error.message : String(error),
			};
		}
	}
}
