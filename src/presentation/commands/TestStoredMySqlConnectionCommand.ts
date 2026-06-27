import * as vscode from 'vscode';

import type { ListStoredConnectionsUseCase } from '../../application/useCases/ListStoredConnectionsUseCase';
import type { TestConnectionUseCase } from '../../application/useCases/TestConnectionUseCase';
import type { MysqlConnectionConfig } from '../../domain/connections/ConnectionConfig';
import type { ExtensionCommand } from './ExtensionCommand';
import type { MySqlConnectionTreeNode } from '../explorer/MySqlConnectionsTreeNode';

/**
 * Tests a stored MySQL connection selected from the explorer tree or a picker.
 */
export class TestStoredMySqlConnectionCommand implements ExtensionCommand {
	/**
	 * Stores the VS Code command identifier.
	 */
	public static readonly id = 'ppz-plus.testStoredMySqlConnection';

	/**
	 * Exposes the command identifier through the command contract.
	 */
	public readonly id = TestStoredMySqlConnectionCommand.id;

	/**
	 * Creates the stored connection test command.
	 *
	 * @param listStoredConnectionsUseCase Use case used to list stored connections.
	 * @param testConnectionUseCase Use case used to test selected connections.
	 */
	public constructor(
		private readonly listStoredConnectionsUseCase: ListStoredConnectionsUseCase,
		private readonly testConnectionUseCase: TestConnectionUseCase
	) {}

	/**
	 * Registers the command with VS Code.
	 *
	 * @returns A disposable command registration.
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
	 * Prompts the user to select a stored connection.
	 *
	 * @returns The chosen connection when available.
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
