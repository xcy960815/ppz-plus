import * as vscode from 'vscode';

import type { ExtensionCommand } from './ExtensionCommand';
import { TestStoredMySqlConnectionCommand } from './TestStoredMySqlConnectionCommand';
import type { MySqlConnectionTreeNode } from '../explorer/MySqlConnectionsTreeNode';

/**
 * 为 SQLite3 专属视图提供连接测试命令别名。
 */
export class TestStoredSqlite3ConnectionCommand implements ExtensionCommand {
	/**
	 * 保存 VS Code 命令标识。
	 */
	public static readonly id = 'ppz-plus.testStoredSqlite3Connection';

	/**
	 * 通过命令契约暴露命令标识。
	 */
	public readonly id = TestStoredSqlite3ConnectionCommand.id;

	/**
	 * 向 VS Code 注册命令。
	 *
	 * @returns {vscode.Disposable} 命令注册的可释放句柄。
	 */
	public register(): vscode.Disposable {
		return vscode.commands.registerCommand(
			this.id,
			async (treeNode?: MySqlConnectionTreeNode) => {
				await vscode.commands.executeCommand(
					TestStoredMySqlConnectionCommand.id,
					treeNode
				);
			}
		);
	}
}
