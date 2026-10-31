import * as vscode from "vscode";

import type { ExecuteSqlite3SqlUseCase } from "../../application/useCases/ExecuteSqlite3SqlUseCase";
import type { ListStoredConnectionsUseCase } from "../../application/useCases/ListStoredConnectionsUseCase";
import type {
  ConnectionConfig,
  Sqlite3ConnectionConfig,
} from "../../domain/connections/ConnectionConfig";
import type { SqlExecutionResult } from "../../domain/query/SqlExecutionResult";
import { buildWebviewCspMeta, createWebviewNonce } from "../shared/WebviewHtml";
import type { MySqlSqlTerminalWebviewMessage } from "./MySqlSqlTerminalWebviewMessage";
import type { SqlTerminalOpenRequest } from "./SqlTerminalPanelBase";
import { SqlTerminalPanelBase } from "./SqlTerminalPanelBase";

/**
 * 保存 SQLite3 SQL 终端面板的可变状态。
 */
interface Sqlite3SqlTerminalPanelState {
  readonly panel: vscode.WebviewPanel;
  selectedConnectionId?: string;
  sql: string;
  result?: SqlExecutionResult;
}

/**
 * 保存 SQLite3 SQL 终端可由 VS Code 恢复的轻量状态。
 */
interface Sqlite3SqlTerminalSerializedState {
  readonly selectedConnectionId?: string;
  readonly sql: string;
}

/**
 * 管理 SQLite3 SQL 终端面板。
 */
export class Sqlite3SqlTerminalPanel extends SqlTerminalPanelBase<
  Sqlite3SqlTerminalPanelState,
  Sqlite3SqlTerminalSerializedState,
  MySqlSqlTerminalWebviewMessage
> {
  /**
   * 创建 SQLite3 SQL 终端面板管理器。
   *
   * @param {ListStoredConnectionsUseCase} listStoredConnectionsUseCase 用于列出已保存连接的用例。
   * @param {ExecuteSqlite3SqlUseCase} executeSqlite3SqlUseCase 用于执行 SQLite3 SQL 的用例。
   */
  public constructor(
    listStoredConnectionsUseCase: ListStoredConnectionsUseCase,
    private readonly executeSqlite3SqlUseCase: ExecuteSqlite3SqlUseCase,
  ) {
    super(
      {
        viewType: "ppzPlus.sqlite3SqlTerminal",
        panelTitle: "SQLite3 SQL 终端",
        connectionNotFoundMessage: "未找到已选择的 SQLite3 连接。",
      },
      listStoredConnectionsUseCase,
      undefined,
    );
  }

  /**
   * 打开或显示 SQLite3 SQL 终端。
   *
   * @param {Sqlite3ConnectionConfig} initialConnection 可选的初始选中连接。
   * @param {string} initialSql 可选的初始 SQL 文本。
   */
  public async open(
    initialConnection?: Sqlite3ConnectionConfig,
    initialSql?: string,
  ): Promise<void> {
    await this.openPanel({
      connectionId: initialConnection?.id,
      sql: initialSql,
    });
  }

  /**
   * 从 VS Code 保存状态解析 SQL 终端状态。
   *
   * @param {unknown} value 原始状态。
   * @returns {Sqlite3SqlTerminalSerializedState} 归一化后的恢复状态。
   */
  protected parseSerializedState(value: unknown): Sqlite3SqlTerminalSerializedState {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return { sql: "" };
    }

    const record = value as Record<string, unknown>;
    return {
      selectedConnectionId:
        typeof record.selectedConnectionId === "string" ? record.selectedConnectionId : undefined,
      sql: typeof record.sql === "string" ? record.sql : "",
    };
  }

  /**
   * 依据恢复状态创建面板状态。
   *
   * @param {vscode.WebviewPanel} panel VS Code 恢复出来的 Webview 面板。
   * @param {Sqlite3SqlTerminalSerializedState} restoredState 已解析的恢复状态。
   * @returns {Sqlite3SqlTerminalPanelState} 面板可变状态。
   */
  protected createRestoredState(
    panel: vscode.WebviewPanel,
    restoredState: Sqlite3SqlTerminalSerializedState,
  ): Sqlite3SqlTerminalPanelState {
    return {
      panel,
      selectedConnectionId: restoredState.selectedConnectionId,
      sql: restoredState.sql,
    };
  }

  /**
   * 依据打开请求创建全新的面板状态。
   *
   * @param {vscode.WebviewPanel} panel 新建的 Webview 面板。
   * @param {SqlTerminalOpenRequest} request 打开请求参数。
   * @returns {Sqlite3SqlTerminalPanelState} 面板可变状态。
   */
  protected createNewState(
    panel: vscode.WebviewPanel,
    request: SqlTerminalOpenRequest,
  ): Sqlite3SqlTerminalPanelState {
    return {
      panel,
      selectedConnectionId: request.connectionId,
      sql: request.sql ?? "",
    };
  }

  /**
   * 将打开请求合并进已存在的面板状态。
   *
   * @param {Sqlite3SqlTerminalPanelState} state 当前面板状态。
   * @param {SqlTerminalOpenRequest} request 打开请求参数。
   */
  protected applyOpenRequest(
    state: Sqlite3SqlTerminalPanelState,
    request: SqlTerminalOpenRequest,
  ): void {
    if (request.connectionId !== undefined) {
      state.selectedConnectionId = request.connectionId;
    }
    if (request.sql !== undefined) {
      state.sql = request.sql;
      state.result = undefined;
    }
  }

  /**
   * 从存储中列出 SQLite3 连接。
   *
   * @returns {Promise<readonly Sqlite3ConnectionConfig[]>} SQLite3 连接列表。
   */
  protected async listEngineConnections(): Promise<readonly Sqlite3ConnectionConfig[]> {
    const connections = await this.listStoredConnectionsUseCase.execute();
    return connections.filter(
      (connection): connection is Sqlite3ConnectionConfig => connection.engine === "sqlite3",
    );
  }

  /**
   * 调用 SQLite3 SQL 执行用例。
   *
   * @param {Sqlite3SqlTerminalPanelState} state 当前面板状态。
   * @param {Sqlite3ConnectionConfig} connection 目标连接。
   * @returns {Promise<SqlExecutionResult>} SQL 执行结果。
   */
  protected async executeSql(
    state: Sqlite3SqlTerminalPanelState,
    connection: Sqlite3ConnectionConfig,
  ): Promise<SqlExecutionResult> {
    return this.executeSqlite3SqlUseCase.execute(connection, state.sql);
  }

  /**
   * 创建 SQL 终端 Webview HTML。
   *
   * 说明：SQLite3 终端使用独立的工具栏布局，不复用页面布局模板。
   *
   * @param {Sqlite3SqlTerminalPanelState} state 当前面板状态。
   * @param {boolean} isExecuting 是否正在执行 SQL。
   * @returns {Promise<string>} Webview HTML 文档。
   */
  protected async renderHtml(
    state: Sqlite3SqlTerminalPanelState,
    isExecuting: boolean,
  ): Promise<string> {
    const connections = await this.listEngineConnections();
    const selectedConnectionId = state.selectedConnectionId ?? connections[0]?.id ?? "";
    const connectionOptions = connections
      .map((connection) => {
        const selected = connection.id === selectedConnectionId ? " selected" : "";
        return `<option value="${this.escapeHtmlAttribute(
          connection.id,
        )}"${selected}>${this.escapeHtml(this.describeConnection(connection))}</option>`;
      })
      .join("");
    const resultMarkup = state.result
      ? this.resultRenderer.render(state.result)
      : '<div class="empty-result">尚未执行 SQL。</div>';
    const disabled = connections.length === 0 || isExecuting ? " disabled" : "";
    const serializedState = this.serializeScriptValue({
      selectedConnectionId,
      sql: state.sql,
    } satisfies Sqlite3SqlTerminalSerializedState);
    const nonce = createWebviewNonce();
    const cspMeta = buildWebviewCspMeta(state.panel.webview.cspSource, nonce);

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
	<meta charset="UTF-8" />
	${cspMeta}
	<meta name="viewport" content="width=device-width, initial-scale=1.0" />
	<title>SQLite3 SQL 终端</title>
	<style>
		body {
			margin: 0;
			font-family: var(--vscode-font-family);
			background: var(--vscode-editor-background);
			color: var(--vscode-editor-foreground);
		}
		.toolbar {
			display: flex;
			gap: 8px;
			align-items: center;
			padding: 10px;
			background: var(--vscode-sideBar-background);
		}
		select, textarea, button {
			font: inherit;
		}
		select {
			min-width: 260px;
		}
		button {
			border: 0;
			padding: 4px 12px;
			color: var(--vscode-button-foreground);
			background: var(--vscode-button-background);
		}
		button:hover:not(:disabled) {
			background: var(--vscode-button-hoverBackground);
		}
		button:disabled {
			opacity: .5;
		}
		textarea {
			box-sizing: border-box;
			width: 100%;
			min-height: 180px;
			padding: 12px;
			border: 0;
			border-top: 1px solid var(--vscode-panel-border);
			border-bottom: 1px solid var(--vscode-panel-border);
			resize: vertical;
			color: var(--vscode-editor-foreground);
			background: var(--vscode-editor-background);
			font-family: var(--vscode-editor-font-family);
		}
		.result {
			padding: 12px;
		}
	</style>
</head>
<body>
	<form id="sql-form">
		<div class="toolbar">
			<select id="connection-id"${disabled}>${connectionOptions}</select>
			<button type="submit"${disabled}>执行</button>
		</div>
		<textarea id="sql-input" spellcheck="false"${disabled}>${this.escapeHtml(state.sql)}</textarea>
	</form>
	<div class="result">${resultMarkup}</div>
	<script nonce="${nonce}">
		const vscode = acquireVsCodeApi();
		const initialState = ${serializedState};
		vscode.setState(initialState);
		document.getElementById('sql-form')?.addEventListener('submit', (event) => {
			event.preventDefault();
			const connectionId = document.getElementById('connection-id').value;
			const sql = document.getElementById('sql-input').value;
			vscode.setState({ selectedConnectionId: connectionId, sql });
			vscode.postMessage({ type: 'execute', connectionId, sql });
		});
	</script>
</body>
</html>`;
  }

  /**
   * 描述 SQLite3 连接选择项。
   *
   * @param {ConnectionConfig} connection SQLite3 连接配置。
   * @returns {string} 用户可读描述。
   */
  private describeConnection(connection: ConnectionConfig): string {
    return `${connection.name} (${connection.mode === "file" ? connection.dbPath : ""})`;
  }
}
