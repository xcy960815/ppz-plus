import * as vscode from "vscode";

import type { TableColumnMetadata, TableRowPage } from "../../application/shared/TableDataTypes";
import type { ListStoredConnectionsUseCase } from "../../application/useCases/connections/ListStoredConnectionsUseCase";
import type { ListMySqlTableColumnsUseCase } from "../../application/useCases/mysql/ListMySqlTableColumnsUseCase";
import type { ListMySqlTableRowPageUseCase } from "../../application/useCases/mysql/ListMySqlTableRowPageUseCase";
import type { ListPostgreSqlTableColumnsUseCase } from "../../application/useCases/postgresql/ListPostgreSqlTableColumnsUseCase";
import type { ListPostgreSqlTableRowPageUseCase } from "../../application/useCases/postgresql/ListPostgreSqlTableRowPageUseCase";
import type { ListSqlite3TableColumnsUseCase } from "../../application/useCases/sqlite3/ListSqlite3TableColumnsUseCase";
import type { ListSqlite3TableRowPageUseCase } from "../../application/useCases/sqlite3/ListSqlite3TableRowPageUseCase";
import type { ExtensionActivationParticipant } from "../bootstrap/ExtensionActivationParticipant";
import { showUserErrorMessage } from "../commands/UserErrorPresenter";
import { OpenMySqlSqlTerminalCommand } from "../commands/OpenMySqlSqlTerminalCommand";
import { OpenPostgreSqlSqlTerminalCommand } from "../commands/OpenPostgreSqlSqlTerminalCommand";
import { OpenSqlite3SqlTerminalCommand } from "../commands/OpenSqlite3SqlTerminalCommand";
import type { TableDataWebviewMessage } from "./TableDataWebviewMessage";
import {
  createPanelKey,
  createQueryOptions,
  createRestoredTableNode,
  isReadOnlyTableNode,
  parseSerializedState,
  showReadOnlyTableMessage,
} from "./TableDataPanelState";
import type {
  DatabaseTablePanelState,
  TableDataConnection,
  TableDataTreeNode,
} from "./TableDataPanelState";
import { DEFAULT_TABLE_PAGE_SIZE } from "./TableDataPanelState";
import { TableDataRowEditor } from "./TableDataRowEditor";
import type { TableDataRowEditorDeps } from "./TableDataRowEditor";
import {
  renderErrorHtml,
  renderLoadingHtml,
  renderRestoreErrorHtml,
  renderTableHtml,
} from "./TableDataWebviewMarkup";

/**
 * 管理数据库表数据面板。
 */
export class DatabaseTableDataPanel
  implements ExtensionActivationParticipant, vscode.WebviewPanelSerializer
{
  /**
   * 保存表数据页 Webview 的 VS Code viewType。
   */
  private static readonly viewType = "ppzPlus.tableData";

  /**
   * 按完整表键保存已打开的表数据面板。
   */
  private readonly panelStatesByKey = new Map<string, DatabaseTablePanelState>();

  /**
   * 编排行级写操作的行编辑器。
   */
  private readonly rowEditor: TableDataRowEditor;

  /**
   * 创建表数据面板管理器。
   *
   * @param listStoredConnectionsUseCase 用于恢复 Webview 时按连接 ID 读取连接配置。
   * @param listMySqlTableColumnsUseCase 用于加载表字段的用例。
   * @param listMySqlTableRowPageUseCase 用于加载分页表数据的用例。
   * @param insertMySqlTableRowUseCase 用于新增单条表记录的用例。
   * @param updateMySqlTableRowUseCase 用于更新单条表记录的用例。
   * @param deleteMySqlTableRowUseCase 用于删除单条表记录的用例。
   * @param listPostgreSqlTableColumnsUseCase 用于加载 PostgreSQL 表字段的用例。
   * @param listPostgreSqlTableRowPageUseCase 用于加载 PostgreSQL 分页表数据的用例。
   * @param listSqlite3TableColumnsUseCase 用于加载 SQLite3 表字段的用例。
   * @param listSqlite3TableRowPageUseCase 用于加载 SQLite3 分页表数据的用例。
   * @param insertSqlite3TableRowUseCase 用于新增 SQLite3 表记录的用例。
   * @param updateSqlite3TableRowUseCase 用于更新 SQLite3 表记录的用例。
   * @param deleteSqlite3TableRowUseCase 用于删除 SQLite3 表记录的用例。
   */
  public constructor(
    private readonly listStoredConnectionsUseCase: ListStoredConnectionsUseCase,
    private readonly listMySqlTableColumnsUseCase: ListMySqlTableColumnsUseCase,
    private readonly listMySqlTableRowPageUseCase: ListMySqlTableRowPageUseCase,
    insertMySqlTableRowUseCase: TableDataRowEditorDeps["insertMySqlTableRowUseCase"],
    updateMySqlTableRowUseCase: TableDataRowEditorDeps["updateMySqlTableRowUseCase"],
    deleteMySqlTableRowUseCase: TableDataRowEditorDeps["deleteMySqlTableRowUseCase"],
    private readonly listPostgreSqlTableColumnsUseCase: ListPostgreSqlTableColumnsUseCase,
    private readonly listPostgreSqlTableRowPageUseCase: ListPostgreSqlTableRowPageUseCase,
    private readonly listSqlite3TableColumnsUseCase: ListSqlite3TableColumnsUseCase,
    private readonly listSqlite3TableRowPageUseCase: ListSqlite3TableRowPageUseCase,
    insertSqlite3TableRowUseCase: TableDataRowEditorDeps["insertSqlite3TableRowUseCase"],
    updateSqlite3TableRowUseCase: TableDataRowEditorDeps["updateSqlite3TableRowUseCase"],
    deleteSqlite3TableRowUseCase: TableDataRowEditorDeps["deleteSqlite3TableRowUseCase"],
  ) {
    this.rowEditor = new TableDataRowEditor(
      {
        listMySqlTableColumnsUseCase,
        listSqlite3TableColumnsUseCase,
        insertMySqlTableRowUseCase,
        updateMySqlTableRowUseCase,
        deleteMySqlTableRowUseCase,
        insertSqlite3TableRowUseCase,
        updateSqlite3TableRowUseCase,
        deleteSqlite3TableRowUseCase,
      },
      (state) => this.renderTableData(state),
    );
  }

  /**
   * 注册表数据页 Webview 恢复器。
   *
   * @param {vscode.ExtensionContext} context VS Code 扩展生命周期上下文。
   */
  public activate(context: vscode.ExtensionContext): void {
    context.subscriptions.push(
      vscode.window.registerWebviewPanelSerializer(DatabaseTableDataPanel.viewType, this),
    );
  }

  /**
   * 从 VS Code 保存的 Webview 状态恢复表数据页。
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
    const restoredState = parseSerializedState(serializedState);

    if (!restoredState) {
      panel.webview.html = renderRestoreErrorHtml("表数据页状态无效。", panel.webview.cspSource);
      return;
    }

    const connection = await this.findRestoredConnection(
      restoredState.connectionId,
      restoredState.engine,
    );

    if (!connection) {
      panel.webview.html = renderRestoreErrorHtml(
        "未找到此表数据页对应的数据库连接。",
        panel.webview.cspSource,
      );
      return;
    }

    const tableNode = createRestoredTableNode(connection, restoredState);
    const state: DatabaseTablePanelState = {
      panel,
      tableNode,
      pageIndex: restoredState.pageIndex,
      pageSize: restoredState.pageSize,
      filterKeyword: restoredState.filterKeyword,
      filterConditions: restoredState.filterConditions,
      sortColumnName: restoredState.sortColumnName,
      sortDirection: restoredState.sortDirection,
      hiddenColumnNames: new Set(restoredState.hiddenColumnNames),
      latestColumns: [],
      latestRows: [],
    };

    this.panelStatesByKey.set(createPanelKey(tableNode), state);
    this.registerPanelHandlers(state);
    panel.webview.html = renderLoadingHtml(tableNode, panel.webview.cspSource);
    await this.renderTableData(state);
  }

  /**
   * 打开或显示选中表的数据页。
   *
   * @param {TableDataTreeNode} tableNode 当前选中的表 Tree 节点。
   */
  public async open(tableNode: TableDataTreeNode): Promise<void> {
    const panelKey = createPanelKey(tableNode);
    const existingState = this.panelStatesByKey.get(panelKey);

    if (existingState) {
      existingState.panel.reveal(vscode.ViewColumn.Active);
      await this.renderTableData(existingState);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      DatabaseTableDataPanel.viewType,
      `${tableNode.tableName} 表数据`,
      vscode.ViewColumn.Active,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
      },
    );

    const state: DatabaseTablePanelState = {
      panel,
      tableNode,
      pageIndex: 0,
      pageSize: DEFAULT_TABLE_PAGE_SIZE,
      filterKeyword: "",
      filterConditions: [],
      sortDirection: "asc",
      hiddenColumnNames: new Set<string>(),
      latestColumns: [],
      latestRows: [],
    };

    this.panelStatesByKey.set(panelKey, state);
    this.registerPanelHandlers(state);

    panel.webview.html = renderLoadingHtml(tableNode, panel.webview.cspSource);
    await this.renderTableData(state);
  }

  /**
   * 为表数据页注册生命周期和消息处理。
   *
   * @param {DatabaseTablePanelState} state 当前表数据面板状态。
   */
  private registerPanelHandlers(state: DatabaseTablePanelState): void {
    state.panel.onDidDispose(() => {
      this.panelStatesByKey.delete(createPanelKey(state.tableNode));
    });
    state.panel.webview.onDidReceiveMessage(async (message: TableDataWebviewMessage) => {
      await this.handleWebviewMessage(state, message);
    });
  }

  /**
   * 按连接 ID 和数据库引擎查找可恢复的连接配置。
   *
   * @param {string} connectionId 需要恢复的连接标识。
   * @param {TableDataConnection["engine"]} engine 需要恢复的数据库引擎。
   * @returns {Promise<TableDataConnection | undefined>} 匹配的连接配置；不存在时为空。
   */
  private async findRestoredConnection(
    connectionId: string,
    engine: TableDataConnection["engine"],
  ): Promise<TableDataConnection | undefined> {
    const connections = await this.listStoredConnectionsUseCase.execute();
    const connection = connections.find((item) => item.id === connectionId);

    if (!connection || connection.engine !== engine) {
      return undefined;
    }

    return connection as TableDataConnection;
  }

  /**
   * 处理分页和刷新的 Webview 动作。
   *
   * @param {DatabaseTablePanelState} state 正在更新的面板状态。
   * @param {TableDataWebviewMessage} message Webview 发出的消息。
   */
  private async handleWebviewMessage(
    state: DatabaseTablePanelState,
    message: TableDataWebviewMessage,
  ): Promise<void> {
    switch (message.type) {
      case "previousPage":
        state.pageIndex = Math.max(0, state.pageIndex - 1);
        await this.renderTableData(state);
        return;
      case "nextPage":
        state.pageIndex += 1;
        await this.renderTableData(state);
        return;
      case "goToPage":
        state.pageSize = Math.max(1, Math.floor(message.pageSize));
        state.pageIndex = Math.max(0, Math.floor(message.pageIndex));
        await this.renderTableData(state);
        return;
      case "refresh":
        await this.renderTableData(state);
        return;
      case "applyQueryOptions":
        state.filterKeyword = message.filterKeyword;
        state.filterConditions = message.filterConditions ?? [];
        state.sortColumnName =
          message.sortColumnName.length > 0 ? message.sortColumnName : undefined;
        state.sortDirection = message.sortDirection === "desc" ? "desc" : "asc";
        state.pageIndex = 0;
        await this.renderTableData(state);
        return;
      case "clearQueryOptions":
        state.filterKeyword = "";
        state.filterConditions = [];
        state.sortColumnName = undefined;
        state.sortDirection = "asc";
        state.pageIndex = 0;
        await this.renderTableData(state);
        return;
      case "setVisibleColumns":
        state.hiddenColumnNames = new Set(message.hiddenColumnNames);
        return;
      case "openSqlTerminal":
        if (isReadOnlyTableNode(state.tableNode)) {
          await vscode.commands.executeCommand(
            OpenPostgreSqlSqlTerminalCommand.id,
            state.tableNode,
            message.sql ?? state.currentSql,
          );
          return;
        }
        if (state.tableNode.kind === "sqlite3Table") {
          await vscode.commands.executeCommand(
            OpenSqlite3SqlTerminalCommand.id,
            state.tableNode,
            message.sql ?? state.currentSql,
          );
          return;
        }
        await vscode.commands.executeCommand(
          OpenMySqlSqlTerminalCommand.id,
          state.tableNode,
          message.sql ?? state.currentSql,
        );
        return;
      case "copyCurrentSql":
        await this.copyCurrentSql(message.sql);
        return;
      case "openCurrentSqlDocument":
        await this.openCurrentSqlDocument(message.sql);
        return;
      case "insertRow":
        if (isReadOnlyTableNode(state.tableNode)) {
          await showReadOnlyTableMessage();
          return;
        }
        await this.rowEditor.insertRow(state);
        return;
      case "copyRow":
        if (isReadOnlyTableNode(state.tableNode)) {
          await showReadOnlyTableMessage();
          return;
        }
        await this.rowEditor.copyRow(state, message.rowIndex);
        return;
      case "editRow":
        if (isReadOnlyTableNode(state.tableNode)) {
          await showReadOnlyTableMessage();
          return;
        }
        await this.rowEditor.editRow(state, message.rowIndex);
        return;
      case "deleteRow":
        if (isReadOnlyTableNode(state.tableNode)) {
          await showReadOnlyTableMessage();
          return;
        }
        await this.rowEditor.deleteRow(state, message.rowIndex);
        return;
      case "saveEditedRows":
        if (isReadOnlyTableNode(state.tableNode)) {
          await showReadOnlyTableMessage();
          return;
        }
        await this.rowEditor.saveEditedRows(state, message.edits);
        return;
    }
  }

  /**
   * 将当前查看的 SQL 写入系统剪贴板。
   *
   * @param {string} sql Webview 当前选择的 SQL 文本。
   */
  private async copyCurrentSql(sql: string): Promise<void> {
    await vscode.env.clipboard.writeText(sql);
    await vscode.window.showInformationMessage("已复制到剪切板");
  }

  /**
   * 在 VS Code 临时 SQL 文档中打开当前查看的 SQL。
   *
   * @param {string} sql Webview 当前选择的 SQL 文本。
   */
  private async openCurrentSqlDocument(sql: string): Promise<void> {
    const document = await vscode.workspace.openTextDocument({
      content: sql,
      language: "sql",
    });

    await vscode.window.showTextDocument(document, {
      preview: false,
    });
  }

  /**
   * 加载表字段和行数据，并渲染当前面板状态。
   *
   * @param {DatabaseTablePanelState} state 正在渲染的面板状态。
   */
  private async renderTableData(state: DatabaseTablePanelState): Promise<void> {
    state.panel.title = `${state.tableNode.tableName} 表数据`;
    state.panel.webview.html = renderLoadingHtml(state.tableNode, state.panel.webview.cspSource);

    try {
      const [columns, rowPage] = await this.loadTableData(state);
      state.currentSql = rowPage.sql;
      state.latestColumns = columns;
      state.latestRows = rowPage.rows;

      state.panel.webview.html = renderTableHtml(
        state,
        columns,
        rowPage,
        state.panel.webview.cspSource,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      state.panel.webview.html = renderErrorHtml(
        state.tableNode,
        message,
        state.panel.webview.cspSource,
      );
      await showUserErrorMessage({
        operation: "加载表数据",
        error,
      });
    }
  }

  /**
   * 根据表节点类型加载字段和分页行数据。
   *
   * @param {DatabaseTablePanelState} state 正在渲染的面板状态。
   * @returns 字段和分页行数据。
   */
  private async loadTableData(
    state: DatabaseTablePanelState,
  ): Promise<readonly [readonly TableColumnMetadata[], TableRowPage]> {
    if (state.tableNode.kind === "postgresqlTable") {
      return Promise.all([
        this.listPostgreSqlTableColumnsUseCase.execute(
          state.tableNode.connection,
          state.tableNode.databaseName,
          state.tableNode.schemaName,
          state.tableNode.tableName,
        ),
        this.listPostgreSqlTableRowPageUseCase.execute(
          state.tableNode.connection,
          state.tableNode.databaseName,
          state.tableNode.schemaName,
          state.tableNode.tableName,
          state.pageIndex,
          state.pageSize,
          createQueryOptions(state),
        ),
      ]);
    }

    if (state.tableNode.kind === "sqlite3Table") {
      return Promise.all([
        this.listSqlite3TableColumnsUseCase.execute(
          state.tableNode.connection,
          state.tableNode.tableName,
        ),
        this.listSqlite3TableRowPageUseCase.execute(
          state.tableNode.connection,
          state.tableNode.tableName,
          state.pageIndex,
          state.pageSize,
          createQueryOptions(state),
        ),
      ]);
    }

    return Promise.all([
      this.listMySqlTableColumnsUseCase.execute(
        state.tableNode.connection,
        state.tableNode.schemaName,
        state.tableNode.tableName,
      ),
      this.listMySqlTableRowPageUseCase.execute(
        state.tableNode.connection,
        state.tableNode.schemaName,
        state.tableNode.tableName,
        state.pageIndex,
        state.pageSize,
        createQueryOptions(state),
      ),
    ]);
  }
}
