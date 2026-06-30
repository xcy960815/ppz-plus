import * as vscode from "vscode";

import type { Sqlite3ConnectionConfig } from "../../domain/connections/ConnectionConfig";
import type { ExtensionCommand } from "./ExtensionCommand";
import type { MySqlConnectionsTreeNode } from "../explorer/MySqlConnectionsTreeNode";
import { Sqlite3SqlTerminalPanel } from "../sql/Sqlite3SqlTerminalPanel";

/**
 * 打开 SQLite3 SQL 终端。
 */
export class OpenSqlite3SqlTerminalCommand implements ExtensionCommand {
  /**
   * 保存 VS Code 命令标识。
   */
  public static readonly id = "ppz-plus.openSqlite3SqlTerminal";

  /**
   * 通过命令契约暴露命令标识。
   */
  public readonly id = OpenSqlite3SqlTerminalCommand.id;

  /**
   * 创建打开 SQLite3 SQL 终端命令。
   *
   * @param sqlite3SqlTerminalPanel 用于渲染 SQL 终端的面板管理器。
   */
  public constructor(private readonly sqlite3SqlTerminalPanel: Sqlite3SqlTerminalPanel) {}

  /**
   * 向 VS Code 注册命令。
   *
   * @returns {vscode.Disposable} 命令注册的可释放句柄。
   */
  public register(): vscode.Disposable {
    return vscode.commands.registerCommand(
      this.id,
      async (node?: MySqlConnectionsTreeNode, initialSql?: string) => {
        await this.sqlite3SqlTerminalPanel.open(this.resolveInitialConnection(node), initialSql);
      },
    );
  }

  /**
   * 从 Tree 节点解析 SQL 终端初始连接。
   *
   * @param {MySqlConnectionsTreeNode} node 可选的数据库 Tree 节点。
   * @returns {Sqlite3ConnectionConfig | undefined} 初始选中的 SQLite3 连接。
   */
  private resolveInitialConnection(
    node?: MySqlConnectionsTreeNode,
  ): Sqlite3ConnectionConfig | undefined {
    if (!node) {
      return undefined;
    }

    return node.connection.engine === "sqlite3" ? node.connection : undefined;
  }
}
