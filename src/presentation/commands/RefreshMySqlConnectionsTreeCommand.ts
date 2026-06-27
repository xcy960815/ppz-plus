import * as vscode from 'vscode';

import type { ExtensionCommand } from './ExtensionCommand';
import { MySqlConnectionsTreeDataProvider } from '../explorer/MySqlConnectionsTreeDataProvider';

/**
 * Refreshes the MySQL connection explorer tree.
 */
export class RefreshMySqlConnectionsTreeCommand implements ExtensionCommand {
	/**
	 * Stores the VS Code command identifier.
	 */
	public static readonly id = 'ppz-plus.refreshMySqlConnectionsTree';

	/**
	 * Exposes the command identifier through the command contract.
	 */
	public readonly id = RefreshMySqlConnectionsTreeCommand.id;

	/**
	 * Creates the refresh tree command.
	 *
	 * @param treeDataProvider Tree data provider refreshed by the command.
	 */
	public constructor(
		private readonly treeDataProvider: MySqlConnectionsTreeDataProvider
	) {}

	/**
	 * Registers the command with VS Code.
	 *
	 * @returns A disposable command registration.
	 */
	public register(): vscode.Disposable {
		return vscode.commands.registerCommand(this.id, () => {
			this.treeDataProvider.refresh();
		});
	}
}
