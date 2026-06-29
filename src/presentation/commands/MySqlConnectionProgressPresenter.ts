import * as vscode from 'vscode';

import type { MysqlConnectionConfig } from '../../domain/connections/ConnectionConfig';

/**
 * 带 VS Code 进度提示执行 MySQL 连接测试任务。
 *
 * @param connection 需要测试的 MySQL 连接配置。
 * @param task 实际执行连接测试的异步任务。
 */
export async function withMySqlConnectionTestProgress(
	connection: MysqlConnectionConfig,
	task: () => Promise<void>
): Promise<void> {
	await vscode.window.withProgress(
		{
			location: vscode.ProgressLocation.Notification,
			title: `PPZ Plus: 测试 MySQL 连接“${connection.name}”`,
		},
		async (progress) => {
			progress.report({
				message: '正在打开 TCP 连接...',
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
