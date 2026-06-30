import * as vscode from 'vscode';

import type { ConnectionConfig } from '../../domain/connections/ConnectionConfig';

/**
 * 返回连接配置对应的用户可读数据库名称。
 *
 * @param connection 需要展示的连接配置。
 * @returns 数据库引擎展示名称。
 */
export function describeConnectionEngine(connection: ConnectionConfig): string {
	if (connection.engine === 'postgresql') {
		return 'PostgreSQL';
	}

	if (connection.engine === 'sqlite3') {
		return 'SQLite3';
	}

	return 'MySQL';
}

/**
 * 带 VS Code 进度提示执行连接测试任务。
 *
 * @param connection 需要测试的连接配置。
 * @param task 实际执行连接测试的异步任务。
 */
export async function withConnectionTestProgress(
	connection: ConnectionConfig,
	task: () => Promise<void>
): Promise<void> {
	const engineName = describeConnectionEngine(connection);
	await vscode.window.withProgress(
		{
			location: vscode.ProgressLocation.Notification,
			title: `PPZ Plus: 测试 ${engineName} 连接“${connection.name}”`,
		},
		async (progress) => {
			progress.report({
				message:
					connection.engine === 'sqlite3'
						? '正在打开数据库文件...'
						: '正在打开 TCP 连接...',
				increment: 25,
			});

			await task();

			progress.report({
				message: '连接已建立。',
				increment: 75,
			});
		}
	);
}
