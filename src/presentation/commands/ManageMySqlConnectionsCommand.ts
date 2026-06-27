import * as vscode from 'vscode';

import type { DeleteStoredConnectionUseCase } from '../../application/useCases/DeleteStoredConnectionUseCase';
import type { ListStoredConnectionsUseCase } from '../../application/useCases/ListStoredConnectionsUseCase';
import type { SaveConnectionConfigUseCase } from '../../application/useCases/SaveConnectionConfigUseCase';
import type { TestConnectionUseCase } from '../../application/useCases/TestConnectionUseCase';
import type {
	ConnectionInputMode,
	MysqlConnectionConfig,
} from '../../domain/connections/ConnectionConfig';
import type { ExtensionCommand } from './ExtensionCommand';
import { AddMySqlConnectionCommand } from './AddMySqlConnectionCommand';
import type { MySqlConnectionTreeNode } from '../explorer/MySqlConnectionsTreeNode';
import { MySqlConnectionsTreeDataProvider } from '../explorer/MySqlConnectionsTreeDataProvider';

/**
 * 通过操作选择器管理已保存的 MySQL 连接。
 */
export class ManageMySqlConnectionsCommand implements ExtensionCommand {
	/**
	 * 保存 VS Code 命令标识。
	 */
	public static readonly id = 'ppz-plus.manageMySqlConnections';

	/**
	 * 通过命令契约暴露命令标识。
	 */
	public readonly id = ManageMySqlConnectionsCommand.id;

	/**
	 * 创建连接管理命令。
	 *
	 * @param listStoredConnectionsUseCase 用于读取已保存连接的用例。
	 * @param saveConnectionConfigUseCase 用于持久化连接编辑结果的用例。
	 * @param deleteStoredConnectionUseCase 用于删除连接的用例。
	 * @param testConnectionUseCase 用于测试所选连接的用例。
	 */
	public constructor(
		private readonly listStoredConnectionsUseCase: ListStoredConnectionsUseCase,
		private readonly saveConnectionConfigUseCase: SaveConnectionConfigUseCase,
		private readonly deleteStoredConnectionUseCase: DeleteStoredConnectionUseCase,
		private readonly testConnectionUseCase: TestConnectionUseCase,
		private readonly treeDataProvider: MySqlConnectionsTreeDataProvider
	) {}

	/**
	 * 向 VS Code 注册命令。
	 *
	 * @returns 命令注册的可释放句柄。
	 */
	public register(): vscode.Disposable {
		return vscode.commands.registerCommand(
			this.id,
			async (treeNode?: MySqlConnectionTreeNode) => {
				const selectedConnection =
					treeNode?.kind === 'connection'
						? treeNode.connection
						: await this.pickConnection();
				if (!selectedConnection) {
					return;
				}

				const action = await vscode.window.showQuickPick(
					[
						{ label: 'View Details', value: 'details' as const },
						{ label: 'Test Connection', value: 'test' as const },
						{ label: 'Edit Connection', value: 'edit' as const },
						{ label: 'Delete Connection', value: 'delete' as const },
					],
					{
						title: `PPZ Plus: ${selectedConnection.name}`,
						placeHolder: 'Choose an action',
					}
				);
				if (!action) {
					return;
				}

				switch (action.value) {
					case 'details':
						await this.showConnectionDetails(selectedConnection);
						return;
					case 'test':
						await this.testConnection(selectedConnection);
						return;
					case 'edit':
						await this.editConnection(selectedConnection);
						return;
					case 'delete':
						await this.deleteConnection(selectedConnection);
						return;
				}
			}
		);
	}

	/**
	 * 提示用户选择一个已保存连接进行管理。
	 *
	 * @returns 用户选择的连接；未选择时为空。
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
				title: 'PPZ Plus: Manage MySQL Connections',
				placeHolder: 'Choose a stored MySQL connection',
			}
		);

		return selectedConnection?.connection;
	}

	/**
	 * 向用户展示连接摘要。
	 *
	 * @param connection 当前选中的连接。
	 */
	private async showConnectionDetails(
		connection: MysqlConnectionConfig
	): Promise<void> {
		/**
		 * 构建当前选中连接的可读摘要。
		 */
		const message =
			connection.mode === 'parameters'
				? [
						`Name: ${connection.name}`,
						`Mode: parameters`,
						`Host: ${connection.host}`,
						`Port: ${connection.port}`,
						`Username: ${connection.username}`,
						`Database: ${connection.database ?? '(none)'}`,
					].join('\n')
				: [
						`Name: ${connection.name}`,
						`Mode: url`,
						`URL: ${connection.url}`,
					].join('\n');

		await vscode.window.showInformationMessage(message, { modal: true });
	}

	/**
	 * 测试已保存连接并展示结果。
	 *
	 * @param connection 当前选中的连接。
	 */
	private async testConnection(connection: MysqlConnectionConfig): Promise<void> {
		try {
			await this.testConnectionUseCase.execute(connection);
			await vscode.window.showInformationMessage(
				`Successfully reached "${connection.name}" over TCP.`
			);
		} catch (error) {
			await vscode.window.showErrorMessage(
				error instanceof Error ? error.message : String(error)
			);
		}
	}

	/**
	 * 提示用户编辑已保存连接。
	 *
	 * @param connection 当前选中的连接。
	 */
	private async editConnection(connection: MysqlConnectionConfig): Promise<void> {
		const mode = await this.promptForMode(connection.mode);
		if (!mode) {
			return;
		}

		const updatedConnection = await AddMySqlConnectionCommand.collectMySqlConfig(
			mode,
			connection
		);
		if (!updatedConnection) {
			return;
		}

		await this.saveConnectionConfigUseCase.execute(updatedConnection);
		this.treeDataProvider.refresh();
		await vscode.window.showInformationMessage(
			`Updated MySQL connection "${updatedConnection.name}".`
		);
	}

	/**
	 * 确认后删除已保存连接。
	 *
	 * @param connection 当前选中的连接。
	 */
	private async deleteConnection(
		connection: MysqlConnectionConfig
	): Promise<void> {
		const confirmation = await vscode.window.showWarningMessage(
			`Delete MySQL connection "${connection.name}"?`,
			{ modal: true },
			'Delete'
		);
		if (confirmation !== 'Delete') {
			return;
		}

		await this.deleteStoredConnectionUseCase.execute(connection.id);
		this.treeDataProvider.refresh();
		await vscode.window.showInformationMessage(
			`Deleted MySQL connection "${connection.name}".`
		);
	}

	/**
	 * 提示用户选择 MySQL 连接的编辑模式。
	 *
	 * @param currentMode 当前已有的连接模式。
	 * @returns 用户选择的连接模式。
	 */
	private async promptForMode(
		currentMode: ConnectionInputMode
	): Promise<ConnectionInputMode | undefined> {
		const modeChoice = await vscode.window.showQuickPick(
			[
				{
					label: 'Parameter Fields',
					description:
						currentMode === 'parameters' ? 'Current mode' : undefined,
					value: 'parameters' as const,
				},
				{
					label: 'Connection URL',
					description: currentMode === 'url' ? 'Current mode' : undefined,
					value: 'url' as const,
				},
			],
			{
				title: 'PPZ Plus: Edit MySQL Connection',
				placeHolder: 'Choose the input mode to edit',
			}
		);

		return modeChoice?.value;
	}
}
