import * as vscode from 'vscode';

import type { ListSqlExportTaskLogsUseCase } from '../../application/useCases/ListSqlExportTaskLogsUseCase';
import type { SqlExportTaskLogEntry } from '../../domain/export/SqlExportTaskLog';
import type { ExtensionCommand } from './ExtensionCommand';

/**
 * 展示最近 SQL 导出任务日志。
 */
export class ShowSqlExportTaskLogsCommand implements ExtensionCommand {
	/**
	 * 保存 VS Code 命令标识。
	 */
	public static readonly id = 'ppz-plus.showSqlExportTaskLogs';

	/**
	 * 通过命令契约暴露命令标识。
	 */
	public readonly id = ShowSqlExportTaskLogsCommand.id;

	/**
	 * 创建 SQL 导出任务日志展示命令。
	 *
	 * @param listSqlExportTaskLogsUseCase 用于读取最近导出任务日志的用例。
	 */
	public constructor(
		private readonly listSqlExportTaskLogsUseCase: ListSqlExportTaskLogsUseCase
	) {}

	/**
	 * 向 VS Code 注册命令。
	 *
	 * @returns 命令注册的可释放句柄。
	 */
	public register(): vscode.Disposable {
		return vscode.commands.registerCommand(this.id, async () => {
			const logs = await this.listSqlExportTaskLogsUseCase.execute();
			const document = await vscode.workspace.openTextDocument({
				content: this.renderLogs(logs),
				language: 'markdown',
			});

			await vscode.window.showTextDocument(document, {
				preview: false,
			});
		});
	}

	/**
	 * 将导出任务日志渲染为 Markdown 文档。
	 *
	 * @param logs 最近的导出任务日志。
	 * @returns Markdown 日志文本。
	 */
	private renderLogs(logs: readonly SqlExportTaskLogEntry[]): string {
		if (logs.length === 0) {
			return [
				'# PPZ Plus SQL Export Logs',
				'',
				'No SQL export task logs yet.',
			].join('\n');
		}

		return [
			'# PPZ Plus SQL Export Logs',
			'',
			`Total recent logs: ${logs.length}`,
			'',
			...logs.flatMap((log) => this.renderLogEntry(log)),
		].join('\n');
	}

	/**
	 * 渲染单条导出任务日志。
	 *
	 * @param log 导出任务日志。
	 * @returns Markdown 片段。
	 */
	private renderLogEntry(log: SqlExportTaskLogEntry): readonly string[] {
		const status = log.status === 'success' ? 'Success' : 'Failure';
		return [
			`## ${status}: ${log.targetName}`,
			'',
			`- Engine: ${log.engine}`,
			`- Connection: ${log.connectionName}`,
			`- Target: ${log.targetType}`,
			`- Kind: ${log.kind}`,
			`- Started: ${log.startedAt}`,
			`- Ended: ${log.endedAt}`,
			`- Duration: ${log.durationMs} ms`,
			...(log.filePath ? [`- File: ${log.filePath}`] : []),
			...(log.errorMessage ? [`- Error: ${log.errorMessage}`] : []),
			'',
		];
	}
}
