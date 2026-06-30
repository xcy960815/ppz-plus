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
	 * @returns {vscode.Disposable} 命令注册的可释放句柄。
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
					await vscode.window.showInformationMessage('未选择 SQL 文件。');
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
	 * @param {MySqlConnectionsTreeNode} node 可选的 MySQL Tree 节点。
	 * @returns {MysqlConnectionConfig | undefined} 可直接用于导入的 MySQL 连接。
	 */
	private resolveInitialConnection(
		node?: MySqlConnectionsTreeNode
	): MysqlConnectionConfig | undefined {
		return node?.connection.engine === 'mysql' ? node.connection : undefined;
	}

	/**
	 * 提示用户选择一个已保存的 MySQL 连接。
	 *
	 * @returns {Promise<MysqlConnectionConfig | undefined>} 用户选择的 MySQL 连接；未选择时为空。
	 */
	private async pickConnection(): Promise<MysqlConnectionConfig | undefined> {
		const connections = (
			await this.listStoredConnectionsUseCase.execute()
		).filter(
			(connection): connection is MysqlConnectionConfig =>
				connection.engine === 'mysql'
		);
		if (connections.length === 0) {
			await vscode.window.showInformationMessage(
				'暂无已保存的 MySQL 连接，请先使用“PPZ Plus: 新增 MySQL 连接”创建连接。'
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
				title: 'PPZ Plus: 导入 MySQL SQL 文件',
				placeHolder: '选择要导入到的已保存 MySQL 连接',
			}
		);

		if (!selectedConnection) {
			await vscode.window.showInformationMessage('未选择 MySQL 连接。');
			return undefined;
		}

		return selectedConnection.connection;
	}

	/**
	 * 提示用户选择一个 SQL 文件。
	 *
	 * @returns {Promise<string | undefined>} 用户选择的 SQL 文件路径；未选择时为空。
	 */
	private async pickSqlFilePath(): Promise<string | undefined> {
		const selectedFiles = await vscode.window.showOpenDialog({
			canSelectFiles: true,
			canSelectFolders: false,
			canSelectMany: false,
			filters: {
				SQL文件: ['sql'],
			},
			title: 'PPZ Plus: 选择要导入的 SQL 文件',
		});

		return selectedFiles?.[0]?.fsPath;
	}

	/**
	 * 生成 SQL 文件导入预览并等待用户确认。
	 *
	 * @param {MysqlConnectionConfig} connection MySQL 连接配置。
	 * @param {string} filePath SQL 文件路径。
	 * @returns {Promise<boolean>} 用户是否确认继续导入。
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
			`确定在“${connection.name}”上执行 SQL 文件“${fileName}”？`,
			{
				modal: true,
				detail: [
					`行数：${preview.totalLines}`,
					preview.totalLines > 20 ? '仅显示前 20 行。' : '',
					'预览：',
					preview.previewText,
				]
					.filter((line) => line.length > 0)
					.join('\n'),
			},
			'执行'
		);

		if (action !== '执行') {
			await vscode.window.showInformationMessage('已取消 SQL 文件导入。');
			return false;
		}

		return true;
	}

	/**
	 * 执行 SQL 文件导入并展示用户可见结果。
	 *
	 * @param {MysqlConnectionConfig} connection MySQL 连接配置。
	 * @param {string} filePath SQL 文件路径。
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
					title: `正在导入 SQL“${fileName}”到“${connection.name}”`,
				},
				async (progress, token) => {
					progress.report({ message: '正在执行 SQL 文件...' });

					return this.importMySqlSqlFileUseCase.execute(
						connection,
						filePath,
						createVsCodeCancellationSignal(token)
					);
				}
			);

			if (result.success) {
				await vscode.window.showInformationMessage(
					`已导入“${fileName}”到“${connection.name}”，耗时 ${result.durationMs} ms。`
				);
				return;
			}

			await showImportErrorReport(this.createImportErrorReportUseCase, {
				formatName: 'SQL',
				fileName,
				targetName: connection.name,
				stage: 'execution',
				errorMessage: result.errorMessage ?? '未知错误。',
			});
		} catch (error) {
			if (isOperationCanceledError(error)) {
				await showTaskCanceledMessage('SQL 导入');
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
