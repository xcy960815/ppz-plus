import * as vscode from 'vscode';

import type { MysqlConnectionConfig } from '../../domain/connections/ConnectionConfig';
import type { ExtensionCommand } from './ExtensionCommand';
import type { MySqlConnectionsTreeNode } from '../explorer/MySqlConnectionsTreeNode';
import { MySqlSqlTerminalPanel } from '../sql/MySqlSqlTerminalPanel';

/**
 * 打开 MySQL SQL Terminal。
 */
export class OpenMySqlSqlTerminalCommand implements ExtensionCommand {
	/**
	 * 保存 VS Code 命令标识。
	 */
	public static readonly id = 'ppz-plus.openMySqlSqlTerminal';

	/**
	 * 通过命令契约暴露命令标识。
	 */
	public readonly id = OpenMySqlSqlTerminalCommand.id;

	/**
	 * 创建打开 MySQL SQL Terminal 命令。
	 *
	 * @param mySqlSqlTerminalPanel 用于渲染 SQL Terminal 的面板管理器。
	 */
	public constructor(
		private readonly mySqlSqlTerminalPanel: MySqlSqlTerminalPanel
	) {}

	/**
	 * 向 VS Code 注册命令。
	 *
	 * @returns 命令注册的可释放句柄。
	 */
	public register(): vscode.Disposable {
		return vscode.commands.registerCommand(
			this.id,
			async (node?: MySqlConnectionsTreeNode) => {
				await this.mySqlSqlTerminalPanel.open(
					this.resolveInitialConnection(node)
				);
			}
		);
	}

	/**
	 * 从 Tree 节点解析 SQL Terminal 初始连接。
	 *
	 * @param node 可选的 MySQL Tree 节点。
	 * @returns 初始选中的 MySQL 连接。
	 */
	private resolveInitialConnection(
		node?: MySqlConnectionsTreeNode
	): MysqlConnectionConfig | undefined {
		if (!node) {
			return undefined;
		}

		return node.connection;
	}
}
