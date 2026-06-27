import * as vscode from 'vscode';

import type { ListStoredConnectionsUseCase } from '../../application/useCases/ListStoredConnectionsUseCase';
import type { TestConnectionUseCase } from '../../application/useCases/TestConnectionUseCase';
import type { MysqlConnectionConfig } from '../../domain/connections/ConnectionConfig';
import type { ExtensionCommand } from './ExtensionCommand';
import type { MySqlConnectionTreeNode } from '../explorer/MySqlConnectionsTreeNode';

/**
 * 测试从资源树或选择器中选中的 MySQL 连接。
 */
export class TestStoredMySqlConnectionCommand implements ExtensionCommand {
	/**
	 * 保存 VS Code 命令标识。
	 */
	public static readonly id = 'ppz-plus.testStoredMySqlConnection';

	/**
	 * 通过命令契约暴露命令标识。
	 */
	public readonly id = TestStoredMySqlConnectionCommand.id;

	/**
	 * 创建已保存连接测试命令。
	 *
	 * @param listStoredConnectionsUseCase 用于读取已保存连接的用例。
	 * @param testConnectionUseCase 用于测试所选连接的用例。
	 */
	public constructor(
		private readonly listStoredConnectionsUseCase: ListStoredConnectionsUseCase,
		private readonly testConnectionUseCase: TestConnectionUseCase
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
				const connection =
					treeNode?.kind === 'connection'
						? treeNode.connection
						: await this.pickConnection();

				if (!connection) {
					return;
				}

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
		);
	}

	/**
	 * 提示用户选择一个已保存连接。
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
				title: 'PPZ Plus: Test MySQL Connection',
				placeHolder: 'Choose a stored MySQL connection to test',
			}
		);

		return selectedConnection?.connection;
	}
}
