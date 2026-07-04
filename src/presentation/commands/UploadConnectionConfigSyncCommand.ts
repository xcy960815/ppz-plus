import * as vscode from "vscode";

import type { UploadConnectionConfigSyncUseCase } from "../../application/useCases/UploadConnectionConfigSyncUseCase";
import type { ExtensionCommand } from "./ExtensionCommand";
import { showUserErrorMessage } from "./UserErrorPresenter";

/**
 * 上传加密连接配置到 VS Code 账号同步。
 */
export class UploadConnectionConfigSyncCommand implements ExtensionCommand {
  /**
   * 保存 VS Code 命令标识。
   */
  public static readonly id = "ppz-plus.uploadConnectionConfig";

  /**
   * 通过命令契约暴露命令标识。
   */
  public readonly id = UploadConnectionConfigSyncCommand.id;

  /**
   * 创建连接配置上传命令。
   *
   * @param uploadConnectionConfigSyncUseCase 上传连接同步载荷的用例。
   */
  public constructor(
    private readonly uploadConnectionConfigSyncUseCase: UploadConnectionConfigSyncUseCase,
  ) {}

  /**
   * 向 VS Code 注册命令。
   *
   * @returns {vscode.Disposable} 命令注册的可释放句柄。
   */
  public register(): vscode.Disposable {
    return vscode.commands.registerCommand(this.id, async () => {
      const syncKey = await vscode.window.showInputBox({
        title: "PPZ Plus: 上传连接配置到 VS Code 账号",
        prompt: "输入连接同步密钥。密码会先用该密钥加密，再写入 VS Code Settings Sync。",
        placeHolder: "连接同步密钥",
        password: true,
        ignoreFocusOut: true,
        validateInput: (value) => (value.trim().length === 0 ? "同步密钥不能为空。" : undefined),
      });

      const normalizedSyncKey = syncKey?.trim();
      if (!normalizedSyncKey) {
        return;
      }

      try {
        const result = await this.uploadConnectionConfigSyncUseCase.execute(normalizedSyncKey);
        await vscode.window.showInformationMessage(
          `已上传 ${result.uploadedCount} 个连接配置到 VS Code 账号同步，${result.encryptedPasswordCount} 个密码已加密。同步密钥不会上传。`,
        );
      } catch (error) {
        await showUserErrorMessage({
          operation: "上传连接配置到 VS Code 账号",
          error,
        });
      }
    });
  }
}
