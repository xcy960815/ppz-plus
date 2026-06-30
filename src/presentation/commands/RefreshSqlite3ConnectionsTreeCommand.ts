import * as vscode from "vscode";

import type { ExtensionCommand } from "./ExtensionCommand";
import { MySqlConnectionsTreeDataProvider } from "../explorer/MySqlConnectionsTreeDataProvider";
import { Sqlite3ConnectionsTreeDataProvider } from "../explorer/Sqlite3ConnectionsTreeDataProvider";

/**
 * 刷新 SQLite3 连接资源树。
 */
export class RefreshSqlite3ConnectionsTreeCommand implements ExtensionCommand {
  /**
   * 保存 VS Code 命令标识。
   */
  public static readonly id = "ppz-plus.refreshSqlite3ConnectionsTree";

  /**
   * 通过命令契约暴露命令标识。
   */
  public readonly id = RefreshSqlite3ConnectionsTreeCommand.id;

  /**
   * 创建刷新 SQLite3 资源树命令。
   *
   * @param databaseTreeDataProvider 混合数据库连接树。
   * @param sqlite3TreeDataProvider SQLite3 专属连接树。
   */
  public constructor(
    private readonly databaseTreeDataProvider: MySqlConnectionsTreeDataProvider,
    private readonly sqlite3TreeDataProvider: Sqlite3ConnectionsTreeDataProvider,
  ) {}

  /**
   * 向 VS Code 注册命令。
   *
   * @returns {vscode.Disposable} 命令注册的可释放句柄。
   */
  public register(): vscode.Disposable {
    return vscode.commands.registerCommand(this.id, () => {
      this.databaseTreeDataProvider.refresh();
      this.sqlite3TreeDataProvider.refresh();
    });
  }
}
