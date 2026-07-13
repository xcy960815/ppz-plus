import * as vscode from "vscode";

import type { MysqlConnectionConfig } from "../../domain/connections/ConnectionConfig";
import type { ExtensionCommand } from "./ExtensionCommand";
import type { DatabaseConnectionsTreeNode } from "../explorer/DatabaseConnectionsTreeNode";
import { MySqlSqlTerminalPanel } from "../sql/MySqlSqlTerminalPanel";

/**
 * 打开 MySQL SQL 终端。
 */
export class OpenMySqlSqlTerminalCommand implements ExtensionCommand {
  /**
   * 保存 VS Code 命令标识。
   */
  public static readonly id = "ppz-plus.openMySqlSqlTerminal";

  /**
   * 通过命令契约暴露命令标识。
   */
  public readonly id = OpenMySqlSqlTerminalCommand.id;

  /**
   * 创建打开 MySQL SQL 终端命令。
   *
   * @param mySqlSqlTerminalPanel 用于渲染 SQL 终端的面板管理器。
   */
  public constructor(private readonly mySqlSqlTerminalPanel: MySqlSqlTerminalPanel) {}

  /**
   * 向 VS Code 注册命令。
   *
   * @returns {vscode.Disposable} 命令注册的可释放句柄。
   */
  public register(): vscode.Disposable {
    return vscode.commands.registerCommand(
      this.id,
      async (node?: DatabaseConnectionsTreeNode, initialSql?: string) => {
        await this.mySqlSqlTerminalPanel.open(
          resolveMySqlSqlTerminalInitialConnection(node),
          initialSql ?? resolveMySqlSqlTerminalInitialSql(node),
        );
      },
    );
  }
}

/**
 * 从 Tree 节点解析 MySQL SQL 终端初始连接。
 *
 * @param {DatabaseConnectionsTreeNode} node 可选的数据库 Tree 节点。
 * @returns {MysqlConnectionConfig | undefined} 初始选中的 MySQL 连接。
 */
export function resolveMySqlSqlTerminalInitialConnection(
  node?: DatabaseConnectionsTreeNode,
): MysqlConnectionConfig | undefined {
  if (!node) {
    return undefined;
  }

  return node.connection.engine === "mysql" ? node.connection : undefined;
}

/**
 * 从 Tree 节点生成 MySQL SQL 终端初始文本。
 *
 * @param {DatabaseConnectionsTreeNode} node 可选的数据库 Tree 节点。
 * @returns {string | undefined} 适合当前节点的 SQL 模板。
 */
export function resolveMySqlSqlTerminalInitialSql(
  node?: DatabaseConnectionsTreeNode,
): string | undefined {
  if (!node || node.connection.engine !== "mysql") {
    return undefined;
  }

  if (node.kind === "schema") {
    return `USE ${quoteMySqlIdentifier(node.schemaName)};\n\n`;
  }

  if (node.kind === "table") {
    return [
      `USE ${quoteMySqlIdentifier(node.schemaName)};`,
      "",
      `ALTER TABLE ${quoteMySqlIdentifier(node.tableName)}`,
      "  -- MODIFY COLUMN `<column_name>` VARCHAR(255) NULL;",
    ].join("\n");
  }

  return undefined;
}

/**
 * 转义 MySQL 标识符并包裹反引号。
 *
 * @param {string} identifier 原始 MySQL 标识符。
 * @returns {string} 可嵌入 SQL 的反引号标识符。
 */
function quoteMySqlIdentifier(identifier: string): string {
  return `\`${identifier.replaceAll("`", "``")}\``;
}
