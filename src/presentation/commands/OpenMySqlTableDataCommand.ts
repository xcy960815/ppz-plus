import * as vscode from 'vscode';

import type { ExtensionCommand } from './ExtensionCommand';
import type { MySqlTableTreeNode } from '../explorer/MySqlConnectionsTreeNode';
import { MySqlTableDataPanel } from '../tableData/MySqlTableDataPanel';

/**
 * 为选中的 MySQL 表节点打开只读数据页。
 */
export class OpenMySqlTableDataCommand implements ExtensionCommand {
	/**
	 * 保存 VS Code 命令标识。
	 */
	public static readonly id = 'ppz-plus.openMySqlTableData';

	/**
	 * 通过命令契约暴露命令标识。
	 */
	public readonly id = OpenMySqlTableDataCommand.id;

	/**
	 * 创建打开表数据命令。
	 *
	 * @param mySqlTableDataPanel 用于渲染表数据的面板管理器。
	 */
	public constructor(
		private readonly mySqlTableDataPanel: MySqlTableDataPanel
	) {}

	/**
	 * 向 VS Code 注册命令。
	 *
	 * @returns 命令注册的可释放句柄。
	 */
	public register(): vscode.Disposable {
		return vscode.commands.registerCommand(
			this.id,
			async (tableNode?: MySqlTableTreeNode) => {
				if (!tableNode || tableNode.kind !== 'table') {
					await vscode.window.showInformationMessage(
						'Choose a MySQL table node to open its read-only data page.'
					);
					return;
				}

				await this.mySqlTableDataPanel.open(tableNode);
			}
		);
	}
}
