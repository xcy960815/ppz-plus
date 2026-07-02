import * as vscode from "vscode";

import type { ExtensionActivationParticipant } from "../bootstrap/ExtensionActivationParticipant";
import { DatabaseConnectionsTreeDataProvider } from "./DatabaseConnectionsTreeDataProvider";

/**
 * 激活数据库连接资源视图。
 */
export class DatabaseConnectionsView implements ExtensionActivationParticipant {
  /**
   * 创建资源视图激活参与者。
   *
   * @param treeDataProvider 数据库连接视图使用的 Tree 数据提供者。
   */
  public constructor(private readonly treeDataProvider: DatabaseConnectionsTreeDataProvider) {}

  /**
   * 为当前扩展会话激活数据库资源树。
   *
   * @param {vscode.ExtensionContext} context VS Code 扩展生命周期上下文。
   */
  public activate(context: vscode.ExtensionContext): void {
    const treeView = vscode.window.createTreeView(DatabaseConnectionsTreeDataProvider.viewId, {
      showCollapseAll: true,
      treeDataProvider: this.treeDataProvider,
    });

    context.subscriptions.push(treeView);
  }
}
