import * as vscode from "vscode";

import type { ExtensionCommand } from "./ExtensionCommand";
import { ManageMySqlConnectionsCommand } from "./ManageMySqlConnectionsCommand";
import type { DatabaseConnectionTreeNode } from "../explorer/DatabaseConnectionsTreeNode";

/**
 * 为 SQLite3 专属视图提供连接管理命令别名。
 */
export class ManageSqlite3ConnectionsCommand implements ExtensionCommand {
  /**
   * 保存 VS Code 命令标识。
   */
  public static readonly id = "ppz-plus.manageSqlite3Connections";

  /**
   * 通过命令契约暴露命令标识。
   */
  public readonly id = ManageSqlite3ConnectionsCommand.id;

  /**
   * 向 VS Code 注册命令。
   *
   * @returns {vscode.Disposable} 命令注册的可释放句柄。
   */
  public register(): vscode.Disposable {
    return vscode.commands.registerCommand(this.id, async (treeNode?: DatabaseConnectionTreeNode) => {
      await vscode.commands.executeCommand(ManageMySqlConnectionsCommand.id, treeNode);
    });
  }
}
