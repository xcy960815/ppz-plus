import * as vscode from "vscode";

import type { ExecutePostgreSqlSqlUseCase } from "../../application/useCases/postgresql/ExecutePostgreSqlSqlUseCase";
import type { ListStoredConnectionsUseCase } from "../../application/useCases/connections/ListStoredConnectionsUseCase";
import type {
  ConnectionConfig,
  PostgreSqlConnectionConfig,
} from "../../domain/connections/ConnectionConfig";
import type { SqlExecutionResult } from "../../domain/query/SqlExecutionResult";
import { maskConnectionUrl } from "../commands/ConnectionDisplayFormatter";
import type { StoredConnectionPasswordPrompt } from "../commands/StoredConnectionPasswordPrompt";
import { buildSqlTerminalPageHtml } from "./SqlTerminalPageHtml";
import type { SqlTerminalOpenRequest } from "./SqlTerminalPanelBase";
import { SqlTerminalPanelBase } from "./SqlTerminalPanelBase";
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
export class PostgreSqlSqlTerminalPanel extends SqlTerminalPanelBase<
  PostgreSqlSqlTerminalPanelState,
  PostgreSqlSqlTerminalSerializedState,
  PostgreSqlSqlTerminalWebviewMessage
> {
  /**
   * 创建 PostgreSQL SQL 终端面板管理器。
   *
   * @param {ListStoredConnectionsUseCase} listStoredConnectionsUseCase 用于列出已保存连接的用例。
   * @param {ExecutePostgreSqlSqlUseCase} executePostgreSqlSqlUseCase 用于执行 PostgreSQL SQL 的用例。
   * @param {StoredConnectionPasswordPrompt} storedConnectionPasswordPrompt 用于补录已保存连接缺失的本机密码。
   */
  public constructor(
    listStoredConnectionsUseCase: ListStoredConnectionsUseCase,
    private readonly executePostgreSqlSqlUseCase: ExecutePostgreSqlSqlUseCase,
    storedConnectionPasswordPrompt: StoredConnectionPasswordPrompt,
  ) {
    super(
      {
        viewType: "ppzPlus.postgreSqlSqlTerminal",
        panelTitle: "PostgreSQL SQL 终端",
        noConnectionsMessage: "暂无已保存的 PostgreSQL 连接。",
        connectionNotFoundMessage: "未找到已选择的 PostgreSQL 连接。",
        passwordCancelledMessage: "已取消补录 PostgreSQL 连接密码。",
      },
      listStoredConnectionsUseCase,
      storedConnectionPasswordPrompt,
    );
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
    await this.openPanel({
      connectionId: initialConnection?.id,
      databaseName: initialDatabaseName,
      sql: initialSql,
    });
  }

  /**
   * 解析 VS Code 保存的 SQL 终端 Webview 状态。
   *
   * @param {unknown} value 原始恢复状态。
   * @returns {PostgreSqlSqlTerminalSerializedState} 可用于重新渲染的 SQL 终端状态。
   */
  protected parseSerializedState(value: unknown): PostgreSqlSqlTerminalSerializedState {
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
   * 依据恢复状态创建面板状态。
   *
   * @param {vscode.WebviewPanel} panel VS Code 恢复出来的 Webview 面板。
   * @param {PostgreSqlSqlTerminalSerializedState} restoredState 已解析的恢复状态。
   * @returns {PostgreSqlSqlTerminalPanelState} 面板可变状态。
   */
  protected createRestoredState(
    panel: vscode.WebviewPanel,
    restoredState: PostgreSqlSqlTerminalSerializedState,
  ): PostgreSqlSqlTerminalPanelState {
    return {
      panel,
      selectedConnectionId: restoredState.selectedConnectionId,
      selectedDatabaseName: restoredState.selectedDatabaseName,
      sql: restoredState.sql,
    };
  }

  /**
   * 依据打开请求创建全新的面板状态。
   *
   * @param {vscode.WebviewPanel} panel 新建的 Webview 面板。
   * @param {SqlTerminalOpenRequest} request 打开请求参数。
   * @returns {PostgreSqlSqlTerminalPanelState} 面板可变状态。
   */
  protected createNewState(
    panel: vscode.WebviewPanel,
    request: SqlTerminalOpenRequest,
  ): PostgreSqlSqlTerminalPanelState {
    return {
      panel,
      selectedConnectionId: request.connectionId,
      selectedDatabaseName: request.databaseName,
      sql: request.sql ?? "",
    };
  }

  /**
   * 将打开请求合并进已存在的面板状态。
   *
   * @param {PostgreSqlSqlTerminalPanelState} state 当前面板状态。
   * @param {SqlTerminalOpenRequest} request 打开请求参数。
   */
  protected applyOpenRequest(
    state: PostgreSqlSqlTerminalPanelState,
    request: SqlTerminalOpenRequest,
  ): void {
    if (request.connectionId !== undefined) {
      state.selectedConnectionId = request.connectionId;
      state.selectedDatabaseName = request.databaseName;
    }
    if (request.sql !== undefined) {
      state.sql = request.sql;
      state.result = undefined;
    }
  }

  /**
   * 执行消息到达时写回 database 维度。
   *
   * @param {PostgreSqlSqlTerminalPanelState} state 当前面板状态。
   * @param {PostgreSqlSqlTerminalWebviewMessage} message Webview 发出的消息。
   */
  protected applyExecuteMessage(
    state: PostgreSqlSqlTerminalPanelState,
    message: PostgreSqlSqlTerminalWebviewMessage,
  ): void {
    state.selectedDatabaseName =
      message.databaseName && message.databaseName.length > 0 ? message.databaseName : undefined;
  }

  /**
   * 读取当前保存的 PostgreSQL 连接。
   *
   * @returns {Promise<readonly PostgreSqlConnectionConfig[]>} PostgreSQL 连接配置列表。
   */
  protected async listEngineConnections(): Promise<readonly PostgreSqlConnectionConfig[]> {
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
   * 调用 PostgreSQL SQL 执行用例。
   *
   * @param {PostgreSqlSqlTerminalPanelState} state 当前面板状态。
   * @param {PostgreSqlConnectionConfig} connection 已就绪的目标连接。
   * @returns {Promise<SqlExecutionResult>} SQL 执行结果。
   */
  protected async executeSql(
    state: PostgreSqlSqlTerminalPanelState,
    connection: PostgreSqlConnectionConfig,
  ): Promise<SqlExecutionResult> {
    return this.executePostgreSqlSqlUseCase.execute(
      connection,
      state.selectedDatabaseName,
      state.sql,
    );
  }

  /**
   * 创建 SQL 终端 Webview HTML。
   *
   * @param {PostgreSqlSqlTerminalPanelState} state 当前面板状态。
   * @param {boolean} isExecuting 是否正在执行 SQL。
   * @returns {Promise<string>} Webview HTML 文档。
   */
  protected async renderHtml(
    state: PostgreSqlSqlTerminalPanelState,
    isExecuting: boolean,
  ): Promise<string> {
    const connections = await this.listEngineConnections();
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
    const serializedState = this.serializeScriptValue({
      selectedConnectionId,
      selectedDatabaseName,
      sql: state.sql,
    } satisfies PostgreSqlSqlTerminalSerializedState);

    return buildSqlTerminalPageHtml({
      cspSource: state.panel.webview.cspSource,
      panelTitle: this.viewOptions.panelTitle,
      subtitleHtml: this.escapeHtml(
        this.describeSelectedConnection(connections, selectedConnectionId, selectedDatabaseName),
      ),
      sqlHtml: this.escapeHtml(state.sql),
      connectionOptionsHtml: connectionOptions,
      connectionSelectDisabled: connections.length === 0,
      executing: isExecuting,
      noConnectionsMessage: this.viewOptions.noConnectionsMessage ?? "",
      resultMarkup,
      serializedState,
      databaseAware: true,
    });
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
    return `${connection.name} (${maskConnectionUrl(connection.url)})${database}`;
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
}
