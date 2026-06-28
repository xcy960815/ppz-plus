import * as vscode from 'vscode';

import type {
	ImportPreviewCellValue,
	ImportPreviewResult,
	ImportPreviewSuccessResult,
} from '../../domain/import/ImportPreviewResult';

/**
 * 展示导入预览确认弹窗。
 *
 * @param formatName 导入文件格式名称。
 * @param fileName 导入文件名。
 * @param targetName 导入目标表名称。
 * @param preview 导入预览结果。
 * @returns 用户是否确认继续导入。
 */
export async function confirmImportPreview(
	formatName: string,
	fileName: string,
	targetName: string,
	preview: ImportPreviewResult
): Promise<boolean> {
	if (!preview.success) {
		await vscode.window.showErrorMessage(
			`Failed to preview "${fileName}" for "${targetName}": ${preview.errorMessage}`
		);
		return false;
	}

	const action = await vscode.window.showInformationMessage(
		`Import ${preview.totalRows} row(s) from "${fileName}" into "${targetName}"?`,
		{
			modal: true,
			detail: formatPreviewDetail(preview),
		},
		'Import'
	);

	if (action !== 'Import') {
		await vscode.window.showInformationMessage(`${formatName} import canceled.`);
		return false;
	}

	return true;
}

/**
 * 将导入预览格式化为确认弹窗详情。
 *
 * @param preview 成功生成的导入预览。
 * @returns 可展示的预览文本。
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
			? `Showing first ${preview.rows.length} row(s).`
			: '';

	return [
		`Columns: ${preview.headers.join(', ')}`,
		`Rows: ${preview.totalRows}`,
		'Preview:',
		previewRows.join('\n'),
		moreRowsNote,
	]
		.filter((line) => line.length > 0)
		.join('\n');
}

/**
 * 格式化导入预览单元格值。
 *
 * @param value 导入预览单元格值。
 * @returns 适合弹窗展示的短文本。
 */
function formatPreviewValue(value: ImportPreviewCellValue): string {
	if (value === null) {
		return 'NULL';
	}

	const text = String(value);
	return text.length > 80 ? `${text.slice(0, 77)}...` : text;
}
