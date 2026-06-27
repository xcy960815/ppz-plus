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

/**
 * Manages stored MySQL connections through a simple action picker.
 */
export class ManageMySqlConnectionsCommand implements ExtensionCommand {
	/**
	 * Stores the VS Code command identifier.
	 */
	public static readonly id = 'ppz-plus.manageMySqlConnections';

	/**
	 * Exposes the command identifier through the command contract.
	 */
	public readonly id = ManageMySqlConnectionsCommand.id;

	/**
	 * Creates the connection management command.
	 *
	 * @param listStoredConnectionsUseCase Use case used to list stored connections.
	 * @param saveConnectionConfigUseCase Use case used to persist connection edits.
	 * @param deleteStoredConnectionUseCase Use case used to remove connections.
	 * @param testConnectionUseCase Use case used to test selected connections.
	 */
	public constructor(
		private readonly listStoredConnectionsUseCase: ListStoredConnectionsUseCase,
		private readonly saveConnectionConfigUseCase: SaveConnectionConfigUseCase,
		private readonly deleteStoredConnectionUseCase: DeleteStoredConnectionUseCase,
		private readonly testConnectionUseCase: TestConnectionUseCase
	) {}

	/**
	 * Registers the command with VS Code.
	 *
	 * @returns A disposable command registration.
	 */
	public register(): vscode.Disposable {
		return vscode.commands.registerCommand(this.id, async () => {
			const connections = await this.listStoredConnectionsUseCase.execute();
			if (connections.length === 0) {
				await vscode.window.showInformationMessage(
					'No MySQL connections are stored yet. Use "PPZ Plus: Add MySQL Connection" first.'
				);
				return;
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
					title: `PPZ Plus: ${selectedConnection.connection.name}`,
					placeHolder: 'Choose an action',
				}
			);
			if (!action) {
				return;
			}

			switch (action.value) {
				case 'details':
					await this.showConnectionDetails(selectedConnection.connection);
					return;
				case 'test':
					await this.testConnection(selectedConnection.connection);
					return;
				case 'edit':
					await this.editConnection(selectedConnection.connection);
					return;
				case 'delete':
					await this.deleteConnection(selectedConnection.connection);
					return;
			}
		});
	}

	/**
	 * Displays a connection summary to the user.
	 *
	 * @param connection Selected connection.
	 */
	private async showConnectionDetails(
		connection: MysqlConnectionConfig
	): Promise<void> {
		/**
		 * Builds a human-readable summary of the selected connection.
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
	 * Tests a stored connection and displays the result.
	 *
	 * @param connection Selected connection.
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
	 * Prompts the user to edit a stored connection.
	 *
	 * @param connection Selected connection.
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
		await vscode.window.showInformationMessage(
			`Updated MySQL connection "${updatedConnection.name}".`
		);
	}

	/**
	 * Deletes a stored connection after confirmation.
	 *
	 * @param connection Selected connection.
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
		await vscode.window.showInformationMessage(
			`Deleted MySQL connection "${connection.name}".`
		);
	}

	/**
	 * Prompts the user for the editing mode of a MySQL connection.
	 *
	 * @param currentMode Existing connection mode.
	 * @returns The chosen connection mode.
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
