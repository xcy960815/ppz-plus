import * as vscode from "vscode";

import type { PullConnectionConfigSyncUseCase } from "../../application/useCases/PullConnectionConfigSyncUseCase";
import { DatabaseConnectionsTreeDataProvider } from "../explorer/DatabaseConnectionsTreeDataProvider";
import { Sqlite3ConnectionsTreeDataProvider } from "../explorer/Sqlite3ConnectionsTreeDataProvider";
import type { ExtensionCommand } from "./ExtensionCommand";
import { showUserErrorMessage } from "./UserErrorPresenter";

/**
 * 从 VS Code 账号同步拉取加密连接配置。
 */
export class PullConnectionConfigSyncCommand implements ExtensionCommand {
  /**
   * 保存 VS Code 命令标识。
   */
  public static readonly id = "ppz-plus.pullConnectionConfig";

  /**
   * 通过命令契约暴露命令标识。
   */
  public readonly id = PullConnectionConfigSyncCommand.id;

  /**
   * 创建连接配置拉取命令。
   *
   * @param pullConnectionConfigSyncUseCase 拉取连接同步载荷的用例。
   * @param databaseTreeDataProvider 用于刷新混合数据库连接树。
   * @param sqlite3TreeDataProvider 用于刷新 SQLite3 连接树。
   */
  public constructor(
    private readonly pullConnectionConfigSyncUseCase: PullConnectionConfigSyncUseCase,
    private readonly databaseTreeDataProvider: DatabaseConnectionsTreeDataProvider,
    private readonly sqlite3TreeDataProvider: Sqlite3ConnectionsTreeDataProvider,
  ) {}

  /**
   * 向 VS Code 注册命令。
   *
   * @returns {vscode.Disposable} 命令注册的可释放句柄。
   */
  public register(): vscode.Disposable {
    return vscode.commands.registerCommand(this.id, async () => {
      const syncKey = await vscode.window.showInputBox({
        title: "PPZ Plus: 从 VS Code 账号拉取连接配置",
        prompt: "输入上传时使用的连接同步密钥。拉取后密码会在本机解密并写入 SecretStorage。",
        placeHolder: "连接同步密钥",
        password: true,
        ignoreFocusOut: true,
        validateInput: (value) => (value.trim().length === 0 ? "同步密钥不能为空。" : undefined),
      });

      const normalizedSyncKey = syncKey?.trim();
      if (!normalizedSyncKey) {
        return;
      }

      const confirmation = await vscode.window.showWarningMessage(
        "将按连接 ID 合并 VS Code 账号同步中的连接配置。密文密码会用当前密钥解密后保存到本机安全存储。",
        { modal: true },
        "拉取",
      );

      if (confirmation !== "拉取") {
        return;
      }

      try {
        const result = await this.pullConnectionConfigSyncUseCase.execute(normalizedSyncKey);
        this.databaseTreeDataProvider.refresh();
        this.sqlite3TreeDataProvider.refresh();
        await vscode.window.showInformationMessage(this.formatResultMessage(result));
      } catch (error) {
        await showUserErrorMessage({
          operation: "从 VS Code 账号拉取连接配置",
          error,
        });
      }
    });
  }

  /**
   * 格式化拉取结果提示。
   *
   * @param result 拉取连接配置的合并结果。
   * @returns {string} 用户可读提示。
   */
  private formatResultMessage(result: {
    readonly remoteCount: number;
    readonly createdCount: number;
    readonly updatedCount: number;
    readonly decryptedPasswordCount: number;
    readonly missingLocalPasswordCount: number;
  }): string {
    const passwordHint =
      result.missingLocalPasswordCount > 0
        ? `，${result.missingLocalPasswordCount} 个连接缺少本机密码，使用时会提示补录`
        : "";

    return `已拉取 ${result.remoteCount} 个连接配置，新增 ${result.createdCount} 个，更新 ${result.updatedCount} 个，解密 ${result.decryptedPasswordCount} 个密码${passwordHint}。`;
  }
}
