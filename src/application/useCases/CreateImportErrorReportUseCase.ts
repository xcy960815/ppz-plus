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
							`- \`${mapping.sourceName}\` -> \`${mapping.targetName ?? '（跳过）'}\``
					)
				: ['- 未提供字段映射。'];

		return {
			language: 'markdown',
			content: [
				'# PPZ Plus 导入错误报告',
				'',
				`- 格式：${input.formatName}`,
				`- 文件：${input.fileName}`,
				`- 目标：${input.targetName}`,
				`- 阶段：${this.formatStage(input.stage)}`,
				`- 创建时间：${new Date().toISOString()}`,
				'',
				'## 错误',
				'',
				'```text',
				input.errorMessage,
				'```',
				'',
				'## 字段映射',
				'',
				...mappingLines,
				'',
			].join('\n'),
		};
	}

	/**
	 * 格式化导入错误阶段。
	 *
	 * @param stage 原始导入错误阶段。
	 * @returns 报告中展示的阶段名称。
	 */
	private formatStage(stage: ImportErrorReportInput['stage']): string {
		if (stage === 'mapping') {
			return '字段映射';
		}

		if (stage === 'preview') {
			return '预览';
		}

		return '执行';
	}
}
