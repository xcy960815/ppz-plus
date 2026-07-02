import type * as vscode from "vscode";

import { ExtensionBootstrap } from "./ExtensionBootstrap";
import { createBootstrapCommands } from "./createBootstrapCommands";
import { createBootstrapPresentation } from "./createBootstrapPresentation";
import { createBootstrapServices } from "./createBootstrapServices";

/**
 * 组装初始扩展启动对象图。
 *
 * @param {vscode.ExtensionContext} context VS Code 扩展生命周期上下文。
 * @returns {ExtensionBootstrap} 可用于扩展激活的启动实例。
 */
export function createExtensionBootstrap(context: vscode.ExtensionContext): ExtensionBootstrap {
  const services = createBootstrapServices(context);
  const presentation = createBootstrapPresentation(services);
  return new ExtensionBootstrap(
    createBootstrapCommands(services, presentation),
    [
      presentation.databaseConnectionsView,
      presentation.databaseTableDataPanel,
      presentation.mySqlSqlTerminalPanel,
      presentation.postgreSqlSqlTerminalPanel,
      presentation.sqlite3SqlTerminalPanel,
    ],
  );
}
