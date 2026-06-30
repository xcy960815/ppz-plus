import * as vscode from "vscode";

import type { ListSqlite3TablesUseCase } from "../../application/useCases/ListSqlite3TablesUseCase";
import type { ListStoredConnectionsUseCase } from "../../application/useCases/ListStoredConnectionsUseCase";
import type { Sqlite3ConnectionConfig } from "../../domain/connections/ConnectionConfig";
import { OpenMySqlTableDataCommand } from "../commands/OpenMySqlTableDataCommand";
import { showUserErrorMessage } from "../commands/UserErrorPresenter";
import type { MySqlConnectionTreeNode, Sqlite3TableTreeNode } from "./MySqlConnectionsTreeNode";

/**
 * 表示 SQLite3 资源视图中渲染的节点类型。
 */
export type Sqlite3ConnectionsTreeNode = MySqlConnectionTreeNode | Sqlite3TableTreeNode;

/**
 * 为当前扩展会话提供 SQLite3 连接资源树。
 */
export class Sqlite3ConnectionsTreeDataProvider implements vscode.TreeDataProvider<Sqlite3ConnectionsTreeNode> {
  /**
   * 保存 SQLite3 独立资源视图标识。
   */
  public static readonly viewId = "ppzPlus.sqlite3Connections";

  /**
   * 保存 Tree 菜单使用的 SQLite3 连接节点上下文值。
   */
  public static readonly connectionContextValue = "ppzPlus.sqlite3Connection";

  /**
   * 保存 Tree 菜单使用的 SQLite3 表节点上下文值。
   */
  public static readonly tableContextValue = "ppzPlus.sqlite3Table";

  /**
   * 为资源视图发出 Tree 刷新事件。
   */
  private readonly onDidChangeTreeDataEmitter = new vscode.EventEmitter<
    Sqlite3ConnectionsTreeNode | undefined
  >();

  /**
   * 向 VS Code 暴露 Tree 刷新事件。
   */
  public readonly onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;

  /**
   * 创建 SQLite3 连接 Tree 数据提供者。
   *
   * @param listStoredConnectionsUseCase 用于加载已保存连接的用例。
   * @param listSqlite3TablesUseCase 用于加载 SQLite3 表的用例。
   */
  public constructor(
    private readonly listStoredConnectionsUseCase: ListStoredConnectionsUseCase,
    private readonly listSqlite3TablesUseCase: ListSqlite3TablesUseCase,
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
   * @param {Sqlite3ConnectionsTreeNode} element 正在渲染的 Tree 节点。
   * @returns {vscode.TreeItem} 该节点对应的 VS Code TreeItem。
   */
  public getTreeItem(element: Sqlite3ConnectionsTreeNode): vscode.TreeItem {
    if (element.kind === "connection") {
      const treeItem = new vscode.TreeItem(
        element.connection.name,
        vscode.TreeItemCollapsibleState.Collapsed,
      );
      treeItem.contextValue = Sqlite3ConnectionsTreeDataProvider.connectionContextValue;
      treeItem.description =
        element.connection.engine === "sqlite3" ? element.connection.dbPath : undefined;
      treeItem.iconPath = new vscode.ThemeIcon("database");
      return treeItem;
    }

    const treeItem = new vscode.TreeItem(element.tableName, vscode.TreeItemCollapsibleState.None);
    treeItem.contextValue = Sqlite3ConnectionsTreeDataProvider.tableContextValue;
    treeItem.description = element.tableType === "view" ? "view" : undefined;
    treeItem.iconPath = new vscode.ThemeIcon(element.tableType === "view" ? "eye" : "table");
    treeItem.command = {
      command: OpenMySqlTableDataCommand.id,
      title: "打开表数据",
      arguments: [element],
    };
    return treeItem;
  }

  /**
   * 加载指定 Tree 节点的子节点。
   *
   * @param {Sqlite3ConnectionsTreeNode} element 父级 Tree 节点；根层级时为空。
   * @returns {Promise<Sqlite3ConnectionsTreeNode[]>} 需要渲染的子节点。
   */
  public async getChildren(
    element?: Sqlite3ConnectionsTreeNode,
  ): Promise<Sqlite3ConnectionsTreeNode[]> {
    try {
      if (!element) {
        const connections = await this.listStoredConnectionsUseCase.execute();
        return connections
          .filter((connection) => connection.engine === "sqlite3")
          .map((connection) => ({
            kind: "connection",
            connection,
          }));
      }

      if (element.kind === "sqlite3Table") {
        return [];
      }

      if (element.connection.engine !== "sqlite3") {
        return [];
      }

      const connection = element.connection as Sqlite3ConnectionConfig;
      const tables = await this.listSqlite3TablesUseCase.execute(connection);
      return tables.map((table) => ({
        kind: "sqlite3Table",
        connection,
        schemaName: "main",
        tableName: table.name,
        tableType: table.type,
      }));
    } catch (error) {
      await showUserErrorMessage({
        operation: "加载 SQLite3 资源",
        error,
      });
      return [];
    }
  }
}
