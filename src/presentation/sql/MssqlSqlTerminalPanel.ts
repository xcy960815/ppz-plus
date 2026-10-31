import * as vscode from "vscode";

import type { ExecuteMssqlSqlUseCase } from "../../application/useCases/mssql/ExecuteMssqlSqlUseCase";
import type { ListStoredConnectionsUseCase } from "../../application/useCases/connections/ListStoredConnectionsUseCase";
import type {
  ConnectionConfig,
  MssqlConnectionConfig,
} from "../../domain/connections/ConnectionConfig";
import type { SqlExecutionResult } from "../../domain/query/SqlExecutionResult";
import { maskConnectionUrl } from "../commands/ConnectionDisplayFormatter";
import type { StoredConnectionPasswordPrompt } from "../commands/StoredConnectionPasswordPrompt";
import { buildSqlTerminalPageHtml } from "./SqlTerminalPageHtml";
import type { SqlTerminalOpenRequest } from "./SqlTerminalPanelBase";
import { SqlTerminalPanelBase } from "./SqlTerminalPanelBase";
import type { MssqlSqlTerminalWebviewMessage } from "./MssqlSqlTerminalWebviewMessage";

/**
 * 保存 MSSQL SQL 终端面板的可变状态。
 */
interface MssqlSqlTerminalPanelState {
  readonly panel: vscode.WebviewPanel;
  selectedConnectionId?: string;
  selectedDatabaseName?: string;
  sql: string;
  result?: SqlExecutionResult;
}

/**
 * 保存 MSSQL SQL 终端可由 VS Code 恢复的轻量状态。
 */
interface MssqlSqlTerminalSerializedState {
  readonly selectedConnectionId?: string;
  readonly selectedDatabaseName?: string;
  readonly sql: string;
}

/**
 * 管理 MSSQL SQL 终端面板。
 */
export class MssqlSqlTerminalPanel extends SqlTerminalPanelBase<
  MssqlSqlTerminalPanelState,
  MssqlSqlTerminalSerializedState,
  MssqlSqlTerminalWebviewMessage
> {
  /**
   * 创建 MSSQL SQL 终端面板管理器。
   *
   * @param {ListStoredConnectionsUseCase} listStoredConnectionsUseCase 用于列出已保存连接的用例。
   * @param {ExecuteMssqlSqlUseCase} executeMssqlSqlUseCase 用于执行 MSSQL SQL 的用例。
   * @param {StoredConnectionPasswordPrompt} storedConnectionPasswordPrompt 用于补录已保存连接缺失的本机密码。
   */
  public constructor(
    listStoredConnectionsUseCase: ListStoredConnectionsUseCase,
    private readonly executeMssqlSqlUseCase: ExecuteMssqlSqlUseCase,
    storedConnectionPasswordPrompt: StoredConnectionPasswordPrompt,
  ) {
    super(
      {
        viewType: "ppzPlus.mssqlSqlTerminal",
        panelTitle: "MSSQL SQL 终端",
        noConnectionsMessage: "暂无已保存的 MSSQL 连接。",
        connectionNotFoundMessage: "未找到已选择的 MSSQL 连接。",
        passwordCancelledMessage: "已取消补录 MSSQL 连接密码。",
      },
      listStoredConnectionsUseCase,
      storedConnectionPasswordPrompt,
    );
  }

  /**
   * 打开或显示 MSSQL SQL 终端。
   *
   * @param {MssqlConnectionConfig} initialConnection 可选的初始选中连接。
   * @param {string} initialDatabaseName 可选的初始 database。
   * @param {string} initialSql 可选的初始 SQL 文本。
   */
  public async open(
    initialConnection?: MssqlConnectionConfig,
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
   * @returns {MssqlSqlTerminalSerializedState} 可用于重新渲染的 SQL 终端状态。
   */
  protected parseSerializedState(value: unknown): MssqlSqlTerminalSerializedState {
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
   * @param {MssqlSqlTerminalSerializedState} restoredState 已解析的恢复状态。
   * @returns {MssqlSqlTerminalPanelState} 面板可变状态。
   */
  protected createRestoredState(
    panel: vscode.WebviewPanel,
    restoredState: MssqlSqlTerminalSerializedState,
  ): MssqlSqlTerminalPanelState {
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
   * @returns {MssqlSqlTerminalPanelState} 面板可变状态。
   */
  protected createNewState(
    panel: vscode.WebviewPanel,
    request: SqlTerminalOpenRequest,
  ): MssqlSqlTerminalPanelState {
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
   * @param {MssqlSqlTerminalPanelState} state 当前面板状态。
   * @param {SqlTerminalOpenRequest} request 打开请求参数。
   */
  protected applyOpenRequest(
    state: MssqlSqlTerminalPanelState,
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
   * @param {MssqlSqlTerminalPanelState} state 当前面板状态。
   * @param {MssqlSqlTerminalWebviewMessage} message Webview 发出的消息。
   */
  protected applyExecuteMessage(
    state: MssqlSqlTerminalPanelState,
    message: MssqlSqlTerminalWebviewMessage,
  ): void {
    state.selectedDatabaseName =
      message.databaseName && message.databaseName.length > 0 ? message.databaseName : undefined;
  }

  /**
   * 读取当前保存的 MSSQL 连接。
   *
   * @returns {Promise<readonly MssqlConnectionConfig[]>} MSSQL 连接配置列表。
   */
  protected async listEngineConnections(): Promise<readonly MssqlConnectionConfig[]> {
    const connections = await this.listStoredConnectionsUseCase.execute();
    return connections.filter((connection): connection is MssqlConnectionConfig =>
      this.isMssqlConnection(connection),
    );
  }

  /**
   * 判断连接配置是否为 MSSQL 连接。
   *
   * @param {ConnectionConfig} connection 待检查的连接配置。
   * @returns {connection is MssqlConnectionConfig} 是否为 MSSQL 连接。
   */
  private isMssqlConnection(connection: ConnectionConfig): connection is MssqlConnectionConfig {
    return connection.engine === "mssql";
  }

  /**
   * 从连接配置中解析默认 database。
   *
   * @param {MssqlConnectionConfig} connection MSSQL 连接配置。
   * @returns {string | undefined} 默认 database；无法识别时为空。
   */
  private resolveConfiguredDatabaseName(connection: MssqlConnectionConfig): string | undefined {
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
   * 调用 MSSQL SQL 执行用例。
   *
   * @param {MssqlSqlTerminalPanelState} state 当前面板状态。
   * @param {MssqlConnectionConfig} connection 已就绪的目标连接。
   * @returns {Promise<SqlExecutionResult>} SQL 执行结果。
   */
  protected async executeSql(
    state: MssqlSqlTerminalPanelState,
    connection: MssqlConnectionConfig,
  ): Promise<SqlExecutionResult> {
    return this.executeMssqlSqlUseCase.execute(connection, state.selectedDatabaseName, state.sql);
  }

  /**
   * 创建 SQL 终端 Webview HTML。
   *
   * @param {MssqlSqlTerminalPanelState} state 当前面板状态。
   * @param {boolean} isExecuting 是否正在执行 SQL。
   * @returns {Promise<string>} Webview HTML 文档。
   */
  protected async renderHtml(
    state: MssqlSqlTerminalPanelState,
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
    } satisfies MssqlSqlTerminalSerializedState);

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
   * @param {MssqlConnectionConfig} connection MSSQL 连接配置。
   * @param {string | undefined} databaseName 当前执行目标 database。
   * @returns {string} 连接描述文本。
   */
  private describeConnection(
    connection: MssqlConnectionConfig,
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
   * @param {readonly MssqlConnectionConfig[]} connections 当前可选的 MSSQL 连接。
   * @param {string} selectedConnectionId 当前选中的连接标识。
   * @param {string | undefined} selectedDatabaseName 当前选中的 database。
   * @returns {string} 连接状态文本。
   */
  private describeSelectedConnection(
    connections: readonly MssqlConnectionConfig[],
    selectedConnectionId: string,
    selectedDatabaseName: string | undefined,
  ): string {
    const selectedConnection = connections.find(
      (connection) => connection.id === selectedConnectionId,
    );

    return selectedConnection
      ? this.describeConnection(selectedConnection, selectedDatabaseName)
      : "未选择 MSSQL 连接。";
  }
}
