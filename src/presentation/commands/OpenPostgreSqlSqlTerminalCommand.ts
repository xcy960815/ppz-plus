import * as vscode from 'vscode';

import type { PostgreSqlConnectionConfig } from '../../domain/connections/ConnectionConfig';
import type { ExtensionCommand } from './ExtensionCommand';
import type { MySqlConnectionsTreeNode } from '../explorer/MySqlConnectionsTreeNode';
import { PostgreSqlSqlTerminalPanel } from '../sql/PostgreSqlSqlTerminalPanel';

/**
 * 打开 PostgreSQL SQL 终端。
 */
export class OpenPostgreSqlSqlTerminalCommand implements ExtensionCommand {
	/**
	 * 保存 VS Code 命令标识。
	 */
	public static readonly id = 'ppz-plus.openPostgreSqlSqlTerminal';

	/**
	 * 通过命令契约暴露命令标识。
	 */
	public readonly id = OpenPostgreSqlSqlTerminalCommand.id;

	/**
	 * 创建打开 PostgreSQL SQL 终端命令。
	 *
	 * @param postgreSqlSqlTerminalPanel 用于渲染 SQL 终端的面板管理器。
	 */
	public constructor(
		private readonly postgreSqlSqlTerminalPanel: PostgreSqlSqlTerminalPanel
	) {}

	/**
	 * 向 VS Code 注册命令。
	 *
	 * @returns {vscode.Disposable} 命令注册的可释放句柄。
	 */
	public register(): vscode.Disposable {
		return vscode.commands.registerCommand(
			this.id,
			async (node?: MySqlConnectionsTreeNode, initialSql?: string) => {
				const initialTarget = this.resolveInitialTarget(node);
				await this.postgreSqlSqlTerminalPanel.open(
					initialTarget?.connection,
					initialTarget?.databaseName,
					initialSql
				);
			}
		);
	}

	/**
	 * 从 Tree 节点解析 SQL 终端初始目标。
	 *
	 * @param {MySqlConnectionsTreeNode} node 可选的数据库 Tree 节点。
	 * @returns {|} 初始选中的 PostgreSQL 连接和 database。
	 */
	private resolveInitialTarget(
		node?: MySqlConnectionsTreeNode
	):
		| {
				readonly connection: PostgreSqlConnectionConfig;
				readonly databaseName?: string;
		  }
		| undefined {
		if (!node) {
			return undefined;
		}

		if (node.kind === 'connection') {
			return node.connection.engine === 'postgresql'
				? { connection: node.connection }
				: undefined;
		}

		if (node.kind === 'postgresqlDatabase') {
			return {
				connection: node.connection,
				databaseName: node.databaseName,
			};
		}

		if (node.kind === 'postgresqlSchema') {
			return {
				connection: node.connection,
				databaseName: node.databaseName,
			};
		}

		if (node.kind === 'postgresqlTable') {
			return {
				connection: node.connection,
				databaseName: node.databaseName,
			};
		}

		return undefined;
	}
}
