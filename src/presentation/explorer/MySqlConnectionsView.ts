import * as vscode from 'vscode';

import type { ExtensionActivationParticipant } from '../bootstrap/ExtensionActivationParticipant';
import { MySqlConnectionsTreeDataProvider } from './MySqlConnectionsTreeDataProvider';

/**
 * Activates the MySQL connection explorer view.
 */
export class MySqlConnectionsView implements ExtensionActivationParticipant {
	/**
	 * Creates the explorer view activation participant.
	 *
	 * @param treeDataProvider Tree data provider used by the MySQL connection view.
	 */
	public constructor(
		private readonly treeDataProvider: MySqlConnectionsTreeDataProvider
	) {}

	/**
	 * Activates the MySQL explorer tree for the current extension session.
	 *
	 * @param context VS Code extension lifecycle context.
	 */
	public activate(context: vscode.ExtensionContext): void {
		const treeView = vscode.window.createTreeView(
			MySqlConnectionsTreeDataProvider.viewId,
			{
				showCollapseAll: true,
				treeDataProvider: this.treeDataProvider,
			}
		);

		context.subscriptions.push(treeView);
	}
}
