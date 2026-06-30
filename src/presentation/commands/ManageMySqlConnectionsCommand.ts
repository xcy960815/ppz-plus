import * as vscode from 'vscode';

import type { DeleteStoredConnectionUseCase } from '../../application/useCases/DeleteStoredConnectionUseCase';
import type { ListStoredConnectionsUseCase } from '../../application/useCases/ListStoredConnectionsUseCase';
import type { SaveConnectionConfigUseCase } from '../../application/useCases/SaveConnectionConfigUseCase';
import type { TestConnectionUseCase } from '../../application/useCases/TestConnectionUseCase';
import {
	describeConnectionEngine,
	withConnectionTestProgress,
} from './MySqlConnectionProgressPresenter';
import { showUserErrorMessage } from './UserErrorPresenter';
import type {
	ConnectionInputMode,
	ConnectionConfig,
	MysqlConnectionConfig,
	PostgreSqlConnectionConfig,
	Sqlite3ConnectionConfig,
} from '../../domain/connections/ConnectionConfig';
import type { ExtensionCommand } from './ExtensionCommand';
import { AddMySqlConnectionCommand } from './AddMySqlConnectionCommand';
import { AddSqlite3ConnectionCommand } from './AddSqlite3ConnectionCommand';
import type { MySqlConnectionTreeNode } from '../explorer/MySqlConnectionsTreeNode';
import { MySqlConnectionsTreeDataProvider } from '../explorer/MySqlConnectionsTreeDataProvider';
import { Sqlite3ConnectionsTreeDataProvider } from '../explorer/Sqlite3ConnectionsTreeDataProvider';

/**
 * 通过操作选择器管理已保存的数据库连接。
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
	 * @param treeDataProvider 用于刷新混合数据库连接树。
	 * @param sqlite3TreeDataProvider 用于刷新 SQLite3 连接树。
	 */
	public constructor(
		private readonly listStoredConnectionsUseCase: ListStoredConnectionsUseCase,
		private readonly saveConnectionConfigUseCase: SaveConnectionConfigUseCase,
		private readonly deleteStoredConnectionUseCase: DeleteStoredConnectionUseCase,
		private readonly testConnectionUseCase: TestConnectionUseCase,
		private readonly treeDataProvider: MySqlConnectionsTreeDataProvider,
		private readonly sqlite3TreeDataProvider: Sqlite3ConnectionsTreeDataProvider
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
						{ label: '查看详情', value: 'details' as const },
						{ label: '测试连接', value: 'test' as const },
						{ label: '编辑连接', value: 'edit' as const },
						{ label: '删除连接', value: 'delete' as const },
					],
					{
						title: `PPZ Plus: ${selectedConnection.name}`,
						placeHolder: '选择要执行的操作',
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
	private async pickConnection(): Promise<ConnectionConfig | undefined> {
		const connections = await this.listStoredConnectionsUseCase.execute();
		if (connections.length === 0) {
			await vscode.window.showInformationMessage(
				'暂无已保存的数据库连接，请先使用“PPZ Plus: 新增数据库连接”创建连接。'
			);
			return undefined;
		}

		const selectedConnection = await vscode.window.showQuickPick(
			connections.map((connection) => ({
				label: connection.name,
				detail: describeConnectionEngine(connection),
				description: this.describeConnectionTarget(connection),
				connection,
			})),
			{
				title: 'PPZ Plus: 管理数据库连接',
				placeHolder: '选择一个已保存的数据库连接',
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
		connection: ConnectionConfig
	): Promise<void> {
		/**
		 * 构建当前选中连接的可读摘要。
		 */
		const message =
			connection.mode === 'parameters'
				? [
						`名称：${connection.name}`,
						`类型：${describeConnectionEngine(connection)}`,
						`模式：字段`,
						`Host：${connection.host}`,
						`Port：${connection.port}`,
						`User：${connection.username}`,
						`Database：${connection.database ?? '（无）'}`,
					].join('\n')
				: connection.mode === 'file'
					? [
							`名称：${connection.name}`,
							`类型：${describeConnectionEngine(connection)}`,
							`模式：文件`,
							`文件：${connection.dbPath}`,
						].join('\n')
				: [
						`名称：${connection.name}`,
						`类型：${describeConnectionEngine(connection)}`,
						`模式：URL`,
						`URL: ${connection.url}`,
					].join('\n');

		await vscode.window.showInformationMessage(message, { modal: true });
	}

	/**
	 * 测试已保存连接并展示结果。
	 *
	 * @param connection 当前选中的连接。
	 */
	private async testConnection(connection: ConnectionConfig): Promise<void> {
		try {
			await withConnectionTestProgress(connection, () =>
				this.testConnectionUseCase.execute(connection)
			);
			await vscode.window.showInformationMessage(
				`“${connection.name}”连接测试通过。`
			);
		} catch (error) {
			await showUserErrorMessage({
				operation: `测试 ${describeConnectionEngine(connection)} 连接`,
				error,
			});
		}
	}

	/**
	 * 提示用户编辑已保存连接。
	 *
	 * @param connection 当前选中的连接。
	 */
	private async editConnection(connection: ConnectionConfig): Promise<void> {
		if (connection.engine === 'sqlite3') {
			const updatedConnection =
				await AddSqlite3ConnectionCommand.collectSqlite3Config(
					connection as Sqlite3ConnectionConfig
				);

			if (!updatedConnection) {
				return;
			}

			await this.saveConnectionConfigUseCase.execute(updatedConnection);
			this.treeDataProvider.refresh();
			this.sqlite3TreeDataProvider.refresh();
			await vscode.window.showInformationMessage(
				`已更新 ${describeConnectionEngine(updatedConnection)} 连接“${updatedConnection.name}”。`
			);
			return;
		}

		const mode = await this.promptForMode(connection.mode);
		if (!mode) {
			return;
		}

		const updatedConnection =
			connection.engine === 'postgresql'
				? await AddMySqlConnectionCommand.collectPostgreSqlConfig(
						mode,
						connection as PostgreSqlConnectionConfig
					)
				: await AddMySqlConnectionCommand.collectMySqlConfig(
						mode,
						connection as MysqlConnectionConfig
					);
		if (!updatedConnection) {
			return;
		}

		await this.saveConnectionConfigUseCase.execute(updatedConnection);
		this.treeDataProvider.refresh();
		this.sqlite3TreeDataProvider.refresh();
		await vscode.window.showInformationMessage(
			`已更新 ${describeConnectionEngine(updatedConnection)} 连接“${updatedConnection.name}”。`
		);
	}

	/**
	 * 确认后删除已保存连接。
	 *
	 * @param connection 当前选中的连接。
	 */
	private async deleteConnection(
		connection: ConnectionConfig
	): Promise<void> {
		const confirmation = await vscode.window.showWarningMessage(
			`确定删除 ${describeConnectionEngine(connection)} 连接“${connection.name}”？`,
			{ modal: true },
			'删除'
		);
		if (confirmation !== '删除') {
			return;
		}

		await this.deleteStoredConnectionUseCase.execute(connection.id);
		this.treeDataProvider.refresh();
		this.sqlite3TreeDataProvider.refresh();
		await vscode.window.showInformationMessage(
			`已删除 ${describeConnectionEngine(connection)} 连接“${connection.name}”。`
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
					label: '字段',
					description:
						currentMode === 'parameters' ? '当前模式' : undefined,
					value: 'parameters' as const,
				},
				{
					label: '连接 URL',
					description: currentMode === 'url' ? '当前模式' : undefined,
					value: 'url' as const,
				},
			],
			{
				title: 'PPZ Plus: 编辑数据库连接',
				placeHolder: '选择要编辑的连接方式',
			}
		);

		return modeChoice?.value;
	}

	/**
	 * 描述连接目标地址。
	 *
	 * @param connection 当前连接配置。
	 * @returns 连接目标描述。
	 */
	private describeConnectionTarget(connection: ConnectionConfig): string {
		if (connection.mode === 'parameters') {
			return `${connection.host}:${connection.port}`;
		}

		if (connection.mode === 'file') {
			return connection.dbPath;
		}

		return connection.url;
	}
}
