import * as vscode from 'vscode';

import type { ListStoredConnectionsUseCase } from '../../application/useCases/ListStoredConnectionsUseCase';
import type { MysqlConnectionConfig } from '../../domain/connections/ConnectionConfig';
import type {
	MySqlConnectionTreeNode,
	MySqlConnectionsTreeNode,
	MySqlSchemaPlaceholderTreeNode,
} from './MySqlConnectionsTreeNode';

/**
 * Provides the MySQL connection explorer tree for the current extension session.
 */
export class MySqlConnectionsTreeDataProvider
	implements vscode.TreeDataProvider<MySqlConnectionsTreeNode>
{
	/**
	 * Stores the VS Code view identifier used by the MySQL explorer tree.
	 */
	public static readonly viewId = 'ppzPlus.mysqlConnections';

	/**
	 * Stores the connection node context value used by tree menus.
	 */
	public static readonly connectionContextValue = 'ppzPlus.mysqlConnection';

	/**
	 * Stores the placeholder node context value used by tree menus.
	 */
	public static readonly placeholderContextValue = 'ppzPlus.mysqlSchemaPlaceholder';

	/**
	 * Emits tree refresh events for the explorer view.
	 */
	private readonly onDidChangeTreeDataEmitter =
		new vscode.EventEmitter<MySqlConnectionsTreeNode | undefined>();

	/**
	 * Exposes the tree refresh event to VS Code.
	 */
	public readonly onDidChangeTreeData =
		this.onDidChangeTreeDataEmitter.event;

	/**
	 * Creates the MySQL connection tree data provider.
	 *
	 * @param listStoredConnectionsUseCase Use case used to load stored connections.
	 */
	public constructor(
		private readonly listStoredConnectionsUseCase: ListStoredConnectionsUseCase
	) {}

	/**
	 * Refreshes the tree contents.
	 */
	public refresh(): void {
		this.onDidChangeTreeDataEmitter.fire(undefined);
	}

	/**
	 * Returns the tree item representation for a given node.
	 *
	 * @param element Tree node being rendered.
	 * @returns The VS Code tree item for the node.
	 */
	public getTreeItem(
		element: MySqlConnectionsTreeNode
	): vscode.TreeItem {
		if (element.kind === 'connection') {
			return this.createConnectionTreeItem(element);
		}

		return this.createPlaceholderTreeItem(element);
	}

	/**
	 * Loads the child nodes for a given tree node.
	 *
	 * @param element Parent tree node, or undefined for the root level.
	 * @returns The child nodes to render.
	 */
	public async getChildren(
		element?: MySqlConnectionsTreeNode
	): Promise<readonly MySqlConnectionsTreeNode[]> {
		if (!element) {
			const connections = await this.listStoredConnectionsUseCase.execute();
			return connections.map((connection) => ({
				kind: 'connection',
				connection,
			}));
		}

		if (element.kind === 'connection') {
			return [
				{
					kind: 'schema-placeholder',
					connectionId: element.connection.id,
				},
			];
		}

		return [];
	}

	/**
	 * Creates the visual representation for a connection node.
	 *
	 * @param element Connection tree node.
	 * @returns The connection tree item.
	 */
	private createConnectionTreeItem(
		element: MySqlConnectionTreeNode
	): vscode.TreeItem {
		/**
		 * Resolves a short endpoint description for the tree item.
		 */
		const description = this.describeConnection(element.connection);
		const treeItem = new vscode.TreeItem(
			element.connection.name,
			vscode.TreeItemCollapsibleState.Collapsed
		);
		treeItem.contextValue =
			MySqlConnectionsTreeDataProvider.connectionContextValue;
		treeItem.description = description;
		treeItem.iconPath = new vscode.ThemeIcon('database');
		return treeItem;
	}

	/**
	 * Creates the visual representation for a placeholder node.
	 *
	 * @param element Placeholder tree node.
	 * @returns The placeholder tree item.
	 */
	private createPlaceholderTreeItem(
		element: MySqlSchemaPlaceholderTreeNode
	): vscode.TreeItem {
		const treeItem = new vscode.TreeItem(
			'Schemas and tables will be loaded in the next step',
			vscode.TreeItemCollapsibleState.None
		);
		treeItem.contextValue =
			MySqlConnectionsTreeDataProvider.placeholderContextValue;
		treeItem.id = `${element.connectionId}.schema-placeholder`;
		treeItem.iconPath = new vscode.ThemeIcon('info');
		return treeItem;
	}

	/**
	 * Creates a short connection description for the explorer tree.
	 *
	 * @param connection Connection configuration to describe.
	 * @returns A human-readable connection description.
	 */
	private describeConnection(connection: MysqlConnectionConfig): string {
		if (connection.mode === 'parameters') {
			return `${connection.host}:${connection.port}`;
		}

		return connection.url;
	}
}
