import * as path from 'node:path';

import * as vscode from 'vscode';

import type { ListMySqlSchemasUseCase } from '../../application/useCases/ListMySqlSchemasUseCase';
import type { ListMySqlTablesUseCase } from '../../application/useCases/ListMySqlTablesUseCase';
import type { ListStoredConnectionsUseCase } from '../../application/useCases/ListStoredConnectionsUseCase';
import type { ImportMySqlJsonFileUseCase } from '../../application/useCases/ImportMySqlJsonFileUseCase';
import type { PreviewMySqlJsonFileImportUseCase } from '../../application/useCases/PreviewMySqlJsonFileImportUseCase';
import type { MysqlConnectionConfig } from '../../domain/connections/ConnectionConfig';
import type { JsonTableImportTarget } from '../../domain/import/JsonFileImportResult';
import type { ExtensionCommand } from './ExtensionCommand';
import { confirmImportPreview } from './ImportPreviewConfirmation';
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
	 * @param previewMySqlJsonFileImportUseCase 用于生成 JSON 导入预览的用例。
	 * @param importMySqlJsonFileUseCase 用于执行 JSON 文件导入的用例。
	 */
	public constructor(
		private readonly listStoredConnectionsUseCase: ListStoredConnectionsUseCase,
		private readonly listMySqlSchemasUseCase: ListMySqlSchemasUseCase,
		private readonly listMySqlTablesUseCase: ListMySqlTablesUseCase,
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
					await vscode.window.showInformationMessage('No JSON file selected.');
					return;
				}

				const fileName = path.basename(filePath);
				const targetName = `${selection.target.schemaName}.${selection.target.tableName}`;
				const confirmed = await confirmImportPreview(
					'JSON',
					fileName,
					targetName,
					await this.previewMySqlJsonFileImportUseCase.execute(
						selection.connection,
						selection.target,
						filePath
					)
				);
				if (!confirmed) {
					return;
				}

				await this.importJsonFile(
					selection.connection,
					selection.target,
					filePath
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
				title: 'PPZ Plus: Import MySQL JSON File',
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
					`No schemas were found for "${connection.name}".`
				);
				return undefined;
			}

			const selectedSchema = await vscode.window.showQuickPick(
				schemas.map((schema) => ({
					label: schema.name,
					schemaName: schema.name,
				})),
				{
					title: 'PPZ Plus: Choose MySQL Schema',
					placeHolder: 'Choose a target schema for JSON import',
				}
			);

			if (!selectedSchema) {
				await vscode.window.showInformationMessage('No MySQL schema selected.');
				return undefined;
			}

			return selectedSchema.schemaName;
		} catch (error) {
			await vscode.window.showErrorMessage(
				error instanceof Error ? error.message : String(error)
			);
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
					`No tables were found in "${schemaName}".`
				);
				return undefined;
			}

			const selectedTable = await vscode.window.showQuickPick(
				tables.map((table) => ({
					label: table.name,
					tableName: table.name,
				})),
				{
					title: 'PPZ Plus: Choose MySQL Table',
					placeHolder: 'Choose a target table for JSON import',
				}
			);

			if (!selectedTable) {
				await vscode.window.showInformationMessage('No MySQL table selected.');
				return undefined;
			}

			return selectedTable.tableName;
		} catch (error) {
			await vscode.window.showErrorMessage(
				error instanceof Error ? error.message : String(error)
			);
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
				'JSON files': ['json'],
			},
			title: 'PPZ Plus: Choose JSON File to Import',
		});

		return selectedFiles?.[0]?.fsPath;
	}

	/**
	 * 执行 JSON 文件导入并展示用户可见结果。
	 *
	 * @param connection MySQL 连接配置。
	 * @param target JSON 导入目标表。
	 * @param filePath JSON 文件路径。
	 */
	private async importJsonFile(
		connection: MysqlConnectionConfig,
		target: JsonTableImportTarget,
		filePath: string
	): Promise<void> {
		const fileName = path.basename(filePath);
		const targetName = `${target.schemaName}.${target.tableName}`;
		const result = await this.importMySqlJsonFileUseCase.execute(
			connection,
			target,
			filePath
		);

		if (result.success) {
			await vscode.window.showInformationMessage(
				`Imported ${result.insertedRows} row(s) from "${fileName}" into "${targetName}" in ${result.durationMs} ms.`
			);
			return;
		}

		await vscode.window.showErrorMessage(
			`Failed to import "${fileName}" into "${targetName}": ${
				result.errorMessage ?? 'Unknown error.'
			}`
		);
	}
}
