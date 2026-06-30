import * as vscode from "vscode";

import type { CancellationSignal } from "../../domain/tasks/CancellationSignal";

/**
 * 将 VS Code 取消令牌适配为跨层取消信号。
 *
 * @param {vscode.CancellationToken} token VS Code 长任务取消令牌。
 * @returns {CancellationSignal} 应用层可读取的取消信号。
 */
export function createVsCodeCancellationSignal(
  token: vscode.CancellationToken,
): CancellationSignal {
  return {
    get isCancellationRequested(): boolean {
      return token.isCancellationRequested;
    },
  };
}

/**
 * 展示用户主动取消长任务的提示。
 *
 * @param {string} taskName 被取消的任务名称。
 */
export async function showTaskCanceledMessage(taskName: string): Promise<void> {
  await vscode.window.showInformationMessage(`已取消${taskName}。`);
}
