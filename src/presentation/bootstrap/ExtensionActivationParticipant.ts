import type * as vscode from "vscode";

/**
 * 定义参与扩展激活流程的表现层组件。
 */
export interface ExtensionActivationParticipant {
  /**
   * 为当前扩展会话激活该参与者。
   *
   * @param {vscode.ExtensionContext} context VS Code 扩展生命周期上下文。
   */
  activate(context: vscode.ExtensionContext): void;
}
