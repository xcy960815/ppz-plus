import * as vscode from 'vscode';

import type { CreateImportErrorReportUseCase } from '../../application/useCases/CreateImportErrorReportUseCase';
import type { ImportColumnMapping } from '../../domain/import/ImportColumnMapping';
import type { ImportErrorStage } from '../../domain/import/ImportErrorReport';

/**
 * 描述导入错误提示和报告所需的输入。
 */
export interface ImportErrorReportPresentationInput {
	readonly formatName: string;
	readonly fileName: string;
	readonly targetName: string;
	readonly stage: ImportErrorStage;
	readonly errorMessage: string;
	readonly mappings?: readonly ImportColumnMapping[];
}

/**
 * 展示导入错误，并允许用户打开详细报告。
 *
 * @param createImportErrorReportUseCase 用于创建错误报告文档的用例。
 * @param input 导入错误展示输入。
 */
export async function showImportErrorReport(
	createImportErrorReportUseCase: CreateImportErrorReportUseCase,
	input: ImportErrorReportPresentationInput
): Promise<void> {
	const action = await vscode.window.showErrorMessage(
		`${input.formatName} 导入在${formatImportStage(
			input.stage
		)}阶段失败：${input.errorMessage}`,
		'打开报告'
	);

	if (action !== '打开报告') {
		return;
	}

	const report = createImportErrorReportUseCase.execute(input);
	const document = await vscode.workspace.openTextDocument({
		content: report.content,
		language: report.language,
	});

	await vscode.window.showTextDocument(document, {
		preview: false,
	});
}

/**
 * 格式化导入错误阶段。
 *
 * @param stage 原始导入错误阶段。
 * @returns 面向用户展示的导入阶段名称。
 */
function formatImportStage(stage: ImportErrorStage): string {
	if (stage === 'mapping') {
		return '字段映射';
	}

	if (stage === 'preview') {
		return '预览';
	}

	return '执行';
}
