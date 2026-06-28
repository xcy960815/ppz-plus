import type {
	ImportErrorReportDocument,
	ImportErrorReportInput,
} from '../../domain/import/ImportErrorReport';

/**
 * 创建导入错误报告文档的应用用例。
 */
export class CreateImportErrorReportUseCase {
	/**
	 * 根据导入错误信息生成 Markdown 报告。
	 *
	 * @param input 导入错误报告输入。
	 * @returns 可展示的导入错误报告文档。
	 */
	public execute(input: ImportErrorReportInput): ImportErrorReportDocument {
		const mappingLines =
			input.mappings && input.mappings.length > 0
				? input.mappings.map(
						(mapping) =>
							`- \`${mapping.sourceName}\` -> \`${mapping.targetName ?? '(skip)'}\``
					)
				: ['- No column mapping was provided.'];

		return {
			language: 'markdown',
			content: [
				'# PPZ Plus Import Error Report',
				'',
				`- Format: ${input.formatName}`,
				`- File: ${input.fileName}`,
				`- Target: ${input.targetName}`,
				`- Stage: ${input.stage}`,
				`- Created At: ${new Date().toISOString()}`,
				'',
				'## Error',
				'',
				'```text',
				input.errorMessage,
				'```',
				'',
				'## Column Mapping',
				'',
				...mappingLines,
				'',
			].join('\n'),
		};
	}
}
