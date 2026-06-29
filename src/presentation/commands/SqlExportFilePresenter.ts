import * as vscode from 'vscode';

import type { SqlExportDocument } from '../../domain/export/SqlExportDocument';
import type { SqlExportFileSaveResult } from '../../domain/export/SqlExportFileSaveResult';
import { getSqlExportFormat } from '../../domain/export/SqlExportFormat';

/**
 * 提示用户选择 SQL 导出文件保存路径。
 *
 * @param document 已生成的 SQL 导出文档。
 * @returns 用户选择的文件路径；取消时为空。
 */
export async function promptSqlExportFilePath(
	document: SqlExportDocument
): Promise<string | undefined> {
	const format = getSqlExportFormat(document.format);
	const defaultFileName = sanitizeSqlExportFileName(document.title);
	const defaultWorkspaceFolder = vscode.workspace.workspaceFolders?.[0];
	const defaultUri = defaultWorkspaceFolder
		? vscode.Uri.joinPath(defaultWorkspaceFolder.uri, defaultFileName)
		: vscode.Uri.file(defaultFileName);
	const selectedFile = await vscode.window.showSaveDialog({
		defaultUri,
		filters: {
			[format.dialogFilterLabel]: [format.fileExtension],
		},
		saveLabel: '导出',
		title: `PPZ Plus: 导出 ${format.label} 到文件`,
	});

	return selectedFile?.fsPath;
}

/**
 * 清理 SQL 导出默认文件名中的路径敏感字符。
 *
 * @param fileName 原始导出文件名。
 * @returns 可作为本地文件名使用的字符串。
 */
function sanitizeSqlExportFileName(fileName: string): string {
	return fileName.replace(/[\\/:*?"<>|]/g, '_');
}

/**
 * 展示 SQL 导出文件保存结果，并在成功后打开保存的文件。
 *
 * @param result SQL 导出文件保存结果。
 */
export async function presentSqlExportFileSaveResult(
	result: SqlExportFileSaveResult
): Promise<void> {
	if (result.success) {
		const textDocument = await vscode.workspace.openTextDocument(result.filePath);
		await vscode.window.showTextDocument(textDocument, {
			preview: false,
		});
		await vscode.window.showInformationMessage(
			`已导出 SQL 到“${result.filePath}”。`
		);
		return;
	}

	await vscode.window.showErrorMessage(
		`导出 SQL${result.filePath ? ` 到“${result.filePath}”` : ''}失败：${
			result.errorMessage
		}`
	);
}
