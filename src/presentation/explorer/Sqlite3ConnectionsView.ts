import * as vscode from "vscode";

import type { ExtensionActivationParticipant } from "../bootstrap/ExtensionActivationParticipant";
import { Sqlite3ConnectionsTreeDataProvider } from "./Sqlite3ConnectionsTreeDataProvider";

/**
 * 激活 SQLite3 连接资源视图。
 */
export class Sqlite3ConnectionsView implements ExtensionActivationParticipant {
  /**
   * 创建 SQLite3 资源视图激活参与者。
   *
   * @param treeDataProvider SQLite3 连接视图使用的 Tree 数据提供者。
   */
  public constructor(private readonly treeDataProvider: Sqlite3ConnectionsTreeDataProvider) {}

  /**
   * 为当前扩展会话激活 SQLite3 资源树。
   *
   * @param {vscode.ExtensionContext} context VS Code 扩展生命周期上下文。
   */
  public activate(context: vscode.ExtensionContext): void {
    const treeView = vscode.window.createTreeView(Sqlite3ConnectionsTreeDataProvider.viewId, {
      showCollapseAll: true,
      treeDataProvider: this.treeDataProvider,
    });

    context.subscriptions.push(treeView);
  }
}
