import * as vscode from 'vscode';

import type { ExecuteMySqlSqlUseCase } from '../../application/useCases/ExecuteMySqlSqlUseCase';
import type { ListStoredConnectionsUseCase } from '../../application/useCases/ListStoredConnectionsUseCase';
import type {
	ConnectionConfig,
	MysqlConnectionConfig,
} from '../../domain/connections/ConnectionConfig';
import type {
	SqlExecutionCellValue,
	SqlExecutionResult,
} from '../../domain/query/SqlExecutionResult';
import type { MySqlSqlTerminalWebviewMessage } from './MySqlSqlTerminalWebviewMessage';

/**
 * 保存 MySQL SQL Terminal 面板的可变状态。
 */
interface MySqlSqlTerminalPanelState {
	readonly panel: vscode.WebviewPanel;
	selectedConnectionId?: string;
	sql: string;
	result?: SqlExecutionResult;
}

/**
 * 管理 MySQL SQL Terminal 面板。
 */
export class MySqlSqlTerminalPanel {
	/**
	 * 保存当前已打开的 SQL Terminal 面板。
	 */
	private panelState?: MySqlSqlTerminalPanelState;

	/**
	 * 创建 MySQL SQL Terminal 面板管理器。
	 *
	 * @param listStoredConnectionsUseCase 用于列出已保存连接的用例。
	 * @param executeMySqlSqlUseCase 用于执行 MySQL SQL 的用例。
	 */
	public constructor(
		private readonly listStoredConnectionsUseCase: ListStoredConnectionsUseCase,
		private readonly executeMySqlSqlUseCase: ExecuteMySqlSqlUseCase
	) {}

	/**
	 * 打开或显示 MySQL SQL Terminal。
	 *
	 * @param initialConnection 可选的初始选中连接。
	 */
	public async open(initialConnection?: MysqlConnectionConfig): Promise<void> {
		if (this.panelState) {
			this.panelState.panel.reveal(vscode.ViewColumn.Active);
			if (initialConnection) {
				this.panelState.selectedConnectionId = initialConnection.id;
			}
			await this.render(this.panelState);
			return;
		}

		const panel = vscode.window.createWebviewPanel(
			'ppzPlus.mysqlSqlTerminal',
			'MySQL SQL Terminal',
			vscode.ViewColumn.Active,
			{
				enableScripts: true,
				retainContextWhenHidden: true,
			}
		);
		const state: MySqlSqlTerminalPanelState = {
			panel,
			selectedConnectionId: initialConnection?.id,
			sql: '',
		};

		this.panelState = state;
		panel.onDidDispose(() => {
			this.panelState = undefined;
		});
		panel.webview.onDidReceiveMessage(
			async (message: MySqlSqlTerminalWebviewMessage) => {
				await this.handleWebviewMessage(state, message);
			}
		);

		await this.render(state);
	}

	/**
	 * 处理 SQL Terminal Webview 动作。
	 *
	 * @param state 当前面板状态。
	 * @param message Webview 发出的消息。
	 */
	private async handleWebviewMessage(
		state: MySqlSqlTerminalPanelState,
		message: MySqlSqlTerminalWebviewMessage
	): Promise<void> {
		if (message.type !== 'execute') {
			return;
		}

		state.selectedConnectionId = message.connectionId;
		state.sql = message.sql;
		state.result = undefined;
		state.panel.webview.html = await this.renderHtml(state, true);

		const connections = await this.listMySqlConnections();
		const selectedConnection = connections.find(
			(connection) => connection.id === message.connectionId
		);

		if (!selectedConnection) {
			state.result = {
				sql: message.sql,
				success: false,
				isQuery: false,
				fields: [],
				rows: [],
				affectedRows: null,
				durationMs: 0,
				errorMessage: 'Selected MySQL connection was not found.',
			};
			await this.render(state);
			return;
		}

		state.result = await this.executeMySqlSqlUseCase.execute(
			selectedConnection,
			message.sql
		);
		await this.render(state);
	}

	/**
	 * 渲染当前 SQL Terminal 面板。
	 *
	 * @param state 当前面板状态。
	 */
	private async render(state: MySqlSqlTerminalPanelState): Promise<void> {
		state.panel.title = 'MySQL SQL Terminal';
		state.panel.webview.html = await this.renderHtml(state, false);
	}

	/**
	 * 创建 SQL Terminal Webview HTML。
	 *
	 * @param state 当前面板状态。
	 * @param isExecuting 是否正在执行 SQL。
	 * @returns Webview HTML 文档。
	 */
	private async renderHtml(
		state: MySqlSqlTerminalPanelState,
		isExecuting: boolean
	): Promise<string> {
		const connections = await this.listMySqlConnections();
		const selectedConnectionId =
			state.selectedConnectionId ?? connections[0]?.id ?? '';
		const connectionOptions = connections
			.map((connection) => {
				const selected =
					connection.id === selectedConnectionId ? ' selected' : '';
				return `<option value="${this.escapeHtmlAttribute(
					connection.id
				)}"${selected}>${this.escapeHtml(
					this.describeConnection(connection)
				)}</option>`;
			})
			.join('');
		const resultMarkup = state.result
			? this.renderResult(state.result)
			: '<div class="empty-result">No SQL has been executed yet.</div>';
		const disabled = connections.length === 0 || isExecuting ? ' disabled' : '';

		return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8" />
	<meta name="viewport" content="width=device-width, initial-scale=1.0" />
	<title>MySQL SQL Terminal</title>
	<style>
		:root {
			color-scheme: light dark;
		}
		body {
			margin: 0;
			font-family: var(--vscode-font-family);
			background: var(--vscode-editor-background);
			color: var(--vscode-editor-foreground);
		}
		.page {
			padding: 20px 24px 28px;
		}
		.header {
			display: flex;
			justify-content: space-between;
			gap: 16px;
			align-items: flex-start;
			margin-bottom: 16px;
		}
		h1 {
			margin: 0 0 4px;
			font-size: 20px;
		}
		.subtitle,
		.empty-result,
		.meta {
			color: var(--vscode-descriptionForeground);
		}
		.form {
			display: grid;
			gap: 12px;
			margin-bottom: 18px;
		}
		label {
			display: grid;
			gap: 6px;
			font-weight: 600;
		}
		select,
		textarea {
			box-sizing: border-box;
			width: 100%;
			border: 1px solid var(--vscode-input-border, transparent);
			background: var(--vscode-input-background);
			color: var(--vscode-input-foreground);
			font-family: var(--vscode-editor-font-family, var(--vscode-font-family));
		}
		select {
			min-height: 30px;
			padding: 4px 8px;
		}
		textarea {
			min-height: 180px;
			resize: vertical;
			padding: 10px 12px;
			line-height: 1.5;
		}
		button {
			justify-self: start;
			border: 1px solid var(--vscode-button-border, transparent);
			background: var(--vscode-button-background);
			color: var(--vscode-button-foreground);
			padding: 6px 14px;
			cursor: pointer;
		}
		button:disabled {
			opacity: 0.5;
			cursor: default;
		}
		.result-header {
			display: flex;
			flex-wrap: wrap;
			gap: 12px;
			margin-bottom: 12px;
		}
		.result-header strong {
			color: var(--vscode-editor-foreground);
		}
		.error {
			color: var(--vscode-errorForeground);
			white-space: pre-wrap;
		}
		.table-wrapper {
			border: 1px solid var(--vscode-panel-border);
			overflow: auto;
		}
		table {
			width: 100%;
			border-collapse: collapse;
			min-width: 720px;
		}
		th,
		td {
			border-bottom: 1px solid var(--vscode-panel-border);
			padding: 10px 12px;
			text-align: left;
			vertical-align: top;
		}
		th {
			position: sticky;
			top: 0;
			background: var(--vscode-editorGroupHeader-tabsBackground, var(--vscode-editor-background));
			z-index: 1;
		}
		td code {
			font-family: var(--vscode-editor-font-family, var(--vscode-font-family));
			white-space: pre-wrap;
			word-break: break-word;
		}
		.null-cell {
			color: var(--vscode-descriptionForeground);
			font-style: italic;
		}
		.empty-cell {
			text-align: center;
			color: var(--vscode-descriptionForeground);
			padding: 24px;
		}
	</style>
</head>
<body>
	<div class="page">
		<div class="header">
			<div>
				<h1>MySQL SQL Terminal</h1>
				<div class="subtitle">${this.escapeHtml(
					this.describeSelectedConnection(connections, selectedConnectionId)
				)}</div>
			</div>
			<div class="meta">${isExecuting ? 'Executing...' : 'Ready'}</div>
		</div>
		<div class="form">
			<label>
				Connection
				<select id="connection" ${connections.length === 0 ? 'disabled' : ''}>
					${connectionOptions}
				</select>
			</label>
			<label>
				SQL
				<textarea id="sql" spellcheck="false">${this.escapeHtml(state.sql)}</textarea>
			</label>
			<button id="execute" onclick="executeSql()"${disabled}>Execute</button>
		</div>
		${connections.length === 0 ? '<p class="error">No saved MySQL connections.</p>' : ''}
		<section>
			${resultMarkup}
		</section>
	</div>
	<script>
		const vscode = acquireVsCodeApi();
		function executeSql() {
			const connection = document.getElementById('connection');
			const sql = document.getElementById('sql');
			vscode.postMessage({
				type: 'execute',
				connectionId: connection.value,
				sql: sql.value
			});
		}
	</script>
</body>
</html>`;
	}

	/**
	 * 渲染 SQL 执行结果。
	 *
	 * @param result SQL 执行结果。
	 * @returns 结果区域 HTML。
	 */
	private renderResult(result: SqlExecutionResult): string {
		const status = result.success ? 'Success' : 'Failed';
		const affectedRows =
			result.affectedRows === null ? 'N/A' : String(result.affectedRows);
		const resultHeader = `<div class="result-header">
			<span><strong>${status}</strong></span>
			<span><strong>${result.isQuery ? 'Query' : 'Statement'}</strong></span>
			<span><strong>${result.durationMs}</strong> ms</span>
			<span><strong>${affectedRows}</strong> affected rows</span>
			<span><strong>${result.rows.length}</strong> rows</span>
		</div>`;

		if (!result.success) {
			return `${resultHeader}<pre class="error">${this.escapeHtml(
				result.errorMessage ?? 'Unknown SQL execution error.'
			)}</pre>`;
		}

		if (!result.isQuery) {
			return `${resultHeader}<div class="empty-result">Statement executed.</div>`;
		}

		return `${resultHeader}${this.renderResultTable(result)}`;
	}

	/**
	 * 渲染查询结果表格。
	 *
	 * @param result SQL 查询结果。
	 * @returns 表格 HTML。
	 */
	private renderResultTable(result: SqlExecutionResult): string {
		const fields = result.fields;

		if (fields.length === 0) {
			return '<div class="empty-result">No columns returned.</div>';
		}

		const headers = fields
			.map((field) => `<th>${this.escapeHtml(field.name)}</th>`)
			.join('');
		const rows =
			result.rows.length === 0
				? `<tr><td colspan="${fields.length}" class="empty-cell">No rows returned.</td></tr>`
				: result.rows
						.map(
							(row) =>
								`<tr>${fields
									.map((field) => this.renderCell(row[field.name] ?? null))
									.join('')}</tr>`
						)
						.join('');

		return `<div class="table-wrapper">
			<table>
				<thead><tr>${headers}</tr></thead>
				<tbody>${rows}</tbody>
			</table>
		</div>`;
	}

	/**
	 * 渲染单个 SQL 结果单元格。
	 *
	 * @param value 待渲染的单元格值。
	 * @returns HTML 表格单元格标记。
	 */
	private renderCell(value: SqlExecutionCellValue): string {
		if (value === null) {
			return '<td><span class="null-cell">NULL</span></td>';
		}

		return `<td><code>${this.escapeHtml(String(value))}</code></td>`;
	}

	/**
	 * 读取当前保存的 MySQL 连接。
	 *
	 * @returns MySQL 连接配置列表。
	 */
	private async listMySqlConnections(): Promise<readonly MysqlConnectionConfig[]> {
		const connections = await this.listStoredConnectionsUseCase.execute();
		return connections.filter(
			(connection): connection is MysqlConnectionConfig =>
				this.isMySqlConnection(connection)
		);
	}

	/**
	 * 判断连接配置是否为 MySQL 连接。
	 *
	 * @param connection 待检查的连接配置。
	 * @returns 是否为 MySQL 连接。
	 */
	private isMySqlConnection(
		connection: ConnectionConfig
	): connection is MysqlConnectionConfig {
		return connection.engine === 'mysql';
	}

	/**
	 * 为连接选择框创建用户可读描述。
	 *
	 * @param connection MySQL 连接配置。
	 * @returns 连接描述文本。
	 */
	private describeConnection(connection: MysqlConnectionConfig): string {
		if (connection.mode === 'parameters') {
			const database = connection.database ? `/${connection.database}` : '';
			return `${connection.name} (${connection.host}:${connection.port}${database})`;
		}

		return `${connection.name} (${connection.url})`;
	}

	/**
	 * 创建当前选中连接的状态文本。
	 *
	 * @param connections 当前可选的 MySQL 连接。
	 * @param selectedConnectionId 当前选中的连接标识。
	 * @returns 连接状态文本。
	 */
	private describeSelectedConnection(
		connections: readonly MysqlConnectionConfig[],
		selectedConnectionId: string
	): string {
		const selectedConnection = connections.find(
			(connection) => connection.id === selectedConnectionId
		);

		return selectedConnection
			? this.describeConnection(selectedConnection)
			: 'No MySQL connection selected.';
	}

	/**
	 * 转义用户可控文本以便安全渲染 HTML。
	 *
	 * @param value 待转义的文本值。
	 * @returns 转义后的 HTML 字符串。
	 */
	private escapeHtml(value: string): string {
		return value
			.replaceAll('&', '&amp;')
			.replaceAll('<', '&lt;')
			.replaceAll('>', '&gt;')
			.replaceAll('"', '&quot;')
			.replaceAll("'", '&#39;');
	}

	/**
	 * 转义用户可控文本以便安全放入 HTML 属性。
	 *
	 * @param value 待转义的文本值。
	 * @returns 转义后的属性字符串。
	 */
	private escapeHtmlAttribute(value: string): string {
		return this.escapeHtml(value);
	}
}
