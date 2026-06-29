import * as vscode from 'vscode';

import type { ExecuteMySqlSqlUseCase } from '../../application/useCases/ExecuteMySqlSqlUseCase';
import type { ListStoredConnectionsUseCase } from '../../application/useCases/ListStoredConnectionsUseCase';
import type {
	ConnectionConfig,
	MysqlConnectionConfig,
} from '../../domain/connections/ConnectionConfig';
import type { SqlExecutionResult } from '../../domain/query/SqlExecutionResult';
import type { ExtensionActivationParticipant } from '../bootstrap/ExtensionActivationParticipant';
import { SqlExecutionResultRenderer } from './SqlExecutionResultRenderer';
import type { MySqlSqlTerminalWebviewMessage } from './MySqlSqlTerminalWebviewMessage';

/**
 * 保存 MySQL SQL 终端面板的可变状态。
 */
interface MySqlSqlTerminalPanelState {
	readonly panel: vscode.WebviewPanel;
	selectedConnectionId?: string;
	sql: string;
	result?: SqlExecutionResult;
}

/**
 * 保存 MySQL SQL 终端可由 VS Code 恢复的轻量状态。
 */
interface MySqlSqlTerminalSerializedState {
	readonly selectedConnectionId?: string;
	readonly sql: string;
}

/**
 * 管理 MySQL SQL 终端面板。
 */
export class MySqlSqlTerminalPanel
	implements ExtensionActivationParticipant, vscode.WebviewPanelSerializer
{
	/**
	 * 保存 SQL 终端 Webview 的 VS Code viewType。
	 */
	private static readonly viewType = 'ppzPlus.mysqlSqlTerminal';

	/**
	 * 渲染通用 SQL 执行结果区域。
	 */
	private readonly resultRenderer = new SqlExecutionResultRenderer();

	/**
	 * 保存当前已打开的 SQL 终端面板。
	 */
	private panelState?: MySqlSqlTerminalPanelState;

	/**
	 * 创建 MySQL SQL 终端面板管理器。
	 *
	 * @param listStoredConnectionsUseCase 用于列出已保存连接的用例。
	 * @param executeMySqlSqlUseCase 用于执行 MySQL SQL 的用例。
	 */
	public constructor(
		private readonly listStoredConnectionsUseCase: ListStoredConnectionsUseCase,
		private readonly executeMySqlSqlUseCase: ExecuteMySqlSqlUseCase
	) {}

	/**
	 * 注册 SQL 终端 Webview 恢复器。
	 *
	 * @param context VS Code 扩展生命周期上下文。
	 */
	public activate(context: vscode.ExtensionContext): void {
		context.subscriptions.push(
			vscode.window.registerWebviewPanelSerializer(
				MySqlSqlTerminalPanel.viewType,
				this
			)
		);
	}

	/**
	 * 从 VS Code 保存的 Webview 状态恢复 SQL 终端面板。
	 *
	 * @param panel VS Code 恢复出来的 Webview 面板。
	 * @param serializedState Webview 前端保存的轻量状态。
	 */
	public async deserializeWebviewPanel(
		panel: vscode.WebviewPanel,
		serializedState: unknown
	): Promise<void> {
		panel.webview.options = {
			enableScripts: true,
		};
		const restoredState = this.parseSerializedState(serializedState);
		const state: MySqlSqlTerminalPanelState = {
			panel,
			selectedConnectionId: restoredState.selectedConnectionId,
			sql: restoredState.sql,
		};

		this.panelState = state;
		this.registerPanelHandlers(state);
		await this.render(state);
	}

	/**
	 * 打开或显示 MySQL SQL 终端。
	 *
	 * @param initialConnection 可选的初始选中连接。
	 * @param initialSql 可选的初始 SQL 文本。
	 */
	public async open(
		initialConnection?: MysqlConnectionConfig,
		initialSql?: string
	): Promise<void> {
		if (this.panelState) {
			this.panelState.panel.reveal(vscode.ViewColumn.Active);
			if (initialConnection) {
				this.panelState.selectedConnectionId = initialConnection.id;
			}
			if (initialSql !== undefined) {
				this.panelState.sql = initialSql;
				this.panelState.result = undefined;
			}
			await this.render(this.panelState);
			return;
		}

		const panel = vscode.window.createWebviewPanel(
			MySqlSqlTerminalPanel.viewType,
			'MySQL SQL 终端',
			vscode.ViewColumn.Active,
			{
				enableScripts: true,
				retainContextWhenHidden: true,
			}
		);
		const state: MySqlSqlTerminalPanelState = {
			panel,
			selectedConnectionId: initialConnection?.id,
			sql: initialSql ?? '',
		};

		this.panelState = state;
		this.registerPanelHandlers(state);

		await this.render(state);
	}

	/**
	 * 为 SQL 终端面板注册生命周期和消息处理。
	 *
	 * @param state 当前面板状态。
	 */
	private registerPanelHandlers(state: MySqlSqlTerminalPanelState): void {
		state.panel.onDidDispose(() => {
			if (this.panelState?.panel === state.panel) {
				this.panelState = undefined;
			}
		});
		state.panel.webview.onDidReceiveMessage(
			async (message: MySqlSqlTerminalWebviewMessage) => {
				await this.handleWebviewMessage(state, message);
			}
		);
	}

	/**
	 * 处理 SQL 终端 Webview 动作。
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
				resultSets: [],
				errorMessage: '未找到已选择的 MySQL 连接。',
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
	 * 渲染当前 SQL 终端面板。
	 *
	 * @param state 当前面板状态。
	 */
	private async render(state: MySqlSqlTerminalPanelState): Promise<void> {
		state.panel.title = 'MySQL SQL 终端';
		state.panel.webview.html = await this.renderHtml(state, false);
	}

	/**
	 * 创建 SQL 终端 Webview HTML。
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
			? this.resultRenderer.render(state.result)
			: '<div class="empty-result">尚未执行 SQL。</div>';
		const disabled = connections.length === 0 || isExecuting ? ' disabled' : '';
		const serializedState = this.serializeScriptValue({
			selectedConnectionId,
			sql: state.sql,
		} satisfies MySqlSqlTerminalSerializedState);

		return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
	<meta charset="UTF-8" />
	<meta name="viewport" content="width=device-width, initial-scale=1.0" />
	<title>MySQL SQL 终端</title>
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
			padding: 1em;
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
			height: 8em;
			min-height: 8em;
			resize: vertical;
			padding: .5em 1.1em;
			line-height: 1.5em;
			background: transparent;
			border: 1px solid var(--vscode-input-border, var(--vscode-panel-border));
			outline: none;
		}
		textarea:hover {
			border-color: var(--vscode-focusBorder);
		}
		textarea:focus {
			border-color: var(--vscode-focusBorder);
		}
		button {
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
		.options {
			display: flex;
			justify-content: space-between;
			align-items: flex-start;
			gap: 1rem;
			margin: 1em 0;
		}
		.tttips {
			color: var(--vscode-descriptionForeground);
			font-size: .68rem;
			line-height: 1.5;
		}
		.result-view p {
			margin: .8em 0;
			color: var(--vscode-editor-foreground);
		}
		.result-view .error-view {
			color: var(--vscode-errorForeground);
		}
		.result-view summary {
			line-height: 2.5em;
			padding: 0 .8em;
			background: var(--vscode-list-hoverBackground, var(--vscode-editorGroupHeader-tabsBackground));
			cursor: pointer;
		}
		.result-view summary:hover {
			background: var(--vscode-list-activeSelectionBackground, var(--vscode-list-hoverBackground));
		}
		.result-view summary span {
			margin-left: .6em;
		}
		.result-view details {
			margin: .35em 0;
		}
		.error {
			color: var(--vscode-errorForeground);
			white-space: pre-wrap;
		}
		.table-wrapper {
			overflow: auto;
		}
		table.ppz {
			border: 1px solid var(--vscode-panel-border);
			border-top: none;
			border-collapse: collapse;
		}
		table.ppz thead tr {
			background: var(--vscode-editorGroupHeader-tabsBackground, var(--vscode-editor-background));
		}
		table.ppz tr:nth-child(2n) {
			background: var(--vscode-list-hoverBackground, transparent);
		}
		table.ppz th,
		table.ppz td {
			padding: .3em .6em;
			line-height: 1.5em;
			text-align: left;
			max-width: 10em;
			white-space: nowrap;
			overflow: hidden;
			text-overflow: ellipsis;
		}
		table.ppz tbody th:hover,
		table.ppz tbody td:hover,
		table.ppz tbody th:focus,
		table.ppz tbody td:focus {
			background-color: var(--vscode-list-hoverBackground);
			white-space: initial;
		}
		table.ppz.kv-table {
			margin-top: .5em;
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
				<h1>MySQL SQL 终端</h1>
				<div class="subtitle">${this.escapeHtml(
					this.describeSelectedConnection(connections, selectedConnectionId)
				)}</div>
			</div>
			<div class="meta">${isExecuting ? '执行中...' : '就绪'}</div>
		</div>
		<div class="form">
			<label>
				连接
				<select id="connection" ${connections.length === 0 ? 'disabled' : ''}>
					${connectionOptions}
				</select>
			</label>
			<label>
				SQL
				<textarea id="sql" spellcheck="false">${this.escapeHtml(state.sql)}</textarea>
			</label>
			<div class="options">
				<div class="tttips">* CTRL + Enter 直接运行 sql</div>
				<span>
					<button id="execute" onclick="executeSql()"${disabled}>执行</button>
				</span>
			</div>
		</div>
		${connections.length === 0 ? '<p class="error">暂无已保存的 MySQL 连接。</p>' : ''}
		<section>
			${resultMarkup}
		</section>
	</div>
	<script>
		const vscode = acquireVsCodeApi();
		const initialState = ${serializedState};
		vscode.setState(initialState);
		function persistState() {
			const connection = document.getElementById('connection');
			const sql = document.getElementById('sql');
			vscode.setState({
				selectedConnectionId: connection ? connection.value : initialState.selectedConnectionId,
				sql: sql ? sql.value : initialState.sql
			});
		}
		function executeSql() {
			const executeButton = document.getElementById('execute');
			if (executeButton?.disabled) {
				return;
			}
			const connection = document.getElementById('connection');
			const sql = document.getElementById('sql');
			persistState();
			vscode.postMessage({
				type: 'execute',
				connectionId: connection.value,
				sql: sql.value
			});
		}
		document.getElementById('connection')?.addEventListener('change', persistState);
		document.getElementById('sql')?.addEventListener('input', persistState);
		document.getElementById('sql')?.addEventListener('keydown', (event) => {
			if (event.ctrlKey && event.key === 'Enter') {
				event.preventDefault();
				executeSql();
			}
		});
	</script>
</body>
</html>`;
	}

	/**
	 * 解析 VS Code 保存的 SQL 终端 Webview 状态。
	 *
	 * @param value 原始恢复状态。
	 * @returns 可用于重新渲染的 SQL 终端状态。
	 */
	private parseSerializedState(
		value: unknown
	): MySqlSqlTerminalSerializedState {
		if (!value || typeof value !== 'object' || Array.isArray(value)) {
			return {
				sql: '',
			};
		}

		const selectedConnectionId = Reflect.get(value, 'selectedConnectionId');
		const sql = Reflect.get(value, 'sql');

		return {
			selectedConnectionId:
				typeof selectedConnectionId === 'string'
					? selectedConnectionId
					: undefined,
			sql: typeof sql === 'string' ? sql : '',
		};
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
			: '未选择 MySQL 连接。';
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

	/**
	 * 将数据安全序列化为可嵌入 script 的 JSON。
	 *
	 * @param value 需要嵌入 Webview 脚本的数据。
	 * @returns 经过转义的 JSON 字符串。
	 */
	private serializeScriptValue(value: unknown): string {
		return JSON.stringify(value)
			.replaceAll('<', '\\u003c')
			.replaceAll('>', '\\u003e')
			.replaceAll('&', '\\u0026')
			.replaceAll('\u2028', '\\u2028')
			.replaceAll('\u2029', '\\u2029');
	}
}
