import type * as vscode from "vscode";

/**
 * 定义可在启动阶段注册的 VS Code 命令。
 */
export interface ExtensionCommand {
  readonly id: string;

  /**
   * 将命令注册到 VS Code 命令服务。
   *
   * @returns {vscode.Disposable} 注册产生的可释放句柄。
   */
  register(): vscode.Disposable;
}
