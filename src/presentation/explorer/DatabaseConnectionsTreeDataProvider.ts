import * as vscode from "vscode";

import type { ListMySqlSchemasUseCase } from "../../application/useCases/ListMySqlSchemasUseCase";
import { OpenMySqlTableDataCommand } from "../commands/OpenMySqlTableDataCommand";
import type { ListMySqlTablesUseCase } from "../../application/useCases/ListMySqlTablesUseCase";
import type { ListPostgreSqlDatabasesUseCase } from "../../application/useCases/ListPostgreSqlDatabasesUseCase";
import type { ListPostgreSqlSchemasUseCase } from "../../application/useCases/ListPostgreSqlSchemasUseCase";
import type { ListPostgreSqlTablesUseCase } from "../../application/useCases/ListPostgreSqlTablesUseCase";
import type { ListSqlite3TablesUseCase } from "../../application/useCases/ListSqlite3TablesUseCase";
import type { ListStoredConnectionsUseCase } from "../../application/useCases/ListStoredConnectionsUseCase";
import type { ConnectionConfig } from "../../domain/connections/ConnectionConfig";
import type {
  DatabaseConnectionTreeNode,
  DatabaseConnectionsTreeNode,
  MySqlSchemaTreeNode,
  MySqlTableTreeNode,
  PostgreSqlDatabaseTreeNode,
  PostgreSqlSchemaTreeNode,
  PostgreSqlTableTreeNode,
  Sqlite3TableTreeNode,
} from "./DatabaseConnectionsTreeNode";
import { showUserErrorMessage } from "../commands/UserErrorPresenter";
import type { StoredConnectionPasswordPrompt } from "../commands/StoredConnectionPasswordPrompt";
import { describeConnectionTarget } from "../commands/ConnectionDisplayFormatter";

/**
 * 为当前扩展会话提供统一的数据库连接资源树。
 */
export class DatabaseConnectionsTreeDataProvider implements vscode.TreeDataProvider<DatabaseConnectionsTreeNode> {
  /**
   * 保存数据库资源树使用的 VS Code 视图标识。
   */
  public static readonly viewId = "ppzPlus.mysqlConnections";

  /**
   * 保存 Tree 菜单使用的连接节点上下文值。
   */
  public static readonly connectionContextValue = "ppzPlus.mysqlConnection";

  /**
   * 保存 Tree 菜单使用的 schema 节点上下文值。
   */
  public static readonly schemaContextValue = "ppzPlus.mysqlSchema";

  /**
   * 保存 Tree 菜单使用的表节点上下文值。
   */
  public static readonly tableContextValue = "ppzPlus.mysqlTable";

  /**
   * 保存 Tree 菜单使用的 PostgreSQL 连接节点上下文值。
   */
  public static readonly postgreSqlConnectionContextValue = "ppzPlus.postgresqlConnection";

  /**
   * 保存 Tree 菜单使用的 PostgreSQL database 节点上下文值。
   */
  public static readonly postgreSqlDatabaseContextValue = "ppzPlus.postgresqlDatabase";

  /**
   * 保存 Tree 菜单使用的 PostgreSQL schema 节点上下文值。
   */
  public static readonly postgreSqlSchemaContextValue = "ppzPlus.postgresqlSchema";

  /**
   * 保存 Tree 菜单使用的 PostgreSQL 表节点上下文值。
   */
  public static readonly postgreSqlTableContextValue = "ppzPlus.postgresqlTable";

  /**
   * 保存 Tree 菜单使用的 SQLite3 连接节点上下文值。
   */
  public static readonly sqlite3ConnectionContextValue = "ppzPlus.sqlite3Connection";

  /**
   * 保存 Tree 菜单使用的 SQLite3 表节点上下文值。
   */
  public static readonly sqlite3TableContextValue = "ppzPlus.sqlite3Table";

  /**
   * 保存 Tree 菜单使用的计划中连接节点上下文值。
   */
  public static readonly plannedConnectionContextValue = "ppzPlus.plannedConnection";

  /**
   * 为资源视图发出 Tree 刷新事件。
   */
  private readonly onDidChangeTreeDataEmitter = new vscode.EventEmitter<
    DatabaseConnectionsTreeNode | undefined
  >();

  /**
   * 向 VS Code 暴露 Tree 刷新事件。
   */
  public readonly onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;

  /**
   * 创建数据库连接 Tree 数据提供者。
   *
   * @param listStoredConnectionsUseCase 用于加载已保存连接的用例。
   * @param listMySqlSchemasUseCase 用于加载 MySQL schema 的用例。
   * @param listMySqlTablesUseCase 用于加载 MySQL 表的用例。
   * @param listPostgreSqlDatabasesUseCase 用于加载 PostgreSQL database 的用例。
   * @param listPostgreSqlSchemasUseCase 用于加载 PostgreSQL schema 的用例。
   * @param listPostgreSqlTablesUseCase 用于加载 PostgreSQL 表的用例。
   * @param listSqlite3TablesUseCase 用于加载 SQLite3 表的用例。
   * @param storedConnectionPasswordPrompt 用于补录已保存连接缺失的本机密码。
   */
  public constructor(
    private readonly listStoredConnectionsUseCase: ListStoredConnectionsUseCase,
    private readonly listMySqlSchemasUseCase: ListMySqlSchemasUseCase,
    private readonly listMySqlTablesUseCase: ListMySqlTablesUseCase,
    private readonly listPostgreSqlDatabasesUseCase: ListPostgreSqlDatabasesUseCase,
    private readonly listPostgreSqlSchemasUseCase: ListPostgreSqlSchemasUseCase,
    private readonly listPostgreSqlTablesUseCase: ListPostgreSqlTablesUseCase,
    private readonly listSqlite3TablesUseCase: ListSqlite3TablesUseCase,
    private readonly storedConnectionPasswordPrompt: StoredConnectionPasswordPrompt,
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
   * @param {DatabaseConnectionsTreeNode} element 正在渲染的 Tree 节点。
   * @returns {vscode.TreeItem} 该节点对应的 VS Code TreeItem。
   */
  public getTreeItem(element: DatabaseConnectionsTreeNode): vscode.TreeItem {
    if (element.kind === "connection") {
      return this.createConnectionTreeItem(element);
    }

    if (element.kind === "schema") {
      return this.createSchemaTreeItem(element);
    }

    if (element.kind === "table") {
      return this.createTableTreeItem(element);
    }

    if (element.kind === "postgresqlDatabase") {
      return this.createPostgreSqlDatabaseTreeItem(element);
    }

    if (element.kind === "postgresqlSchema") {
      return this.createPostgreSqlSchemaTreeItem(element);
    }

    if (element.kind === "postgresqlTable") {
      return this.createPostgreSqlTableTreeItem(element);
    }

    return this.createSqlite3TableTreeItem(element);
  }

  /**
   * 加载指定 Tree 节点的子节点。
   *
   * @param {DatabaseConnectionsTreeNode} element 父级 Tree 节点；根层级时为空。
   * @returns {Promise<DatabaseConnectionsTreeNode[]>} 需要渲染的子节点。
   */
  public async getChildren(
    element?: DatabaseConnectionsTreeNode,
  ): Promise<DatabaseConnectionsTreeNode[]> {
    try {
      if (!element) {
        const connections = await this.listStoredConnectionsUseCase.execute();
        return connections.map((connection) => ({
          kind: "connection",
          connection,
        }));
      }

      if (element.kind === "connection") {
        const connection = await this.ensureConnectionReady(element.connection);

        if (!connection) {
          return [];
        }

        if (connection.engine === "postgresql") {
          const databases = await this.listPostgreSqlDatabasesUseCase.execute(connection);
          return databases.map((database) => ({
            kind: "postgresqlDatabase",
            connection,
            databaseName: database.name,
            isDefault: connection.mode === "parameters" && connection.database === database.name,
          }));
        }

        if (connection.engine === "sqlite3") {
          const tables = await this.listSqlite3TablesUseCase.execute(connection);
          return tables.map((table) => ({
            kind: "sqlite3Table",
            connection,
            schemaName: "main",
            tableName: table.name,
            tableType: table.type,
          }));
        }

        if (connection.engine === "mysql") {
          const schemas = await this.listMySqlSchemasUseCase.execute(connection);
          return schemas.map((schema) => ({
            kind: "schema",
            connection,
            schemaName: schema.name,
          }));
        }

        return [];
      }

      if (element.kind === "schema") {
        const tables = await this.listMySqlTablesUseCase.execute(
          element.connection,
          element.schemaName,
        );
        return tables.map((table) => ({
          kind: "table",
          connection: element.connection,
          schemaName: element.schemaName,
          tableName: table.name,
        }));
      }

      if (element.kind === "postgresqlDatabase") {
        const schemas = await this.listPostgreSqlSchemasUseCase.execute(
          element.connection,
          element.databaseName,
        );
        return schemas.map((schema) => ({
          kind: "postgresqlSchema",
          connection: element.connection,
          databaseName: element.databaseName,
          schemaName: schema.name,
        }));
      }

      if (element.kind === "postgresqlSchema") {
        const tables = await this.listPostgreSqlTablesUseCase.execute(
          element.connection,
          element.databaseName,
          element.schemaName,
        );
        return tables.map((table) => ({
          kind: "postgresqlTable",
          connection: element.connection,
          databaseName: element.databaseName,
          schemaName: element.schemaName,
          tableName: table.name,
        }));
      }

      return [];
    } catch (error) {
      await showUserErrorMessage({
        operation: "加载数据库资源",
        error,
      });
      return [];
    }
  }

  /**
   * 创建连接节点的可视化表示。
   *
   * @param {DatabaseConnectionTreeNode} element 连接 Tree 节点。
   * @returns {vscode.TreeItem} 连接节点对应的 TreeItem。
   */
  private createConnectionTreeItem(element: DatabaseConnectionTreeNode): vscode.TreeItem {
    /**
     * 解析 TreeItem 使用的简短端点描述。
     */
    const description = this.describeConnection(element.connection);
    const treeItem = new vscode.TreeItem(
      element.connection.name,
      this.canExpandConnection(element.connection)
        ? vscode.TreeItemCollapsibleState.Collapsed
        : vscode.TreeItemCollapsibleState.None,
    );
    treeItem.contextValue =
      element.connection.engine === "sqlite3"
        ? DatabaseConnectionsTreeDataProvider.sqlite3ConnectionContextValue
        : element.connection.engine === "postgresql"
          ? DatabaseConnectionsTreeDataProvider.postgreSqlConnectionContextValue
          : element.connection.engine === "mysql"
            ? DatabaseConnectionsTreeDataProvider.connectionContextValue
            : DatabaseConnectionsTreeDataProvider.plannedConnectionContextValue;
    treeItem.description = description;
    treeItem.iconPath = new vscode.ThemeIcon("database");
    return treeItem;
  }

  /**
   * 创建 schema 节点的可视化表示。
   *
   * @param {MySqlSchemaTreeNode} element schema Tree 节点。
   * @returns {vscode.TreeItem} schema 节点对应的 TreeItem。
   */
  private createSchemaTreeItem(element: MySqlSchemaTreeNode): vscode.TreeItem {
    const treeItem = new vscode.TreeItem(
      element.schemaName,
      vscode.TreeItemCollapsibleState.Collapsed,
    );
    treeItem.contextValue = DatabaseConnectionsTreeDataProvider.schemaContextValue;
    treeItem.id = `${element.connection.id}.${element.schemaName}`;
    treeItem.iconPath = new vscode.ThemeIcon("folder-library");
    return treeItem;
  }

  /**
   * 创建 PostgreSQL database 节点的可视化表示。
   *
   * @param {PostgreSqlDatabaseTreeNode} element PostgreSQL database Tree 节点。
   * @returns {vscode.TreeItem} PostgreSQL database 节点对应的 TreeItem。
   */
  private createPostgreSqlDatabaseTreeItem(element: PostgreSqlDatabaseTreeNode): vscode.TreeItem {
    const treeItem = new vscode.TreeItem(
      element.databaseName,
      vscode.TreeItemCollapsibleState.Collapsed,
    );
    treeItem.contextValue = DatabaseConnectionsTreeDataProvider.postgreSqlDatabaseContextValue;
    treeItem.id = `${element.connection.id}.${element.databaseName}`;
    treeItem.description = element.isDefault ? "默认" : undefined;
    treeItem.iconPath = new vscode.ThemeIcon("database");
    return treeItem;
  }

  /**
   * 创建 PostgreSQL schema 节点的可视化表示。
   *
   * @param {PostgreSqlSchemaTreeNode} element PostgreSQL schema Tree 节点。
   * @returns {vscode.TreeItem} PostgreSQL schema 节点对应的 TreeItem。
   */
  private createPostgreSqlSchemaTreeItem(element: PostgreSqlSchemaTreeNode): vscode.TreeItem {
    const treeItem = new vscode.TreeItem(
      element.schemaName,
      vscode.TreeItemCollapsibleState.Collapsed,
    );
    treeItem.contextValue = DatabaseConnectionsTreeDataProvider.postgreSqlSchemaContextValue;
    treeItem.id = `${element.connection.id}.${element.databaseName}.${element.schemaName}`;
    treeItem.description = element.databaseName;
    treeItem.iconPath = new vscode.ThemeIcon("folder-library");
    return treeItem;
  }

  /**
   * 创建 PostgreSQL 表节点的可视化表示。
   *
   * @param {PostgreSqlTableTreeNode} element PostgreSQL 表 Tree 节点。
   * @returns {vscode.TreeItem} PostgreSQL 表节点对应的 TreeItem。
   */
  private createPostgreSqlTableTreeItem(element: PostgreSqlTableTreeNode): vscode.TreeItem {
    const treeItem = new vscode.TreeItem(element.tableName, vscode.TreeItemCollapsibleState.None);
    treeItem.contextValue = DatabaseConnectionsTreeDataProvider.postgreSqlTableContextValue;
    treeItem.id = `${element.connection.id}.${element.databaseName}.${element.schemaName}.${element.tableName}`;
    treeItem.description = element.schemaName;
    treeItem.iconPath = new vscode.ThemeIcon("table");
    treeItem.command = {
      command: OpenMySqlTableDataCommand.id,
      title: "打开表数据",
      arguments: [element],
    };
    return treeItem;
  }

  /**
   * 创建 SQLite3 表节点的可视化表示。
   *
   * @param {Sqlite3TableTreeNode} element SQLite3 表 Tree 节点。
   * @returns {vscode.TreeItem} SQLite3 表节点对应的 TreeItem。
   */
  private createSqlite3TableTreeItem(element: Sqlite3TableTreeNode): vscode.TreeItem {
    const treeItem = new vscode.TreeItem(element.tableName, vscode.TreeItemCollapsibleState.None);
    treeItem.contextValue = DatabaseConnectionsTreeDataProvider.sqlite3TableContextValue;
    treeItem.id = `${element.connection.id}.main.${element.tableName}`;
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
   * 创建表节点的可视化表示。
   *
   * @param {MySqlTableTreeNode} element 表 Tree 节点。
   * @returns {vscode.TreeItem} 表节点对应的 TreeItem。
   */
  private createTableTreeItem(element: MySqlTableTreeNode): vscode.TreeItem {
    const treeItem = new vscode.TreeItem(element.tableName, vscode.TreeItemCollapsibleState.None);
    treeItem.contextValue = DatabaseConnectionsTreeDataProvider.tableContextValue;
    treeItem.id = `${element.connection.id}.${element.schemaName}.${element.tableName}`;
    treeItem.description = element.schemaName;
    treeItem.iconPath = new vscode.ThemeIcon("table");
    treeItem.command = {
      command: OpenMySqlTableDataCommand.id,
      title: "打开表数据",
      arguments: [element],
    };
    return treeItem;
  }

  /**
   * 为资源树创建简短连接描述。
   *
   * @param {ConnectionConfig} connection 待描述的连接配置。
   * @returns {string} 用户可读的连接描述。
   */
  private describeConnection(connection: ConnectionConfig): string {
    return describeConnectionTarget(connection);
  }

  /**
   * 判断连接是否已经接入 Tree 浏览能力。
   *
   * @param {ConnectionConfig} connection 当前连接配置。
   * @returns {boolean} 已支持 Tree 浏览时返回 true。
   */
  private canExpandConnection(connection: ConnectionConfig): boolean {
    return (
      connection.engine === "mysql" ||
      connection.engine === "postgresql" ||
      connection.engine === "sqlite3"
    );
  }

  /**
   * 在真正访问数据库前，确保连接具备本机可用的密码。
   *
   * @param {ConnectionConfig} connection 当前连接配置。
   * @returns {Promise<ConnectionConfig | undefined>} 可直接使用的连接；用户取消时为空。
   */
  private async ensureConnectionReady(
    connection: ConnectionConfig,
  ): Promise<ConnectionConfig | undefined> {
    return this.storedConnectionPasswordPrompt.ensureConnectionReady(connection);
  }
}
