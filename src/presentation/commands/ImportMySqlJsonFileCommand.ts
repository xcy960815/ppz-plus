import * as path from 'path';

import * as vscode from 'vscode';

import type { ListMySqlSchemasUseCase } from '../../application/useCases/ListMySqlSchemasUseCase';
import type { ListMySqlTablesUseCase } from '../../application/useCases/ListMySqlTablesUseCase';
import type { ListStoredConnectionsUseCase } from '../../application/useCases/ListStoredConnectionsUseCase';
import type { CreateImportErrorReportUseCase } from '../../application/useCases/CreateImportErrorReportUseCase';
import type { ImportMySqlJsonFileUseCase } from '../../application/useCases/ImportMySqlJsonFileUseCase';
import type { PrepareMySqlJsonImportMappingUseCase } from '../../application/useCases/PrepareMySqlJsonImportMappingUseCase';
import type { PreviewMySqlJsonFileImportUseCase } from '../../application/useCases/PreviewMySqlJsonFileImportUseCase';
import type { MysqlConnectionConfig } from '../../domain/connections/ConnectionConfig';
import type { JsonFileImportResult, JsonTableImportTarget } from '../../domain/import/JsonFileImportResult';
import type { ImportColumnMapping } from '../../domain/import/ImportColumnMapping';
import { isOperationCanceledError } from '../../domain/tasks/CancellationSignal';
import type { ExtensionCommand } from './ExtensionCommand';
import { promptImportColumnMapping } from './ImportColumnMappingPrompt';
import { confirmImportPreview } from './ImportPreviewConfirmation';
import { showImportErrorReport } from './ImportErrorReportPresenter';
import { createVsCodeImportTaskProgressReporter } from './ImportTaskProgressPresenter';
import {
	createVsCodeCancellationSignal,
	showTaskCanceledMessage,
} from './TaskCancellationPresenter';
import { showUserErrorMessage } from './UserErrorPresenter';
import type { MySqlConnectionsTreeNode } from '../explorer/MySqlConnectionsTreeNode';

/**
 * 从 VS Code 入口导入 MySQL JSON 文件。
 */
export class ImportMySqlJsonFileCommand implements ExtensionCommand {
	/**
	 * 保存 VS Code 命令标识。
	 */
	public static readonly id = 'ppz-plus.importMySqlJsonFile';

	/**
	 * 通过命令契约暴露命令标识。
	 */
	public readonly id = ImportMySqlJsonFileCommand.id;

	/**
	 * 创建 MySQL JSON 文件导入命令。
	 *
	 * @param listStoredConnectionsUseCase 用于读取已保存 MySQL 连接的用例。
	 * @param listMySqlSchemasUseCase 用于选择目标 schema 的用例。
	 * @param listMySqlTablesUseCase 用于选择目标表的用例。
	 * @param createImportErrorReportUseCase 用于生成导入错误报告。
	 * @param prepareMySqlJsonImportMappingUseCase 用于准备 JSON 字段映射配置。
	 * @param previewMySqlJsonFileImportUseCase 用于生成 JSON 导入预览的用例。
	 * @param importMySqlJsonFileUseCase 用于执行 JSON 文件导入的用例。
	 */
	public constructor(
		private readonly listStoredConnectionsUseCase: ListStoredConnectionsUseCase,
		private readonly listMySqlSchemasUseCase: ListMySqlSchemasUseCase,
		private readonly listMySqlTablesUseCase: ListMySqlTablesUseCase,
		private readonly createImportErrorReportUseCase: CreateImportErrorReportUseCase,
		private readonly prepareMySqlJsonImportMappingUseCase: PrepareMySqlJsonImportMappingUseCase,
		private readonly previewMySqlJsonFileImportUseCase: PreviewMySqlJsonFileImportUseCase,
		private readonly importMySqlJsonFileUseCase: ImportMySqlJsonFileUseCase
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
				const selection = await this.resolveImportSelection(node);
				if (!selection) {
					return;
				}

				const filePath = await this.pickJsonFilePath();
				if (!filePath) {
					await vscode.window.showInformationMessage('未选择 JSON 文件。');
					return;
				}

				const fileName = path.basename(filePath);
				const targetName = `${selection.target.schemaName}.${selection.target.tableName}`;
				const mappings = await promptImportColumnMapping(
					this.createImportErrorReportUseCase,
					'JSON',
					fileName,
					targetName,
					await this.prepareMySqlJsonImportMappingUseCase.execute(
						selection.connection,
						selection.target,
						filePath
					)
				);
				if (!mappings) {
					return;
				}

				const confirmed = await confirmImportPreview(
					this.createImportErrorReportUseCase,
					'JSON',
					fileName,
					targetName,
					await this.previewMySqlJsonFileImportUseCase.execute(
						selection.connection,
						selection.target,
						filePath,
						mappings
					),
					mappings
				);
				if (!confirmed) {
					return;
				}

				await this.importJsonFile(
					selection.connection,
					selection.target,
					filePath,
					mappings
				);
			}
		);
	}

	/**
	 * 解析或提示用户选择 JSON 导入目标。
	 *
	 * @param node 可选的 MySQL Tree 节点。
	 * @returns 完整 JSON 导入选择。
	 */
	private async resolveImportSelection(node?: MySqlConnectionsTreeNode): Promise<
		| {
				readonly connection: MysqlConnectionConfig;
				readonly target: JsonTableImportTarget;
		  }
		| undefined
	> {
		const connection = node?.connection ?? (await this.pickConnection());
		if (!connection) {
			return undefined;
		}

		const schemaName =
			node?.kind === 'schema' || node?.kind === 'table'
				? node.schemaName
				: await this.pickSchema(connection);
		if (!schemaName) {
			return undefined;
		}

		const tableName =
			node?.kind === 'table'
				? node.tableName
				: await this.pickTable(connection, schemaName);
		if (!tableName) {
			return undefined;
		}

		return {
			connection,
			target: {
				schemaName,
				tableName,
			},
		};
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
				title: 'PPZ Plus: 导入 MySQL JSON 文件',
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
	 * 提示用户选择目标 schema。
	 *
	 * @param connection MySQL 连接配置。
	 * @returns 用户选择的 schema 名称；未选择时为空。
	 */
	private async pickSchema(
		connection: MysqlConnectionConfig
	): Promise<string | undefined> {
		try {
			const schemas = await this.listMySqlSchemasUseCase.execute(connection);
			if (schemas.length === 0) {
				await vscode.window.showInformationMessage(
					`连接“${connection.name}”下未找到 schema。`
				);
				return undefined;
			}

			const selectedSchema = await vscode.window.showQuickPick(
				schemas.map((schema) => ({
					label: schema.name,
					schemaName: schema.name,
				})),
				{
					title: 'PPZ Plus: 选择 MySQL Schema',
					placeHolder: '选择 JSON 导入目标 schema',
				}
			);

			if (!selectedSchema) {
				await vscode.window.showInformationMessage('未选择 MySQL schema。');
				return undefined;
			}

			return selectedSchema.schemaName;
		} catch (error) {
			await showUserErrorMessage({
				operation: '加载 JSON 导入的 MySQL schema',
				error,
			});
			return undefined;
		}
	}

	/**
	 * 提示用户选择目标表。
	 *
	 * @param connection MySQL 连接配置。
	 * @param schemaName 已选择的 schema 名称。
	 * @returns 用户选择的表名；未选择时为空。
	 */
	private async pickTable(
		connection: MysqlConnectionConfig,
		schemaName: string
	): Promise<string | undefined> {
		try {
			const tables = await this.listMySqlTablesUseCase.execute(
				connection,
				schemaName
			);
			if (tables.length === 0) {
				await vscode.window.showInformationMessage(
					`schema“${schemaName}”中未找到表。`
				);
				return undefined;
			}

			const selectedTable = await vscode.window.showQuickPick(
				tables.map((table) => ({
					label: table.name,
					tableName: table.name,
				})),
				{
					title: 'PPZ Plus: 选择 MySQL 表',
					placeHolder: '选择 JSON 导入目标表',
				}
			);

			if (!selectedTable) {
				await vscode.window.showInformationMessage('未选择 MySQL 表。');
				return undefined;
			}

			return selectedTable.tableName;
		} catch (error) {
			await showUserErrorMessage({
				operation: '加载 JSON 导入的 MySQL 表',
				error,
			});
			return undefined;
		}
	}

	/**
	 * 提示用户选择一个 JSON 文件。
	 *
	 * @returns 用户选择的 JSON 文件路径；未选择时为空。
	 */
	private async pickJsonFilePath(): Promise<string | undefined> {
		const selectedFiles = await vscode.window.showOpenDialog({
			canSelectFiles: true,
			canSelectFolders: false,
			canSelectMany: false,
			filters: {
				JSON文件: ['json'],
			},
			title: 'PPZ Plus: 选择要导入的 JSON 文件',
		});

		return selectedFiles?.[0]?.fsPath;
	}

	/**
	 * 执行 JSON 文件导入并展示用户可见结果。
	 *
	 * @param connection MySQL 连接配置。
	 * @param target JSON 导入目标表。
	 * @param filePath JSON 文件路径。
	 * @param mappings 字段映射配置。
	 */
	private async importJsonFile(
		connection: MysqlConnectionConfig,
		target: JsonTableImportTarget,
		filePath: string,
		mappings: readonly ImportColumnMapping[]
	): Promise<void> {
		const fileName = path.basename(filePath);
		const targetName = `${target.schemaName}.${target.tableName}`;
		let result:  JsonFileImportResult | undefined;
		try {
			result = await vscode.window.withProgress(
				{
					cancellable: true,
					location: vscode.ProgressLocation.Notification,
					title: `正在导入 JSON“${fileName}”到“${targetName}”`,
				},
				async (progress, token) => {
					progress.report({ message: '正在准备导入...' });

					return this.importMySqlJsonFileUseCase.execute(
						connection,
						target,
						filePath,
						mappings,
						createVsCodeImportTaskProgressReporter(progress),
						createVsCodeCancellationSignal(token)
					);
				}
			);
		} catch (error) {
			if (isOperationCanceledError(error)) {
				await showTaskCanceledMessage('JSON 导入');
				return;
			}

			await showUserErrorMessage({
				operation: '导入 JSON 文件',
				error,
			});
			return;
		}

		if (!result) {
			return;
		}

		if (result.success) {
			await vscode.window.showInformationMessage(
				`已从“${fileName}”导入 ${result.insertedRows} 行到“${targetName}”，耗时 ${result.durationMs} ms。`
			);
			return;
		}

		await showImportErrorReport(this.createImportErrorReportUseCase, {
			formatName: 'JSON',
			fileName,
			targetName,
			stage: 'execution',
			errorMessage: result.errorMessage ?? '未知错误。',
			mappings,
		});
	}
}
