import * as vscode from 'vscode';

import type { ListMySqlSchemasUseCase } from '../../application/useCases/ListMySqlSchemasUseCase';
import { OpenMySqlTableDataCommand } from '../commands/OpenMySqlTableDataCommand';
import type { ListMySqlTablesUseCase } from '../../application/useCases/ListMySqlTablesUseCase';
import type { ListStoredConnectionsUseCase } from '../../application/useCases/ListStoredConnectionsUseCase';
import type { MysqlConnectionConfig } from '../../domain/connections/ConnectionConfig';
import type {
	MySqlConnectionTreeNode,
	MySqlConnectionsTreeNode,
	MySqlSchemaTreeNode,
	MySqlTableTreeNode,
} from './MySqlConnectionsTreeNode';
import { showUserErrorMessage } from '../commands/UserErrorPresenter';

/**
 * 为当前扩展会话提供 MySQL 连接资源树。
 */
export class MySqlConnectionsTreeDataProvider
	implements vscode.TreeDataProvider<MySqlConnectionsTreeNode>
{
	/**
	 * 保存 MySQL 资源树使用的 VS Code 视图标识。
	 */
	public static readonly viewId = 'ppzPlus.mysqlConnections';

	/**
	 * 保存 Tree 菜单使用的连接节点上下文值。
	 */
	public static readonly connectionContextValue = 'ppzPlus.mysqlConnection';

	/**
	 * 保存 Tree 菜单使用的 schema 节点上下文值。
	 */
	public static readonly schemaContextValue = 'ppzPlus.mysqlSchema';

	/**
	 * 保存 Tree 菜单使用的表节点上下文值。
	 */
	public static readonly tableContextValue = 'ppzPlus.mysqlTable';

	/**
	 * 为资源视图发出 Tree 刷新事件。
	 */
	private readonly onDidChangeTreeDataEmitter =
		new vscode.EventEmitter<MySqlConnectionsTreeNode | undefined>();

	/**
	 * 向 VS Code 暴露 Tree 刷新事件。
	 */
	public readonly onDidChangeTreeData =
		this.onDidChangeTreeDataEmitter.event;

	/**
	 * 创建 MySQL 连接 Tree 数据提供者。
	 *
	 * @param listStoredConnectionsUseCase 用于加载已保存连接的用例。
	 * @param listMySqlSchemasUseCase 用于加载 MySQL schema 的用例。
	 * @param listMySqlTablesUseCase 用于加载 MySQL 表的用例。
	 */
	public constructor(
		private readonly listStoredConnectionsUseCase: ListStoredConnectionsUseCase,
		private readonly listMySqlSchemasUseCase: ListMySqlSchemasUseCase,
		private readonly listMySqlTablesUseCase: ListMySqlTablesUseCase
	) {}

	/**
	 * 刷新 Tree 内容。
	 */
	public refresh(): void {
		this.onDidChangeTreeDataEmitter.fire(undefined);
	}

	/**
	 * 返回指定节点对应的 TreeItem 表现。
	 *
	 * @param element 正在渲染的 Tree 节点。
	 * @returns 该节点对应的 VS Code TreeItem。
	 */
	public getTreeItem(
		element: MySqlConnectionsTreeNode
	): vscode.TreeItem {
		if (element.kind === 'connection') {
			return this.createConnectionTreeItem(element);
		}

		if (element.kind === 'schema') {
			return this.createSchemaTreeItem(element);
		}

		return this.createTableTreeItem(element);
	}

	/**
	 * 加载指定 Tree 节点的子节点。
	 *
	 * @param element 父级 Tree 节点；根层级时为空。
	 * @returns 需要渲染的子节点。
	 */
	public async getChildren(
		element?: MySqlConnectionsTreeNode
	): Promise<MySqlConnectionsTreeNode[]> {
		try {
			if (!element) {
				const connections = await this.listStoredConnectionsUseCase.execute();
				return connections.map((connection) => ({
					kind: 'connection',
					connection,
				}));
			}

			if (element.kind === 'connection') {
				const schemas = await this.listMySqlSchemasUseCase.execute(
					element.connection
				);
				return schemas.map((schema) => ({
					kind: 'schema',
					connection: element.connection,
					schemaName: schema.name,
				}));
			}

			if (element.kind === 'schema') {
				const tables = await this.listMySqlTablesUseCase.execute(
					element.connection,
					element.schemaName
				);
				return tables.map((table) => ({
					kind: 'table',
					connection: element.connection,
					schemaName: element.schemaName,
					tableName: table.name,
				}));
			}

			return [];
		} catch (error) {
			await showUserErrorMessage({
				operation: '加载 MySQL 资源',
				error,
			});
			return [];
		}
	}

	/**
	 * 创建连接节点的可视化表示。
	 *
	 * @param element 连接 Tree 节点。
	 * @returns 连接节点对应的 TreeItem。
	 */
	private createConnectionTreeItem(
		element: MySqlConnectionTreeNode
	): vscode.TreeItem {
		/**
		 * 解析 TreeItem 使用的简短端点描述。
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
	 * 创建 schema 节点的可视化表示。
	 *
	 * @param element schema Tree 节点。
	 * @returns schema 节点对应的 TreeItem。
	 */
	private createSchemaTreeItem(
		element: MySqlSchemaTreeNode
	): vscode.TreeItem {
		const treeItem = new vscode.TreeItem(
			element.schemaName,
			vscode.TreeItemCollapsibleState.Collapsed
		);
		treeItem.contextValue = MySqlConnectionsTreeDataProvider.schemaContextValue;
		treeItem.id = `${element.connection.id}.${element.schemaName}`;
		treeItem.iconPath = new vscode.ThemeIcon('folder-library');
		return treeItem;
	}

	/**
	 * 创建表节点的可视化表示。
	 *
	 * @param element 表 Tree 节点。
	 * @returns 表节点对应的 TreeItem。
	 */
	private createTableTreeItem(
		element: MySqlTableTreeNode
	): vscode.TreeItem {
		const treeItem = new vscode.TreeItem(
			element.tableName,
			vscode.TreeItemCollapsibleState.None
		);
		treeItem.contextValue = MySqlConnectionsTreeDataProvider.tableContextValue;
		treeItem.id = `${element.connection.id}.${element.schemaName}.${element.tableName}`;
		treeItem.description = element.schemaName;
		treeItem.iconPath = new vscode.ThemeIcon('table');
		treeItem.command = {
			command: OpenMySqlTableDataCommand.id,
			title: '打开表数据',
			arguments: [element],
		};
		return treeItem;
	}

	/**
	 * 为资源树创建简短连接描述。
	 *
	 * @param connection 待描述的连接配置。
	 * @returns 用户可读的连接描述。
	 */
	private describeConnection(connection: MysqlConnectionConfig): string {
		if (connection.mode === 'parameters') {
			return `${connection.host}:${connection.port}`;
		}

		return connection.url;
	}
}
