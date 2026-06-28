import * as path from 'path';

import * as vscode from 'vscode';

import type { ListStoredConnectionsUseCase } from '../../application/useCases/ListStoredConnectionsUseCase';
import type { CreateImportErrorReportUseCase } from '../../application/useCases/CreateImportErrorReportUseCase';
import type { ImportMySqlSqlFileUseCase } from '../../application/useCases/ImportMySqlSqlFileUseCase';
import type { PreviewMySqlSqlFileImportUseCase } from '../../application/useCases/PreviewMySqlSqlFileImportUseCase';
import type { MysqlConnectionConfig } from '../../domain/connections/ConnectionConfig';
import { isOperationCanceledError } from '../../domain/tasks/CancellationSignal';
import type { ExtensionCommand } from './ExtensionCommand';
import { showImportErrorReport } from './ImportErrorReportPresenter';
import {
	createVsCodeCancellationSignal,
	showTaskCanceledMessage,
} from './TaskCancellationPresenter';
import type { MySqlConnectionsTreeNode } from '../explorer/MySqlConnectionsTreeNode';

/**
 * 从 VS Code 入口导入 MySQL SQL 文件。
 */
export class ImportMySqlSqlFileCommand implements ExtensionCommand {
	/**
	 * 保存 VS Code 命令标识。
	 */
	public static readonly id = 'ppz-plus.importMySqlSqlFile';

	/**
	 * 通过命令契约暴露命令标识。
	 */
	public readonly id = ImportMySqlSqlFileCommand.id;

	/**
	 * 创建 MySQL SQL 文件导入命令。
	 *
	 * @param listStoredConnectionsUseCase 用于读取已保存 MySQL 连接的用例。
	 * @param createImportErrorReportUseCase 用于生成导入错误报告。
	 * @param previewMySqlSqlFileImportUseCase 用于生成 SQL 文件导入预览的用例。
	 * @param importMySqlSqlFileUseCase 用于执行 SQL 文件导入的用例。
	 */
	public constructor(
		private readonly listStoredConnectionsUseCase: ListStoredConnectionsUseCase,
		private readonly createImportErrorReportUseCase: CreateImportErrorReportUseCase,
		private readonly previewMySqlSqlFileImportUseCase: PreviewMySqlSqlFileImportUseCase,
		private readonly importMySqlSqlFileUseCase: ImportMySqlSqlFileUseCase
	) {}

	/**
	 * 向 VS Code 注册命令。
	 *
	 * @returns 命令注册的可释放句柄。
	 */
	public register(): vscode.Disposable {
		return vscode.commands.registerCommand(
			this.id,
			async (node?: MySqlConnectionsTreeNode) => {
				const connection =
					this.resolveInitialConnection(node) ?? (await this.pickConnection());
				if (!connection) {
					return;
				}

				const filePath = await this.pickSqlFilePath();
				if (!filePath) {
					await vscode.window.showInformationMessage('No SQL file selected.');
					return;
				}

				const confirmed = await this.confirmImportPreview(connection, filePath);
				if (!confirmed) {
					return;
				}

				await this.importSqlFile(connection, filePath);
			}
		);
	}

	/**
	 * 从 Tree 节点解析初始 MySQL 连接。
	 *
	 * @param node 可选的 MySQL Tree 节点。
	 * @returns 可直接用于导入的 MySQL 连接。
	 */
	private resolveInitialConnection(
		node?: MySqlConnectionsTreeNode
	): MysqlConnectionConfig | undefined {
		return node?.connection;
	}

	/**
	 * 提示用户选择一个已保存的 MySQL 连接。
	 *
	 * @returns 用户选择的 MySQL 连接；未选择时为空。
	 */
	private async pickConnection(): Promise<MysqlConnectionConfig | undefined> {
		const connections = await this.listStoredConnectionsUseCase.execute();
		if (connections.length === 0) {
			await vscode.window.showInformationMessage(
				'No MySQL connections are stored yet. Use "PPZ Plus: Add MySQL Connection" first.'
			);
			return undefined;
		}

		const selectedConnection = await vscode.window.showQuickPick(
			connections.map((connection) => ({
				label: connection.name,
				description:
					connection.mode === 'parameters'
						? `${connection.host}:${connection.port}`
						: connection.url,
				connection,
			})),
			{
				title: 'PPZ Plus: Import MySQL SQL File',
				placeHolder: 'Choose a stored MySQL connection to import into',
			}
		);

		if (!selectedConnection) {
			await vscode.window.showInformationMessage('No MySQL connection selected.');
			return undefined;
		}

		return selectedConnection.connection;
	}

	/**
	 * 提示用户选择一个 SQL 文件。
	 *
	 * @returns 用户选择的 SQL 文件路径；未选择时为空。
	 */
	private async pickSqlFilePath(): Promise<string | undefined> {
		const selectedFiles = await vscode.window.showOpenDialog({
			canSelectFiles: true,
			canSelectFolders: false,
			canSelectMany: false,
			filters: {
				'SQL files': ['sql'],
			},
			title: 'PPZ Plus: Choose SQL File to Import',
		});

		return selectedFiles?.[0]?.fsPath;
	}

	/**
	 * 生成 SQL 文件导入预览并等待用户确认。
	 *
	 * @param connection MySQL 连接配置。
	 * @param filePath SQL 文件路径。
	 * @returns 用户是否确认继续导入。
	 */
	private async confirmImportPreview(
		connection: MysqlConnectionConfig,
		filePath: string
	): Promise<boolean> {
		const fileName = path.basename(filePath);
		const preview = await this.previewMySqlSqlFileImportUseCase.execute(filePath);

		if (!preview.success) {
			await showImportErrorReport(this.createImportErrorReportUseCase, {
				formatName: 'SQL',
				fileName,
				targetName: connection.name,
				stage: 'preview',
				errorMessage: preview.errorMessage,
			});
			return false;
		}

		const action = await vscode.window.showInformationMessage(
			`Execute SQL file "${fileName}" on "${connection.name}"?`,
			{
				modal: true,
				detail: [
					`Lines: ${preview.totalLines}`,
					preview.totalLines > 20 ? 'Showing first 20 line(s).' : '',
					'Preview:',
					preview.previewText,
				]
					.filter((line) => line.length > 0)
					.join('\n'),
			},
			'Execute'
		);

		if (action !== 'Execute') {
			await vscode.window.showInformationMessage('SQL file import canceled.');
			return false;
		}

		return true;
	}

	/**
	 * 执行 SQL 文件导入并展示用户可见结果。
	 *
	 * @param connection MySQL 连接配置。
	 * @param filePath SQL 文件路径。
	 */
	private async importSqlFile(
		connection: MysqlConnectionConfig,
		filePath: string
	): Promise<void> {
		const fileName = path.basename(filePath);

		try {
			const result = await vscode.window.withProgress(
				{
					cancellable: true,
					location: vscode.ProgressLocation.Notification,
					title: `Importing SQL "${fileName}" into "${connection.name}"`,
				},
				async (progress, token) => {
					progress.report({ message: 'Executing SQL file...' });

					return this.importMySqlSqlFileUseCase.execute(
						connection,
						filePath,
						createVsCodeCancellationSignal(token)
					);
				}
			);

			if (result.success) {
				await vscode.window.showInformationMessage(
					`Imported "${fileName}" into "${connection.name}" in ${result.durationMs} ms.`
				);
				return;
			}

			await showImportErrorReport(this.createImportErrorReportUseCase, {
				formatName: 'SQL',
				fileName,
				targetName: connection.name,
				stage: 'execution',
				errorMessage: result.errorMessage ?? 'Unknown error.',
			});
		} catch (error) {
			if (isOperationCanceledError(error)) {
				await showTaskCanceledMessage('SQL import');
				return;
			}

			await showImportErrorReport(this.createImportErrorReportUseCase, {
				formatName: 'SQL',
				fileName,
				targetName: connection.name,
				stage: 'execution',
				errorMessage: error instanceof Error ? error.message : String(error),
			});
		}
	}
}
