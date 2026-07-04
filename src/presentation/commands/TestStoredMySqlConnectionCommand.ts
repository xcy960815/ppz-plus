import * as vscode from "vscode";

import type { ListStoredConnectionsUseCase } from "../../application/useCases/ListStoredConnectionsUseCase";
import type { TestConnectionUseCase } from "../../application/useCases/TestConnectionUseCase";
import type { ConnectionConfig } from "../../domain/connections/ConnectionConfig";
import type { ExtensionCommand } from "./ExtensionCommand";
import {
  describeConnectionEngine,
  withConnectionTestProgress,
} from "./MySqlConnectionProgressPresenter";
import { describeConnectionTarget as formatConnectionTarget } from "./ConnectionDisplayFormatter";
import type { StoredConnectionPasswordPrompt } from "./StoredConnectionPasswordPrompt";
import { showUserErrorMessage } from "./UserErrorPresenter";
import type { DatabaseConnectionTreeNode } from "../explorer/DatabaseConnectionsTreeNode";

/**
 * 测试从资源树或选择器中选中的数据库连接。
 */
export class TestStoredMySqlConnectionCommand implements ExtensionCommand {
  /**
   * 保存 VS Code 命令标识。
   */
  public static readonly id = "ppz-plus.testStoredMySqlConnection";

  /**
   * 通过命令契约暴露命令标识。
   */
  public readonly id = TestStoredMySqlConnectionCommand.id;

  /**
   * 创建已保存连接测试命令。
   *
   * @param listStoredConnectionsUseCase 用于读取已保存连接的用例。
   * @param testConnectionUseCase 用于测试所选连接的用例。
   * @param storedConnectionPasswordPrompt 用于补录已保存连接缺失的本机密码。
   */
  public constructor(
    private readonly listStoredConnectionsUseCase: ListStoredConnectionsUseCase,
    private readonly testConnectionUseCase: TestConnectionUseCase,
    private readonly storedConnectionPasswordPrompt: StoredConnectionPasswordPrompt,
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
        const connection =
          treeNode?.kind === "connection" ? treeNode.connection : await this.pickConnection();

        if (!connection) {
          return;
        }

        if (!this.canTestConnection(connection)) {
          await vscode.window.showInformationMessage(
            `${describeConnectionEngine(connection)} 连接测试入口尚未接入。`,
          );
          return;
        }

        try {
          const readyConnection =
            await this.storedConnectionPasswordPrompt.ensureConnectionReady(connection);
          if (!readyConnection) {
            return;
          }

          await withConnectionTestProgress(readyConnection, () =>
            this.testConnectionUseCase.execute(readyConnection),
          );
          await vscode.window.showInformationMessage(`“${readyConnection.name}”连接测试通过。`);
        } catch (error) {
          await showUserErrorMessage({
            operation: `测试 ${describeConnectionEngine(connection)} 连接`,
            error,
          });
        }
      },
    );
  }

  /**
   * 提示用户选择一个已保存连接。
   *
   * @returns {Promise<ConnectionConfig | undefined>} 用户选择的连接；未选择时为空。
   */
  private async pickConnection(): Promise<ConnectionConfig | undefined> {
    const connections = (await this.listStoredConnectionsUseCase.execute()).filter((connection) =>
      this.canTestConnection(connection),
    );
    if (connections.length === 0) {
      await vscode.window.showInformationMessage(
        "暂无可测试的数据库连接，请先创建已接入测试能力的连接。",
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
        title: "PPZ Plus: 测试数据库连接",
        placeHolder: "选择要测试的已保存数据库连接",
      },
    );

    return selectedConnection?.connection;
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

  /**
   * 判断连接是否已经接入连接测试器。
   *
   * @param {ConnectionConfig} connection 当前连接配置。
   * @returns {boolean} 已支持测试时返回 true。
   */
  private canTestConnection(connection: ConnectionConfig): boolean {
    return (
      connection.engine === "mysql" ||
      connection.engine === "postgresql" ||
      connection.engine === "sqlite3" ||
      connection.engine === "mssql"
    );
  }
}
