import * as vscode from 'vscode';

import type { ExtensionCommand } from './ExtensionCommand';
import { MySqlConnectionsTreeDataProvider } from '../explorer/MySqlConnectionsTreeDataProvider';

/**
 * 刷新 MySQL 连接资源树。
 */
export class RefreshMySqlConnectionsTreeCommand implements ExtensionCommand {
	/**
	 * 保存 VS Code 命令标识。
	 */
	public static readonly id = 'ppz-plus.refreshMySqlConnectionsTree';

	/**
	 * 通过命令契约暴露命令标识。
	 */
	public readonly id = RefreshMySqlConnectionsTreeCommand.id;

	/**
	 * 创建刷新资源树命令。
	 *
	 * @param treeDataProvider 命令触发刷新的 Tree 数据提供者。
	 */
	public constructor(
		private readonly treeDataProvider: MySqlConnectionsTreeDataProvider
	) {}

	/**
	 * 向 VS Code 注册命令。
	 *
	 * @returns {vscode.Disposable} 命令注册的可释放句柄。
	 */
	public register(): vscode.Disposable {
		return vscode.commands.registerCommand(this.id, () => {
			this.treeDataProvider.refresh();
		});
	}
}
