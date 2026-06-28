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
			title: `PPZ Plus: Test MySQL Connection "${connection.name}"`,
		},
		async (progress) => {
			progress.report({
				message: 'Opening TCP connection...',
				increment: 25,
			});

			await task();

			progress.report({
				message: 'Connection reached.',
				increment: 75,
			});
		}
	);
}
