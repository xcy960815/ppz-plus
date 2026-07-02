import * as vscode from "vscode";

import type { ExtensionCommand } from "./ExtensionCommand";
import type {
  MySqlTableTreeNode,
  PostgreSqlTableTreeNode,
  Sqlite3TableTreeNode,
} from "../explorer/DatabaseConnectionsTreeNode";
import { DatabaseTableDataPanel } from "../tableData/DatabaseTableDataPanel";

/**
 * 表示可以打开表数据页的表节点。
 */
type TableDataTreeNode = MySqlTableTreeNode | PostgreSqlTableTreeNode | Sqlite3TableTreeNode;

/**
 * 为选中的表节点打开数据页。
 */
export class OpenMySqlTableDataCommand implements ExtensionCommand {
  /**
   * 保存 VS Code 命令标识。
   */
  public static readonly id = "ppz-plus.openMySqlTableData";

  /**
   * 通过命令契约暴露命令标识。
   */
  public readonly id = OpenMySqlTableDataCommand.id;

  /**
   * 创建打开表数据命令。
   *
   * @param databaseTableDataPanel 用于渲染表数据的面板管理器。
   */
  public constructor(private readonly databaseTableDataPanel: DatabaseTableDataPanel) {}

  /**
   * 向 VS Code 注册命令。
   *
   * @returns {vscode.Disposable} 命令注册的可释放句柄。
   */
  public register(): vscode.Disposable {
    return vscode.commands.registerCommand(this.id, async (tableNode?: TableDataTreeNode) => {
      if (
        !tableNode ||
        (tableNode.kind !== "table" &&
          tableNode.kind !== "postgresqlTable" &&
          tableNode.kind !== "sqlite3Table")
      ) {
        await vscode.window.showInformationMessage("请选择一个表节点后再打开表数据页。");
        return;
      }

      await this.databaseTableDataPanel.open(tableNode);
    });
  }
}
