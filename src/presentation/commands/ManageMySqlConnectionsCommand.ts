import * as vscode from "vscode";

import type { DeleteStoredConnectionUseCase } from "../../application/useCases/DeleteStoredConnectionUseCase";
import type { ListStoredConnectionsUseCase } from "../../application/useCases/ListStoredConnectionsUseCase";
import { describeConnectionEngine } from "./MySqlConnectionProgressPresenter";
import type { ConnectionConfig } from "../../domain/connections/ConnectionConfig";
import type { ExtensionCommand } from "./ExtensionCommand";
import { AddMySqlConnectionCommand } from "./AddMySqlConnectionCommand";
import { describeConnectionTarget as formatConnectionTarget } from "./ConnectionDisplayFormatter";
import type { DatabaseConnectionTreeNode } from "../explorer/DatabaseConnectionsTreeNode";
import { DatabaseConnectionsTreeDataProvider } from "../explorer/DatabaseConnectionsTreeDataProvider";
import { Sqlite3ConnectionsTreeDataProvider } from "../explorer/Sqlite3ConnectionsTreeDataProvider";

/**
 * 通过操作选择器管理已保存的数据库连接。
 */
export class ManageMySqlConnectionsCommand implements ExtensionCommand {
  /**
   * 保存 VS Code 命令标识。
   */
  public static readonly id = "ppz-plus.manageMySqlConnections";

  /**
   * 通过命令契约暴露命令标识。
   */
  public readonly id = ManageMySqlConnectionsCommand.id;

  /**
   * 创建连接管理命令。
   *
   * @param listStoredConnectionsUseCase 用于读取已保存连接的用例。
   * @param deleteStoredConnectionUseCase 用于删除连接的用例。
   * @param treeDataProvider 用于刷新混合数据库连接树。
   * @param sqlite3TreeDataProvider 用于刷新 SQLite3 连接树。
   */
  public constructor(
    private readonly listStoredConnectionsUseCase: ListStoredConnectionsUseCase,
    private readonly deleteStoredConnectionUseCase: DeleteStoredConnectionUseCase,
    private readonly treeDataProvider: DatabaseConnectionsTreeDataProvider,
    private readonly sqlite3TreeDataProvider: Sqlite3ConnectionsTreeDataProvider,
  ) {}

  /**
   * 向 VS Code 注册命令。
   *
   * @returns {vscode.Disposable} 命令注册的可释放句柄。
   */
  public register(): vscode.Disposable {
    return vscode.commands.registerCommand(
      this.id,
      async (treeNode?: DatabaseConnectionTreeNode) => {
        const selectedConnection = await this.resolveConnection(treeNode);
        if (!selectedConnection) {
          return;
        }

        const actions = [
          { label: "查看详情", value: "details" as const },
          { label: "编辑连接", value: "edit" as const },
          { label: "删除连接", value: "delete" as const },
        ];
        const action = await vscode.window.showQuickPick(actions, {
          title: `PPZ Plus: ${selectedConnection.name}`,
          placeHolder: "选择要执行的操作",
        });
        if (!action) {
          return;
        }

        switch (action.value) {
          case "details":
            await this.showConnectionDetails(selectedConnection);
            return;
          case "edit":
            await this.editConnection(selectedConnection);
            return;
          case "delete":
            await this.deleteConnection(selectedConnection);
            return;
        }
      },
    );
  }

  /**
   * 解析命令来源中的连接；无节点上下文时回退到连接选择器。
   *
   * @param {DatabaseConnectionTreeNode} treeNode VS Code 传入的树节点上下文。
   * @returns {Promise<ConnectionConfig | undefined>} 解析出的连接；用户取消时为空。
   */
  private async resolveConnection(
    treeNode?: DatabaseConnectionTreeNode,
  ): Promise<ConnectionConfig | undefined> {
    return treeNode?.kind === "connection" ? treeNode.connection : await this.pickConnection();
  }

  /**
   * 提示用户选择一个已保存连接进行管理。
   *
   * @returns {Promise<ConnectionConfig | undefined>} 用户选择的连接；未选择时为空。
   */
  private async pickConnection(): Promise<ConnectionConfig | undefined> {
    const connections = await this.listStoredConnectionsUseCase.execute();
    if (connections.length === 0) {
      await vscode.window.showInformationMessage(
        "暂无已保存的数据库连接，请先使用“新增数据库连接”创建连接。",
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
        title: "PPZ Plus: 管理数据库连接",
        placeHolder: "选择一个已保存的数据库连接",
      },
    );

    return selectedConnection?.connection;
  }

  /**
   * 使用统一连接表单展示已保存连接详情。
   *
   * @param {ConnectionConfig} connection 当前选中的连接。
   */
  private async showConnectionDetails(connection: ConnectionConfig): Promise<void> {
    await vscode.commands.executeCommand(AddMySqlConnectionCommand.id, connection, "details");
  }

  /**
   * 使用统一连接表单编辑已保存连接。
   *
   * @param {ConnectionConfig} connection 当前选中的连接。
   */
  private async editConnection(connection: ConnectionConfig): Promise<void> {
    await vscode.commands.executeCommand(AddMySqlConnectionCommand.id, connection, "edit");
  }

  /**
   * 确认后删除已保存连接。
   *
   * @param {ConnectionConfig} connection 当前选中的连接。
   */
  private async deleteConnection(connection: ConnectionConfig): Promise<void> {
    const confirmation = await vscode.window.showWarningMessage(
      `确定删除 ${describeConnectionEngine(connection)} 连接“${connection.name}”？`,
      { modal: true },
      "删除",
    );
    if (confirmation !== "删除") {
      return;
    }

    await this.deleteStoredConnectionUseCase.execute(connection.id);
    this.treeDataProvider.refresh();
    this.sqlite3TreeDataProvider.refresh();
    await vscode.window.showInformationMessage(
      `已删除 ${describeConnectionEngine(connection)} 连接“${connection.name}”。`,
    );
  }

  /**
   * 描述连接目标地址。
   *
   * @param {ConnectionConfig} connection 当前连接配置。
   * @returns {string} 连接目标描述。
   */
  private describeConnectionTarget(connection: ConnectionConfig): string {
    return formatConnectionTarget(connection);
  }
}
