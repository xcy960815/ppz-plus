import * as vscode from "vscode";

import type { MssqlConnectionConfig } from "../../domain/connections/ConnectionConfig";
import type { ExtensionCommand } from "./ExtensionCommand";
import type { DatabaseConnectionsTreeNode } from "../explorer/DatabaseConnectionsTreeNode";
import { MssqlSqlTerminalPanel } from "../sql/MssqlSqlTerminalPanel";

/**
 * 打开 MSSQL SQL 终端。
 */
export class OpenMssqlSqlTerminalCommand implements ExtensionCommand {
  /**
   * 保存 VS Code 命令标识。
   */
  public static readonly id = "ppz-plus.openMssqlSqlTerminal";

  /**
   * 通过命令契约暴露命令标识。
   */
  public readonly id = OpenMssqlSqlTerminalCommand.id;

  /**
   * 创建打开 MSSQL SQL 终端命令。
   *
   * @param mssqlSqlTerminalPanel 用于渲染 SQL 终端的面板管理器。
   */
  public constructor(private readonly mssqlSqlTerminalPanel: MssqlSqlTerminalPanel) {}

  /**
   * 向 VS Code 注册命令。
   *
   * @returns {vscode.Disposable} 命令注册的可释放句柄。
   */
  public register(): vscode.Disposable {
    return vscode.commands.registerCommand(
      this.id,
      async (node?: DatabaseConnectionsTreeNode, initialSql?: string) => {
        const initialTarget = this.resolveInitialTarget(node);
        await this.mssqlSqlTerminalPanel.open(
          initialTarget?.connection,
          initialTarget?.databaseName,
          initialSql,
        );
      },
    );
  }

  /**
   * 从 Tree 节点解析 SQL 终端初始目标。
   *
   * @param {DatabaseConnectionsTreeNode} node 可选的数据库 Tree 节点。
   * @returns {{ connection: MssqlConnectionConfig; databaseName?: string } | undefined} 初始选中的 MSSQL 连接和 database；无法解析时为空。
   */
  private resolveInitialTarget(node?: DatabaseConnectionsTreeNode):
    | {
        readonly connection: MssqlConnectionConfig;
        readonly databaseName?: string;
      }
    | undefined {
    if (!node) {
      return undefined;
    }

    if (node.kind === "connection") {
      return node.connection.engine === "mssql" ? { connection: node.connection } : undefined;
    }

    if (node.kind === "mssqlDatabase") {
      return {
        connection: node.connection,
        databaseName: node.databaseName,
      };
    }

    if (node.kind === "mssqlSchema") {
      return {
        connection: node.connection,
        databaseName: node.databaseName,
      };
    }

    if (node.kind === "mssqlTable") {
      return {
        connection: node.connection,
        databaseName: node.databaseName,
      };
    }

    return undefined;
  }
}
