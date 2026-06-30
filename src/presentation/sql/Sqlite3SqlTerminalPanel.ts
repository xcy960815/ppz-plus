import * as vscode from "vscode";

import type { ExecuteSqlite3SqlUseCase } from "../../application/useCases/ExecuteSqlite3SqlUseCase";
import type { ListStoredConnectionsUseCase } from "../../application/useCases/ListStoredConnectionsUseCase";
import type {
  ConnectionConfig,
  Sqlite3ConnectionConfig,
} from "../../domain/connections/ConnectionConfig";
import type { SqlExecutionResult } from "../../domain/query/SqlExecutionResult";
import type { ExtensionActivationParticipant } from "../bootstrap/ExtensionActivationParticipant";
import { SqlExecutionResultRenderer } from "./SqlExecutionResultRenderer";
import type { MySqlSqlTerminalWebviewMessage } from "./MySqlSqlTerminalWebviewMessage";

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
export class Sqlite3SqlTerminalPanel
  implements ExtensionActivationParticipant, vscode.WebviewPanelSerializer
{
  /**
   * 保存 SQL 终端 Webview 的 VS Code viewType。
   */
  private static readonly viewType = "ppzPlus.sqlite3SqlTerminal";

  /**
   * 渲染通用 SQL 执行结果区域。
   */
  private readonly resultRenderer = new SqlExecutionResultRenderer();

  /**
   * 保存当前已打开的 SQL 终端面板。
   */
  private panelState?: Sqlite3SqlTerminalPanelState;

  /**
   * 创建 SQLite3 SQL 终端面板管理器。
   *
   * @param listStoredConnectionsUseCase 用于列出已保存连接的用例。
   * @param executeSqlite3SqlUseCase 用于执行 SQLite3 SQL 的用例。
   */
  public constructor(
    private readonly listStoredConnectionsUseCase: ListStoredConnectionsUseCase,
    private readonly executeSqlite3SqlUseCase: ExecuteSqlite3SqlUseCase,
  ) {}

  /**
   * 注册 SQL 终端 Webview 恢复器。
   *
   * @param {vscode.ExtensionContext} context VS Code 扩展生命周期上下文。
   */
  public activate(context: vscode.ExtensionContext): void {
    context.subscriptions.push(
      vscode.window.registerWebviewPanelSerializer(Sqlite3SqlTerminalPanel.viewType, this),
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
    const state: Sqlite3SqlTerminalPanelState = {
      panel,
      selectedConnectionId: restoredState.selectedConnectionId,
      sql: restoredState.sql,
    };

    this.panelState = state;
    this.registerPanelHandlers(state);
    await this.render(state);
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
      Sqlite3SqlTerminalPanel.viewType,
      "SQLite3 SQL 终端",
      vscode.ViewColumn.Active,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
      },
    );
    const state: Sqlite3SqlTerminalPanelState = {
      panel,
      selectedConnectionId: initialConnection?.id,
      sql: initialSql ?? "",
    };

    this.panelState = state;
    this.registerPanelHandlers(state);
    await this.render(state);
  }

  /**
   * 为 SQL 终端面板注册生命周期和消息处理。
   *
   * @param {Sqlite3SqlTerminalPanelState} state 当前面板状态。
   */
  private registerPanelHandlers(state: Sqlite3SqlTerminalPanelState): void {
    state.panel.onDidDispose(() => {
      if (this.panelState?.panel === state.panel) {
        this.panelState = undefined;
      }
    });
    state.panel.webview.onDidReceiveMessage(async (message: MySqlSqlTerminalWebviewMessage) => {
      await this.handleWebviewMessage(state, message);
    });
  }

  /**
   * 处理 SQL 终端 Webview 动作。
   *
   * @param {Sqlite3SqlTerminalPanelState} state 当前面板状态。
   * @param {MySqlSqlTerminalWebviewMessage} message Webview 发出的消息。
   */
  private async handleWebviewMessage(
    state: Sqlite3SqlTerminalPanelState,
    message: MySqlSqlTerminalWebviewMessage,
  ): Promise<void> {
    if (message.type !== "execute") {
      return;
    }

    state.selectedConnectionId = message.connectionId;
    state.sql = message.sql;
    state.result = undefined;
    state.panel.webview.html = await this.renderHtml(state, true);

    const connections = await this.listSqlite3Connections();
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
        errorMessage: "未找到已选择的 SQLite3 连接。",
      };
      await this.render(state);
      return;
    }

    state.result = await this.executeSqlite3SqlUseCase.execute(selectedConnection, message.sql);
    await this.render(state);
  }

  /**
   * 渲染当前 SQL 终端面板。
   *
   * @param {Sqlite3SqlTerminalPanelState} state 当前面板状态。
   */
  private async render(state: Sqlite3SqlTerminalPanelState): Promise<void> {
    state.panel.title = "SQLite3 SQL 终端";
    state.panel.webview.html = await this.renderHtml(state, false);
  }

  /**
   * 创建 SQL 终端 Webview HTML。
   *
   * @param {Sqlite3SqlTerminalPanelState} state 当前面板状态。
   * @param {boolean} isExecuting 是否正在执行 SQL。
   * @returns {Promise<string>} Webview HTML 文档。
   */
  private async renderHtml(
    state: Sqlite3SqlTerminalPanelState,
    isExecuting: boolean,
  ): Promise<string> {
    const connections = await this.listSqlite3Connections();
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

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
	<meta charset="UTF-8" />
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
	<script>
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
   * 从存储中列出 SQLite3 连接。
   *
   * @returns {Promise<Sqlite3ConnectionConfig[]>} SQLite3 连接列表。
   */
  private async listSqlite3Connections(): Promise<Sqlite3ConnectionConfig[]> {
    const connections = await this.listStoredConnectionsUseCase.execute();
    return connections.filter(
      (connection): connection is Sqlite3ConnectionConfig => connection.engine === "sqlite3",
    );
  }

  /**
   * 从 VS Code 保存状态解析 SQL 终端状态。
   *
   * @param {unknown} value 原始状态。
   * @returns {Sqlite3SqlTerminalSerializedState} 归一化后的恢复状态。
   */
  private parseSerializedState(value: unknown): Sqlite3SqlTerminalSerializedState {
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
   * 描述 SQLite3 连接选择项。
   *
   * @param {ConnectionConfig} connection SQLite3 连接配置。
   * @returns {string} 用户可读描述。
   */
  private describeConnection(connection: ConnectionConfig): string {
    return `${connection.name} (${connection.mode === "file" ? connection.dbPath : ""})`;
  }

  /**
   * 将值序列化为安全的脚本字面量。
   *
   * @param {unknown} value 需要写入脚本的值。
   * @returns {string} JSON 字符串。
   */
  private serializeScriptValue(value: unknown): string {
    return JSON.stringify(value).replaceAll("</script", "<\\/script");
  }

  /**
   * 转义 HTML 文本。
   *
   * @param {string} value 原始文本。
   * @returns {string} HTML 安全文本。
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
   * 转义 HTML 属性。
   *
   * @param {string} value 原始属性值。
   * @returns {string} HTML 安全属性值。
   */
  private escapeHtmlAttribute(value: string): string {
    return this.escapeHtml(value);
  }
}
