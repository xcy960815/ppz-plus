import * as vscode from "vscode";

import type { ListStoredConnectionsUseCase } from "../../application/useCases/ListStoredConnectionsUseCase";
import type { ConnectionConfig } from "../../domain/connections/ConnectionConfig";
import type { SqlExecutionResult } from "../../domain/query/SqlExecutionResult";
import type { ExtensionActivationParticipant } from "../bootstrap/ExtensionActivationParticipant";
import type { StoredConnectionPasswordPrompt } from "../commands/StoredConnectionPasswordPrompt";
import { escapeHtml, escapeHtmlAttribute, serializeScriptValue } from "../shared/WebviewHtml";
import { SqlExecutionResultRenderer } from "./SqlExecutionResultRenderer";

/**
 * 保存 SQL 终端面板的基础可变状态。
 */
export interface SqlTerminalPanelStateBase {
  /** 当前的 Webview 面板实例。 */
  readonly panel: vscode.WebviewPanel;
  /** 当前选中的连接标识。 */
  selectedConnectionId?: string;
  /** 当前编辑的 SQL 文本。 */
  sql: string;
  /** 最近一次执行结果。 */
  result?: SqlExecutionResult;
}

/**
 * 保存 SQL 终端可由 VS Code 恢复的基础轻量状态。
 */
export interface SqlTerminalSerializedStateBase {
  readonly selectedConnectionId?: string;
  readonly sql: string;
}

/**
 * 描述 SQL 终端基础执行消息。
 */
export interface SqlTerminalExecuteMessage {
  readonly type: "execute";
  readonly connectionId: string;
  readonly sql: string;
}

/**
 * 描述一次打开 SQL 终端的请求参数。
 */
export interface SqlTerminalOpenRequest {
  /** 可选的初始选中连接标识。 */
  readonly connectionId?: string;
  /** 可选的初始 database（仅 PostgreSQL 使用）。 */
  readonly databaseName?: string;
  /** 可选的初始 SQL 文本。 */
  readonly sql?: string;
}

/**
 * 描述 SQL 终端面板的视图配置。
 */
export interface SqlTerminalPanelViewOptions {
  /** Webview 的 viewType。 */
  readonly viewType: string;
  /** 面板标题，同时用于页面 `<title>` 与 `<h1>`。 */
  readonly panelTitle: string;
  /** 无可选连接时的提示文本（页面布局使用）。 */
  readonly noConnectionsMessage?: string;
  /** 执行时未找到选中连接的错误文本。 */
  readonly connectionNotFoundMessage: string;
  /** 用户取消补录密码时的错误文本。 */
  readonly passwordCancelledMessage?: string;
}

/**
 * SQL 终端面板基类，统一面板生命周期、状态恢复与执行消息流。
 *
 * 子类只需实现引擎差异部分：连接列表过滤、SQL 执行用例调用与
 * Webview HTML 渲染。
 */
export abstract class SqlTerminalPanelBase<
  StateT extends SqlTerminalPanelStateBase,
  RestoredT extends SqlTerminalSerializedStateBase,
  MessageT extends SqlTerminalExecuteMessage,
>
  implements ExtensionActivationParticipant, vscode.WebviewPanelSerializer
{
  /**
   * 渲染通用 SQL 执行结果区域。
   */
  protected readonly resultRenderer = new SqlExecutionResultRenderer();

  /**
   * 视图配置，供子类在渲染 HTML 时复用。
   */
  protected readonly viewOptions: SqlTerminalPanelViewOptions;

  /**
   * 保存当前已打开的 SQL 终端面板。
   */
  private panelState?: StateT;

  /**
   * 创建 SQL 终端面板基类。
   *
   * @param {SqlTerminalPanelViewOptions} viewOptions 面板视图配置。
   * @param {ListStoredConnectionsUseCase} listStoredConnectionsUseCase 用于列出已保存连接的用例。
   * @param {StoredConnectionPasswordPrompt | undefined} storedConnectionPasswordPrompt 用于补录已保存连接缺失的本机密码；不支持密码的引擎传 undefined。
   */
  protected constructor(
    viewOptions: SqlTerminalPanelViewOptions,
    protected readonly listStoredConnectionsUseCase: ListStoredConnectionsUseCase,
    private readonly storedConnectionPasswordPrompt: StoredConnectionPasswordPrompt | undefined,
  ) {
    this.viewOptions = viewOptions;
  }

  /**
   * 注册 SQL 终端 Webview 恢复器。
   *
   * @param {vscode.ExtensionContext} context VS Code 扩展生命周期上下文。
   */
  public activate(context: vscode.ExtensionContext): void {
    context.subscriptions.push(
      vscode.window.registerWebviewPanelSerializer(this.viewOptions.viewType, this),
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
    const state = this.createRestoredState(panel, restoredState);

    this.panelState = state;
    this.registerPanelHandlers(state);
    await this.render(state);
  }

  /**
   * 打开或显示 SQL 终端面板。
   *
   * @param {SqlTerminalOpenRequest} request 打开请求参数。
   */
  protected async openPanel(request: SqlTerminalOpenRequest): Promise<void> {
    if (this.panelState) {
      this.panelState.panel.reveal(vscode.ViewColumn.Active);
      this.applyOpenRequest(this.panelState, request);
      await this.render(this.panelState);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      this.viewOptions.viewType,
      this.viewOptions.panelTitle,
      vscode.ViewColumn.Active,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
      },
    );
    const state = this.createNewState(panel, request);

    this.panelState = state;
    this.registerPanelHandlers(state);

    await this.render(state);
  }

  /**
   * 为 SQL 终端面板注册生命周期和消息处理。
   *
   * @param {StateT} state 当前面板状态。
   */
  private registerPanelHandlers(state: StateT): void {
    state.panel.onDidDispose(() => {
      if (this.panelState?.panel === state.panel) {
        this.panelState = undefined;
      }
    });
    state.panel.webview.onDidReceiveMessage(async (message: MessageT) => {
      await this.handleWebviewMessage(state, message);
    });
  }

  /**
   * 处理 SQL 终端 Webview 动作。
   *
   * @param {StateT} state 当前面板状态。
   * @param {MessageT} message Webview 发出的消息。
   */
  private async handleWebviewMessage(state: StateT, message: MessageT): Promise<void> {
    if (message.type !== "execute") {
      return;
    }

    this.applyExecuteMessage(state, message);
    state.selectedConnectionId = message.connectionId;
    state.sql = message.sql;
    state.result = undefined;
    state.panel.webview.html = await this.renderHtml(state, true);

    state.result = await this.executeMessage(state);
    await this.render(state);
  }

  /**
   * 定位选中连接并执行 SQL，统一处理连接缺失与密码补录。
   *
   * @param {StateT} state 当前面板状态。
   * @returns {Promise<SqlExecutionResult>} SQL 执行结果或错误结果。
   */
  private async executeMessage(state: StateT): Promise<SqlExecutionResult> {
    const connections = await this.listEngineConnections();
    const selectedConnection = connections.find(
      (connection) => connection.id === state.selectedConnectionId,
    );

    if (!selectedConnection) {
      return this.createErrorResult(state, this.viewOptions.connectionNotFoundMessage);
    }

    const readyConnection = this.storedConnectionPasswordPrompt
      ? await this.storedConnectionPasswordPrompt.ensureConnectionReady(selectedConnection)
      : selectedConnection;

    if (!readyConnection) {
      return this.createErrorResult(
        state,
        this.viewOptions.passwordCancelledMessage ?? "已取消补录连接密码。",
      );
    }

    return this.executeSql(state, readyConnection);
  }

  /**
   * 创建统一的执行错误结果。
   *
   * @param {StateT} state 当前面板状态。
   * @param {string} errorMessage 展示给用户的错误文本。
   * @returns {SqlExecutionResult} 失败的执行结果。
   */
  private createErrorResult(state: StateT, errorMessage: string): SqlExecutionResult {
    return {
      sql: state.sql,
      success: false,
      isQuery: false,
      fields: [],
      rows: [],
      affectedRows: null,
      durationMs: 0,
      resultSets: [],
      errorMessage,
    };
  }

  /**
   * 渲染当前 SQL 终端面板。
   *
   * @param {StateT} state 当前面板状态。
   */
  private async render(state: StateT): Promise<void> {
    state.panel.title = this.viewOptions.panelTitle;
    state.panel.webview.html = await this.renderHtml(state, false);
  }

  /**
   * 解析 VS Code 保存的 SQL 终端 Webview 状态。
   *
   * @param {unknown} value 原始恢复状态。
   * @returns {RestoredT} 可用于重新渲染的 SQL 终端状态。
   */
  protected abstract parseSerializedState(value: unknown): RestoredT;

  /**
   * 依据恢复状态创建面板状态。
   *
   * @param {vscode.WebviewPanel} panel VS Code 恢复出来的 Webview 面板。
   * @param {RestoredT} restoredState 已解析的恢复状态。
   * @returns {StateT} 面板可变状态。
   */
  protected abstract createRestoredState(
    panel: vscode.WebviewPanel,
    restoredState: RestoredT,
  ): StateT;

  /**
   * 依据打开请求创建全新的面板状态。
   *
   * @param {vscode.WebviewPanel} panel 新建的 Webview 面板。
   * @param {SqlTerminalOpenRequest} request 打开请求参数。
   * @returns {StateT} 面板可变状态。
   */
  protected abstract createNewState(
    panel: vscode.WebviewPanel,
    request: SqlTerminalOpenRequest,
  ): StateT;

  /**
   * 将打开请求合并进已存在的面板状态。
   *
   * @param {StateT} state 当前面板状态。
   * @param {SqlTerminalOpenRequest} request 打开请求参数。
   */
  protected abstract applyOpenRequest(state: StateT, request: SqlTerminalOpenRequest): void;

  /**
   * 读取当前保存的引擎连接。
   *
   * @returns {Promise<readonly ConnectionConfig[]>} 引擎连接配置列表。
   */
  protected abstract listEngineConnections(): Promise<readonly ConnectionConfig[]>;

  /**
   * 调用引擎 SQL 执行用例。
   *
   * @param {StateT} state 当前面板状态。
   * @param {ConnectionConfig} connection 已就绪的目标连接。
   * @returns {Promise<SqlExecutionResult>} SQL 执行结果。
   */
  protected abstract executeSql(
    state: StateT,
    connection: ConnectionConfig,
  ): Promise<SqlExecutionResult>;

  /**
   * 创建 SQL 终端 Webview HTML。
   *
   * @param {StateT} state 当前面板状态。
   * @param {boolean} isExecuting 是否正在执行 SQL。
   * @returns {Promise<string>} Webview HTML 文档。
   */
  protected abstract renderHtml(state: StateT, isExecuting: boolean): Promise<string>;

  /**
   * 执行消息到达时写回引擎扩展状态，默认引擎没有扩展状态。
   *
   * @param {StateT} state 当前面板状态。
   * @param {MessageT} message Webview 发出的消息。
   */
  protected applyExecuteMessage(state: StateT, message: MessageT): void {
    // 默认引擎没有扩展状态，PostgreSQL 等需要额外维度的引擎自行覆写。
    void state;
    void message;
  }

  /**
   * 转义用户可控文本以便安全渲染 HTML。
   *
   * @param {string} value 待转义的文本值。
   * @returns {string} 转义后的 HTML 字符串。
   */
  protected escapeHtml(value: string): string {
    return escapeHtml(value);
  }

  /**
   * 转义用户可控文本以便安全放入 HTML 属性。
   *
   * @param {string} value 待转义的文本值。
   * @returns {string} 转义后的属性字符串。
   */
  protected escapeHtmlAttribute(value: string): string {
    return escapeHtmlAttribute(value);
  }

  /**
   * 将数据安全序列化为可嵌入 script 的 JSON。
   *
   * @param {unknown} value 需要嵌入 Webview 脚本的数据。
   * @returns {string} 经过转义的 JSON 字符串。
   */
  protected serializeScriptValue(value: unknown): string {
    return serializeScriptValue(value);
  }
}
