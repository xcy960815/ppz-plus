import * as vscode from "vscode";

import type { ClearPpzStateUseCase } from "../../application/useCases/ClearPpzStateUseCase";
import { MySqlConnectionsTreeDataProvider } from "../explorer/MySqlConnectionsTreeDataProvider";
import { Sqlite3ConnectionsTreeDataProvider } from "../explorer/Sqlite3ConnectionsTreeDataProvider";
import type { ExtensionCommand } from "./ExtensionCommand";
import { showUserErrorMessage } from "./UserErrorPresenter";

/**
 * 清空 PPZ Plus 本地状态。
 */
export class ClearPpzStateCommand implements ExtensionCommand {
  /**
   * 保存 VS Code 命令标识。
   */
  public static readonly id = "ppz-plus.clearPpzState";

  /**
   * 通过命令契约暴露命令标识。
   */
  public readonly id = ClearPpzStateCommand.id;

  /**
   * 创建清空状态命令。
   *
   * @param clearPpzStateUseCase 用于清空本地状态的用例。
   * @param databaseTreeDataProvider 用于刷新混合数据库连接树。
   * @param sqlite3TreeDataProvider 用于刷新 SQLite3 连接树。
   */
  public constructor(
    private readonly clearPpzStateUseCase: ClearPpzStateUseCase,
    private readonly databaseTreeDataProvider: MySqlConnectionsTreeDataProvider,
    private readonly sqlite3TreeDataProvider: Sqlite3ConnectionsTreeDataProvider,
  ) {}

  /**
   * 向 VS Code 注册命令。
   *
   * @returns 命令注册的可释放句柄。
   */
  public register(): vscode.Disposable {
    return vscode.commands.registerCommand(this.id, async () => {
      const confirmation = await vscode.window.showWarningMessage(
        "确定清空 PPZ Plus 的所有连接配置和导出日志？此操作不可恢复。",
        { modal: true },
        "清空",
      );

      if (confirmation !== "清空") {
        return;
      }

      try {
        await this.clearPpzStateUseCase.execute();
        this.databaseTreeDataProvider.refresh();
        this.sqlite3TreeDataProvider.refresh();
        await vscode.window.showInformationMessage("已清空 PPZ Plus。");
      } catch (error) {
        await showUserErrorMessage({
          operation: "清空 PPZ Plus",
          error,
        });
      }
    });
  }
}
