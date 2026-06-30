import * as vscode from 'vscode';

import type { CreateImportErrorReportUseCase } from '../../application/useCases/CreateImportErrorReportUseCase';
import type { ImportColumnMapping } from '../../domain/import/ImportColumnMapping';
import type {
	ImportPreviewCellValue,
	ImportPreviewResult,
	ImportPreviewSuccessResult,
} from '../../domain/import/ImportPreviewResult';
import { showImportErrorReport } from './ImportErrorReportPresenter';

/**
 * 展示导入预览确认弹窗。
 *
 * @param {CreateImportErrorReportUseCase} createImportErrorReportUseCase 用于创建错误报告文档的用例。
 * @param {string} formatName 导入文件格式名称。
 * @param {string} fileName 导入文件名。
 * @param {string} targetName 导入目标表名称。
 * @param {ImportPreviewResult} preview 导入预览结果。
 * @param {readonly ImportColumnMapping[]} mappings 可选的字段映射配置。
 * @returns {Promise<boolean>} 用户是否确认继续导入。
 */
export async function confirmImportPreview(
	createImportErrorReportUseCase: CreateImportErrorReportUseCase,
	formatName: string,
	fileName: string,
	targetName: string,
	preview: ImportPreviewResult,
	mappings?: readonly ImportColumnMapping[]
): Promise<boolean> {
	if (!preview.success) {
		await showImportErrorReport(createImportErrorReportUseCase, {
			formatName,
			fileName,
			targetName,
			stage: 'preview',
			errorMessage: preview.errorMessage,
			mappings,
		});
		return false;
	}

	const action = await vscode.window.showInformationMessage(
		`确定从“${fileName}”导入 ${preview.totalRows} 行到“${targetName}”？`,
		{
			modal: true,
			detail: formatPreviewDetail(preview),
		},
		'导入'
	);

	if (action !== '导入') {
		await vscode.window.showInformationMessage(`已取消 ${formatName} 导入。`);
		return false;
	}

	return true;
}

/**
 * 将导入预览格式化为确认弹窗详情。
 *
 * @param {ImportPreviewSuccessResult} preview 成功生成的导入预览。
 * @returns {string} 可展示的预览文本。
 */
function formatPreviewDetail(preview: ImportPreviewSuccessResult): string {
	const previewRows = preview.rows.map((row, rowIndex) => {
		const values = preview.headers
			.map((header, columnIndex) => {
				const value = formatPreviewValue(row[columnIndex] ?? null);
				return `${header}=${value}`;
			})
			.join(', ');

		return `${rowIndex + 1}. ${values}`;
	});
	const moreRowsNote =
		preview.totalRows > preview.rows.length
			? `仅显示前 ${preview.rows.length} 行。`
			: '';

	return [
		`字段：${preview.headers.join(', ')}`,
		`行数：${preview.totalRows}`,
		'预览：',
		previewRows.join('\n'),
		moreRowsNote,
	]
		.filter((line) => line.length > 0)
		.join('\n');
}

/**
 * 格式化导入预览单元格值。
 *
 * @param {ImportPreviewCellValue} value 导入预览单元格值。
 * @returns {string} 适合弹窗展示的短文本。
 */
function formatPreviewValue(value: ImportPreviewCellValue): string {
	if (value === null) {
		return 'NULL';
	}

	const text = String(value);
	return text.length > 80 ? `${text.slice(0, 77)}...` : text;
}
