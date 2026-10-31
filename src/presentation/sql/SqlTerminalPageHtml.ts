import { buildWebviewCspMeta, createWebviewNonce, escapeHtml } from "../shared/WebviewHtml";

/**
 * SQL 终端页面布局共享样式。
 *
 * 说明：MySQL 与 PostgreSQL SQL 终端使用同一套页面布局，
 * 样式集中在本常量中维护，避免多份拷贝漂移。
 */
export const SQL_TERMINAL_PAGE_STYLES = `
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
	`;

/**
 * 汇集构建 SQL 终端页面所需的内容片段。
 */
export interface SqlTerminalPageParts {
  /** 页面标题，同时用于 `<title>` 与 `<h1>`。 */
  readonly panelTitle: string;
  /** 已转义的副标题文本。 */
  readonly subtitleHtml: string;
  /** 已转义的 SQL 文本，用于回填 textarea。 */
  readonly sqlHtml: string;
  /** 连接选择框选项 HTML。 */
  readonly connectionOptionsHtml: string;
  /** 是否因无可选连接而禁用连接选择框。 */
  readonly connectionSelectDisabled: boolean;
  /** 是否正在执行 SQL。 */
  readonly executing: boolean;
  /** 无可用连接时展示的提示文本。 */
  readonly noConnectionsMessage: string;
  /** 结果区域 HTML。 */
  readonly resultMarkup: string;
  /** 已转义的恢复状态 JSON 字面量。 */
  readonly serializedState: string;
  /** 是否启用 database 维度（PostgreSQL 独有）。 */
  readonly databaseAware: boolean;
  /** Webview 资源来源，用于构建 CSP。 */
  readonly cspSource: string;
}

/**
 * 构建 SQL 终端页面的内联脚本。
 *
 * @param {object} options 脚本构建参数。
 * @param {string} options.serializedState 已转义的恢复状态 JSON 字面量。
 * @param {boolean} options.databaseAware 是否在消息与恢复状态中携带 database 维度。
 * @returns {string} 页面内联脚本内容。
 */
function buildSqlTerminalPageScript(options: {
  serializedState: string;
  databaseAware: boolean;
}): string {
  const databaseAware = options.databaseAware;
  const databaseStateField = databaseAware
    ? "\t\t\t\tselectedDatabaseName: selectedDatabaseName(),\n"
    : "";
  const databasePayloadField = databaseAware
    ? "\t\t\t\tdatabaseName: selectedDatabaseName(),\n"
    : "";
  const databaseHelper = databaseAware
    ? `
		function selectedDatabaseName() {
			const connection = document.getElementById('connection');
			const option = connection?.selectedOptions?.[0];
			return option?.dataset?.databaseName || '';
		}
`
    : "";

  return `		const vscode = acquireVsCodeApi();
		const initialState = ${options.serializedState};
		vscode.setState(initialState);${databaseHelper}		function persistState() {
			const connection = document.getElementById('connection');
			const sql = document.getElementById('sql');
			vscode.setState({
				selectedConnectionId: connection ? connection.value : initialState.selectedConnectionId,${databaseStateField}				sql: sql ? sql.value : initialState.sql
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
				connectionId: connection.value,${databasePayloadField}				sql: sql.value
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
		document.getElementById('execute')?.addEventListener('click', () => executeSql());
	`;
}

/**
 * 构建 MySQL / PostgreSQL 共用的 SQL 终端页面 HTML。
 *
 * @param {SqlTerminalPageParts} parts 页面内容片段。
 * @returns {string} 完整的 Webview HTML 文档。
 */
export function buildSqlTerminalPageHtml(parts: SqlTerminalPageParts): string {
  const executeDisabled = parts.connectionSelectDisabled || parts.executing ? " disabled" : "";
  const nonce = createWebviewNonce();
  const cspMeta = buildWebviewCspMeta(parts.cspSource, nonce);
  const script = buildSqlTerminalPageScript({
    serializedState: parts.serializedState,
    databaseAware: parts.databaseAware,
  });

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
	<meta charset="UTF-8" />
	${cspMeta}
	<meta name="viewport" content="width=device-width, initial-scale=1.0" />
	<title>${escapeHtml(parts.panelTitle)}</title>
	<style>${SQL_TERMINAL_PAGE_STYLES}</style>
</head>
<body>
	<div class="page">
		<div class="header">
			<div>
				<h1>${escapeHtml(parts.panelTitle)}</h1>
				<div class="subtitle">${parts.subtitleHtml}</div>
			</div>
			<div class="meta">${parts.executing ? "执行中..." : "就绪"}</div>
		</div>
		<div class="form">
			<label>
				连接
				<select id="connection" ${parts.connectionSelectDisabled ? "disabled" : ""}>
					${parts.connectionOptionsHtml}
				</select>
			</label>
			<label>
				SQL
				<textarea id="sql" spellcheck="false">${parts.sqlHtml}</textarea>
			</label>
			<div class="options">
				<div class="tttips">* CTRL + Enter 直接运行 sql</div>
				<span>
					<button id="execute"${executeDisabled}>执行</button>
				</span>
			</div>
		</div>
		${parts.connectionSelectDisabled ? `<p class="error">${escapeHtml(parts.noConnectionsMessage)}</p>` : ""}
		<section>
			${parts.resultMarkup}
		</section>
	</div>
	<script nonce="${nonce}">
${script}
	</script>
</body>
</html>`;
}
