import * as vscode from "vscode";

import type { ExecutePostgreSqlSqlUseCase } from "../../application/useCases/ExecutePostgreSqlSqlUseCase";
import type { ListStoredConnectionsUseCase } from "../../application/useCases/ListStoredConnectionsUseCase";
import type {
  ConnectionConfig,
  PostgreSqlConnectionConfig,
} from "../../domain/connections/ConnectionConfig";
import type { SqlExecutionResult } from "../../domain/query/SqlExecutionResult";
import type { ExtensionActivationParticipant } from "../bootstrap/ExtensionActivationParticipant";
import { SqlExecutionResultRenderer } from "./SqlExecutionResultRenderer";
import type { PostgreSqlSqlTerminalWebviewMessage } from "./PostgreSqlSqlTerminalWebviewMessage";

/**
 * 保存 PostgreSQL SQL 终端面板的可变状态。
 */
interface PostgreSqlSqlTerminalPanelState {
  readonly panel: vscode.WebviewPanel;
  selectedConnectionId?: string;
  selectedDatabaseName?: string;
  sql: string;
  result?: SqlExecutionResult;
}

/**
 * 保存 PostgreSQL SQL 终端可由 VS Code 恢复的轻量状态。
 */
interface PostgreSqlSqlTerminalSerializedState {
  readonly selectedConnectionId?: string;
  readonly selectedDatabaseName?: string;
  readonly sql: string;
}

/**
 * 管理 PostgreSQL SQL 终端面板。
 */
export class PostgreSqlSqlTerminalPanel
  implements ExtensionActivationParticipant, vscode.WebviewPanelSerializer
{
  /**
   * 保存 SQL 终端 Webview 的 VS Code viewType。
   */
  private static readonly viewType = "ppzPlus.postgreSqlSqlTerminal";

  /**
   * 渲染通用 SQL 执行结果区域。
   */
  private readonly resultRenderer = new SqlExecutionResultRenderer();

  /**
   * 保存当前已打开的 SQL 终端面板。
   */
  private panelState?: PostgreSqlSqlTerminalPanelState;

  /**
   * 创建 PostgreSQL SQL 终端面板管理器。
   *
   * @param listStoredConnectionsUseCase 用于列出已保存连接的用例。
   * @param executePostgreSqlSqlUseCase 用于执行 PostgreSQL SQL 的用例。
   */
  public constructor(
    private readonly listStoredConnectionsUseCase: ListStoredConnectionsUseCase,
    private readonly executePostgreSqlSqlUseCase: ExecutePostgreSqlSqlUseCase,
  ) {}

  /**
   * 注册 SQL 终端 Webview 恢复器。
   *
   * @param {vscode.ExtensionContext} context VS Code 扩展生命周期上下文。
   */
  public activate(context: vscode.ExtensionContext): void {
    context.subscriptions.push(
      vscode.window.registerWebviewPanelSerializer(PostgreSqlSqlTerminalPanel.viewType, this),
    );
  }

  /**
   * 从 VS Code 保存的 Webview 状态恢复 SQL 终端面板。
   *
   * @param {vscode.WebviewPanel} panel VS Code 恢复出来的 Webview 面板。
   * @param {unknown} serializedState Webview 前端保存的轻量状态。
   */
  public async deserializeWebviewPanel(
    panel: vscode.WebviewPanel,
    serializedState: unknown,
  ): Promise<void> {
    panel.webview.options = {
      enableScripts: true,
    };
    const restoredState = this.parseSerializedState(serializedState);
    const state: PostgreSqlSqlTerminalPanelState = {
      panel,
      selectedConnectionId: restoredState.selectedConnectionId,
      selectedDatabaseName: restoredState.selectedDatabaseName,
      sql: restoredState.sql,
    };

    this.panelState = state;
    this.registerPanelHandlers(state);
    await this.render(state);
  }

  /**
   * 打开或显示 PostgreSQL SQL 终端。
   *
   * @param {PostgreSqlConnectionConfig} initialConnection 可选的初始选中连接。
   * @param {string} initialDatabaseName 可选的初始 database。
   * @param {string} initialSql 可选的初始 SQL 文本。
   */
  public async open(
    initialConnection?: PostgreSqlConnectionConfig,
    initialDatabaseName?: string,
    initialSql?: string,
  ): Promise<void> {
    if (this.panelState) {
      this.panelState.panel.reveal(vscode.ViewColumn.Active);
      if (initialConnection) {
        this.panelState.selectedConnectionId = initialConnection.id;
        this.panelState.selectedDatabaseName = initialDatabaseName;
      }
      if (initialSql !== undefined) {
        this.panelState.sql = initialSql;
        this.panelState.result = undefined;
      }
      await this.render(this.panelState);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      PostgreSqlSqlTerminalPanel.viewType,
      "PostgreSQL SQL 终端",
      vscode.ViewColumn.Active,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
      },
    );
    const state: PostgreSqlSqlTerminalPanelState = {
      panel,
      selectedConnectionId: initialConnection?.id,
      selectedDatabaseName: initialDatabaseName,
      sql: initialSql ?? "",
    };

    this.panelState = state;
    this.registerPanelHandlers(state);

    await this.render(state);
  }

  /**
   * 为 SQL 终端面板注册生命周期和消息处理。
   *
   * @param {PostgreSqlSqlTerminalPanelState} state 当前面板状态。
   */
  private registerPanelHandlers(state: PostgreSqlSqlTerminalPanelState): void {
    state.panel.onDidDispose(() => {
      if (this.panelState?.panel === state.panel) {
        this.panelState = undefined;
      }
    });
    state.panel.webview.onDidReceiveMessage(
      async (message: PostgreSqlSqlTerminalWebviewMessage) => {
        await this.handleWebviewMessage(state, message);
      },
    );
  }

  /**
   * 处理 SQL 终端 Webview 动作。
   *
   * @param {PostgreSqlSqlTerminalPanelState} state 当前面板状态。
   * @param {PostgreSqlSqlTerminalWebviewMessage} message Webview 发出的消息。
   */
  private async handleWebviewMessage(
    state: PostgreSqlSqlTerminalPanelState,
    message: PostgreSqlSqlTerminalWebviewMessage,
  ): Promise<void> {
    if (message.type !== "execute") {
      return;
    }

    state.selectedConnectionId = message.connectionId;
    state.selectedDatabaseName =
      message.databaseName && message.databaseName.length > 0 ? message.databaseName : undefined;
    state.sql = message.sql;
    state.result = undefined;
    state.panel.webview.html = await this.renderHtml(state, true);

    const connections = await this.listPostgreSqlConnections();
    const selectedConnection = connections.find(
      (connection) => connection.id === message.connectionId,
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
        errorMessage: "未找到已选择的 PostgreSQL 连接。",
      };
      await this.render(state);
      return;
    }

    state.result = await this.executePostgreSqlSqlUseCase.execute(
      selectedConnection,
      state.selectedDatabaseName,
      message.sql,
    );
    await this.render(state);
  }

  /**
   * 渲染当前 SQL 终端面板。
   *
   * @param {PostgreSqlSqlTerminalPanelState} state 当前面板状态。
   */
  private async render(state: PostgreSqlSqlTerminalPanelState): Promise<void> {
    state.panel.title = "PostgreSQL SQL 终端";
    state.panel.webview.html = await this.renderHtml(state, false);
  }

  /**
   * 创建 SQL 终端 Webview HTML。
   *
   * @param {PostgreSqlSqlTerminalPanelState} state 当前面板状态。
   * @param {boolean} isExecuting 是否正在执行 SQL。
   * @returns {Promise<string>} Webview HTML 文档。
   */
  private async renderHtml(
    state: PostgreSqlSqlTerminalPanelState,
    isExecuting: boolean,
  ): Promise<string> {
    const connections = await this.listPostgreSqlConnections();
    const selectedConnectionId = state.selectedConnectionId ?? connections[0]?.id ?? "";
    const selectedConnection = connections.find(
      (connection) => connection.id === selectedConnectionId,
    );
    const selectedDatabaseName =
      state.selectedDatabaseName ??
      (selectedConnection ? this.resolveConfiguredDatabaseName(selectedConnection) : undefined);
    const connectionOptions = connections
      .map((connection) => {
        const selected = connection.id === selectedConnectionId ? " selected" : "";
        const databaseName =
          connection.id === selectedConnectionId
            ? selectedDatabaseName
            : this.resolveConfiguredDatabaseName(connection);
        return `<option value="${this.escapeHtmlAttribute(
          connection.id,
        )}" data-database-name="${this.escapeHtmlAttribute(
          databaseName ?? "",
        )}"${selected}>${this.escapeHtml(
          this.describeConnection(connection, databaseName),
        )}</option>`;
      })
      .join("");
    const resultMarkup = state.result
      ? this.resultRenderer.render(state.result)
      : '<div class="empty-result">尚未执行 SQL。</div>';
    const disabled = connections.length === 0 || isExecuting ? " disabled" : "";
    const serializedState = this.serializeScriptValue({
      selectedConnectionId,
      selectedDatabaseName,
      sql: state.sql,
    } satisfies PostgreSqlSqlTerminalSerializedState);

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
	<meta charset="UTF-8" />
	<meta name="viewport" content="width=device-width, initial-scale=1.0" />
	<title>PostgreSQL SQL 终端</title>
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
				<h1>PostgreSQL SQL 终端</h1>
				<div class="subtitle">${this.escapeHtml(
          this.describeSelectedConnection(connections, selectedConnectionId, selectedDatabaseName),
        )}</div>
			</div>
			<div class="meta">${isExecuting ? "执行中..." : "就绪"}</div>
		</div>
		<div class="form">
			<label>
				连接
				<select id="connection" ${connections.length === 0 ? "disabled" : ""}>
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
		${connections.length === 0 ? '<p class="error">暂无已保存的 PostgreSQL 连接。</p>' : ""}
		<section>
			${resultMarkup}
		</section>
	</div>
	<script>
		const vscode = acquireVsCodeApi();
		const initialState = ${serializedState};
		vscode.setState(initialState);
		function selectedDatabaseName() {
			const connection = document.getElementById('connection');
			const option = connection?.selectedOptions?.[0];
			return option?.dataset?.databaseName || '';
		}
		function persistState() {
			const connection = document.getElementById('connection');
			const sql = document.getElementById('sql');
			vscode.setState({
				selectedConnectionId: connection ? connection.value : initialState.selectedConnectionId,
				selectedDatabaseName: selectedDatabaseName(),
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
				databaseName: selectedDatabaseName(),
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
   * @param {unknown} value 原始恢复状态。
   * @returns {PostgreSqlSqlTerminalSerializedState} 可用于重新渲染的 SQL 终端状态。
   */
  private parseSerializedState(value: unknown): PostgreSqlSqlTerminalSerializedState {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return {
        sql: "",
      };
    }

    const serializedState = value as Record<string, unknown>;
    const selectedConnectionId = serializedState.selectedConnectionId;
    const selectedDatabaseName = serializedState.selectedDatabaseName;
    const sql = serializedState.sql;

    return {
      selectedConnectionId:
        typeof selectedConnectionId === "string" ? selectedConnectionId : undefined,
      selectedDatabaseName:
        typeof selectedDatabaseName === "string" && selectedDatabaseName.length > 0
          ? selectedDatabaseName
          : undefined,
      sql: typeof sql === "string" ? sql : "",
    };
  }

  /**
   * 读取当前保存的 PostgreSQL 连接。
   *
   * @returns PostgreSQL 连接配置列表。
   */
  private async listPostgreSqlConnections(): Promise<readonly PostgreSqlConnectionConfig[]> {
    const connections = await this.listStoredConnectionsUseCase.execute();
    return connections.filter((connection): connection is PostgreSqlConnectionConfig =>
      this.isPostgreSqlConnection(connection),
    );
  }

  /**
   * 判断连接配置是否为 PostgreSQL 连接。
   *
   * @param {ConnectionConfig} connection 待检查的连接配置。
   * @returns {connection is PostgreSqlConnectionConfig} 是否为 PostgreSQL 连接。
   */
  private isPostgreSqlConnection(
    connection: ConnectionConfig,
  ): connection is PostgreSqlConnectionConfig {
    return connection.engine === "postgresql";
  }

  /**
   * 从连接配置中解析默认 database。
   *
   * @param {PostgreSqlConnectionConfig} connection PostgreSQL 连接配置。
   * @returns {string | undefined} 默认 database；无法识别时为空。
   */
  private resolveConfiguredDatabaseName(
    connection: PostgreSqlConnectionConfig,
  ): string | undefined {
    if (connection.mode === "parameters") {
      return connection.database;
    }

    try {
      const databaseName = decodeURIComponent(new URL(connection.url).pathname.replace(/^\//, ""));
      return databaseName.length > 0 ? databaseName : undefined;
    } catch {
      return undefined;
    }
  }

  /**
   * 为连接选择框创建用户可读描述。
   *
   * @param {PostgreSqlConnectionConfig} connection PostgreSQL 连接配置。
   * @param {string | undefined} databaseName 当前执行目标 database。
   * @returns {string} 连接描述文本。
   */
  private describeConnection(
    connection: PostgreSqlConnectionConfig,
    databaseName: string | undefined,
  ): string {
    if (connection.mode === "parameters") {
      const database = databaseName ? `/${databaseName}` : "";
      return `${connection.name} (${connection.host}:${connection.port}${database})`;
    }

    const database = databaseName ? ` [${databaseName}]` : "";
    return `${connection.name} (${connection.url})${database}`;
  }

  /**
   * 创建当前选中连接的状态文本。
   *
   * @param {readonly PostgreSqlConnectionConfig[]} connections 当前可选的 PostgreSQL 连接。
   * @param {string} selectedConnectionId 当前选中的连接标识。
   * @param {string | undefined} selectedDatabaseName 当前选中的 database。
   * @returns {string} 连接状态文本。
   */
  private describeSelectedConnection(
    connections: readonly PostgreSqlConnectionConfig[],
    selectedConnectionId: string,
    selectedDatabaseName: string | undefined,
  ): string {
    const selectedConnection = connections.find(
      (connection) => connection.id === selectedConnectionId,
    );

    return selectedConnection
      ? this.describeConnection(selectedConnection, selectedDatabaseName)
      : "未选择 PostgreSQL 连接。";
  }

  /**
   * 转义用户可控文本以便安全渲染 HTML。
   *
   * @param {string} value 待转义的文本值。
   * @returns {string} 转义后的 HTML 字符串。
   */
  private escapeHtml(value: string): string {
    return value
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  /**
   * 转义用户可控文本以便安全放入 HTML 属性。
   *
   * @param {string} value 待转义的文本值。
   * @returns {string} 转义后的属性字符串。
   */
  private escapeHtmlAttribute(value: string): string {
    return this.escapeHtml(value);
  }

  /**
   * 将数据安全序列化为可嵌入 script 的 JSON。
   *
   * @param {unknown} value 待序列化的数据。
   * @returns {string} 转义后的 JSON 字符串。
   */
  private serializeScriptValue(value: unknown): string {
    return JSON.stringify(value).replaceAll("<", "\\u003c");
  }
}
