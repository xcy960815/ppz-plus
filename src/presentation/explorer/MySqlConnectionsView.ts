import * as vscode from "vscode";

import type { ExtensionActivationParticipant } from "../bootstrap/ExtensionActivationParticipant";
import { MySqlConnectionsTreeDataProvider } from "./MySqlConnectionsTreeDataProvider";

/**
 * 激活 MySQL 连接资源视图。
 */
export class MySqlConnectionsView implements ExtensionActivationParticipant {
  /**
   * 创建资源视图激活参与者。
   *
   * @param treeDataProvider MySQL 连接视图使用的 Tree 数据提供者。
   */
  public constructor(private readonly treeDataProvider: MySqlConnectionsTreeDataProvider) {}

  /**
   * 为当前扩展会话激活 MySQL 资源树。
   *
   * @param {vscode.ExtensionContext} context VS Code 扩展生命周期上下文。
   */
  public activate(context: vscode.ExtensionContext): void {
    const treeView = vscode.window.createTreeView(MySqlConnectionsTreeDataProvider.viewId, {
      showCollapseAll: true,
      treeDataProvider: this.treeDataProvider,
    });

    context.subscriptions.push(treeView);
  }
}
