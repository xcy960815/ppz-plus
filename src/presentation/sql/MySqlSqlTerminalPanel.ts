import * as vscode from "vscode";

import type { ExecuteMySqlSqlUseCase } from "../../application/useCases/mysql/ExecuteMySqlSqlUseCase";
import type { ListStoredConnectionsUseCase } from "../../application/useCases/connections/ListStoredConnectionsUseCase";
import type {
  ConnectionConfig,
  MysqlConnectionConfig,
} from "../../domain/connections/ConnectionConfig";
import type { SqlExecutionResult } from "../../domain/query/SqlExecutionResult";
import { maskConnectionUrl } from "../commands/ConnectionDisplayFormatter";
import type { StoredConnectionPasswordPrompt } from "../commands/StoredConnectionPasswordPrompt";
import type { MySqlSqlTerminalWebviewMessage } from "./MySqlSqlTerminalWebviewMessage";
import { buildSqlTerminalPageHtml } from "./SqlTerminalPageHtml";
import type { SqlTerminalOpenRequest } from "./SqlTerminalPanelBase";
import { SqlTerminalPanelBase } from "./SqlTerminalPanelBase";

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
export class MySqlSqlTerminalPanel extends SqlTerminalPanelBase<
  MySqlSqlTerminalPanelState,
  MySqlSqlTerminalSerializedState,
  MySqlSqlTerminalWebviewMessage
> {
  /**
   * 创建 MySQL SQL 终端面板管理器。
   *
   * @param {ListStoredConnectionsUseCase} listStoredConnectionsUseCase 用于列出已保存连接的用例。
   * @param {ExecuteMySqlSqlUseCase} executeMySqlSqlUseCase 用于执行 MySQL SQL 的用例。
   * @param {StoredConnectionPasswordPrompt} storedConnectionPasswordPrompt 用于补录已保存连接缺失的本机密码。
   */
  public constructor(
    listStoredConnectionsUseCase: ListStoredConnectionsUseCase,
    private readonly executeMySqlSqlUseCase: ExecuteMySqlSqlUseCase,
    storedConnectionPasswordPrompt: StoredConnectionPasswordPrompt,
  ) {
    super(
      {
        viewType: "ppzPlus.mysqlSqlTerminal",
        panelTitle: "MySQL SQL 终端",
        noConnectionsMessage: "暂无已保存的 MySQL 连接。",
        connectionNotFoundMessage: "未找到已选择的 MySQL 连接。",
        passwordCancelledMessage: "已取消补录 MySQL 连接密码。",
      },
      listStoredConnectionsUseCase,
      storedConnectionPasswordPrompt,
    );
  }

  /**
   * 打开或显示 MySQL SQL 终端。
   *
   * @param {MysqlConnectionConfig} initialConnection 可选的初始选中连接。
   * @param {string} initialSql 可选的初始 SQL 文本。
   */
  public async open(initialConnection?: MysqlConnectionConfig, initialSql?: string): Promise<void> {
    await this.openPanel({
      connectionId: initialConnection?.id,
      sql: initialSql,
    });
  }

  /**
   * 解析 VS Code 保存的 SQL 终端 Webview 状态。
   *
   * @param {unknown} value 原始恢复状态。
   * @returns {MySqlSqlTerminalSerializedState} 可用于重新渲染的 SQL 终端状态。
   */
  protected parseSerializedState(value: unknown): MySqlSqlTerminalSerializedState {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return {
        sql: "",
      };
    }

    const state = value as Record<string, unknown>;
    const selectedConnectionId = state.selectedConnectionId;
    const sql = state.sql;

    return {
      selectedConnectionId:
        typeof selectedConnectionId === "string" ? selectedConnectionId : undefined,
      sql: typeof sql === "string" ? sql : "",
    };
  }

  /**
   * 依据恢复状态创建面板状态。
   *
   * @param {vscode.WebviewPanel} panel VS Code 恢复出来的 Webview 面板。
   * @param {MySqlSqlTerminalSerializedState} restoredState 已解析的恢复状态。
   * @returns {MySqlSqlTerminalPanelState} 面板可变状态。
   */
  protected createRestoredState(
    panel: vscode.WebviewPanel,
    restoredState: MySqlSqlTerminalSerializedState,
  ): MySqlSqlTerminalPanelState {
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
   * @returns {MySqlSqlTerminalPanelState} 面板可变状态。
   */
  protected createNewState(
    panel: vscode.WebviewPanel,
    request: SqlTerminalOpenRequest,
  ): MySqlSqlTerminalPanelState {
    return {
      panel,
      selectedConnectionId: request.connectionId,
      sql: request.sql ?? "",
    };
  }

  /**
   * 将打开请求合并进已存在的面板状态。
   *
   * @param {MySqlSqlTerminalPanelState} state 当前面板状态。
   * @param {SqlTerminalOpenRequest} request 打开请求参数。
   */
  protected applyOpenRequest(
    state: MySqlSqlTerminalPanelState,
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
   * 读取当前保存的 MySQL 连接。
   *
   * @returns {Promise<readonly MysqlConnectionConfig[]>} MySQL 连接配置列表。
   */
  protected async listEngineConnections(): Promise<readonly MysqlConnectionConfig[]> {
    const connections = await this.listStoredConnectionsUseCase.execute();
    return connections.filter((connection): connection is MysqlConnectionConfig =>
      this.isMySqlConnection(connection),
    );
  }

  /**
   * 判断连接配置是否为 MySQL 连接。
   *
   * @param {ConnectionConfig} connection 待检查的连接配置。
   * @returns {connection is MysqlConnectionConfig} 是否为 MySQL 连接。
   */
  private isMySqlConnection(connection: ConnectionConfig): connection is MysqlConnectionConfig {
    return connection.engine === "mysql";
  }

  /**
   * 调用 MySQL SQL 执行用例。
   *
   * @param {MySqlSqlTerminalPanelState} state 当前面板状态。
   * @param {MysqlConnectionConfig} connection 已就绪的目标连接。
   * @returns {Promise<SqlExecutionResult>} SQL 执行结果。
   */
  protected async executeSql(
    state: MySqlSqlTerminalPanelState,
    connection: MysqlConnectionConfig,
  ): Promise<SqlExecutionResult> {
    return this.executeMySqlSqlUseCase.execute(connection, state.sql);
  }

  /**
   * 创建 SQL 终端 Webview HTML。
   *
   * @param {MySqlSqlTerminalPanelState} state 当前面板状态。
   * @param {boolean} isExecuting 是否正在执行 SQL。
   * @returns {Promise<string>} Webview HTML 文档。
   */
  protected async renderHtml(
    state: MySqlSqlTerminalPanelState,
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
    const serializedState = this.serializeScriptValue({
      selectedConnectionId,
      sql: state.sql,
    } satisfies MySqlSqlTerminalSerializedState);

    return buildSqlTerminalPageHtml({
      cspSource: state.panel.webview.cspSource,
      panelTitle: this.viewOptions.panelTitle,
      subtitleHtml: this.escapeHtml(
        this.describeSelectedConnection(connections, selectedConnectionId),
      ),
      sqlHtml: this.escapeHtml(state.sql),
      connectionOptionsHtml: connectionOptions,
      connectionSelectDisabled: connections.length === 0,
      executing: isExecuting,
      noConnectionsMessage: this.viewOptions.noConnectionsMessage ?? "",
      resultMarkup,
      serializedState,
      databaseAware: false,
    });
  }

  /**
   * 为连接选择框创建用户可读描述。
   *
   * @param {MysqlConnectionConfig} connection MySQL 连接配置。
   * @returns {string} 连接描述文本。
   */
  private describeConnection(connection: MysqlConnectionConfig): string {
    if (connection.mode === "parameters") {
      const database = connection.database ? `/${connection.database}` : "";
      return `${connection.name} (${connection.host}:${connection.port}${database})`;
    }

    return `${connection.name} (${maskConnectionUrl(connection.url)})`;
  }

  /**
   * 创建当前选中连接的状态文本。
   *
   * @param {readonly MysqlConnectionConfig[]} connections 当前可选的 MySQL 连接。
   * @param {string} selectedConnectionId 当前选中的连接标识。
   * @returns {string} 连接状态文本。
   */
  private describeSelectedConnection(
    connections: readonly MysqlConnectionConfig[],
    selectedConnectionId: string,
  ): string {
    const selectedConnection = connections.find(
      (connection) => connection.id === selectedConnectionId,
    );

    return selectedConnection ? this.describeConnection(selectedConnection) : "未选择 MySQL 连接。";
  }
}
