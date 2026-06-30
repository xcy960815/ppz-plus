import * as vscode from "vscode";

import type { ConnectionConfig } from "../../domain/connections/ConnectionConfig";
import type {
  MySqlTableCellValue,
  MySqlTableColumnMetadata,
  MySqlTableFilterCondition,
  MySqlTableInsertValues,
  MySqlTableQueryOptions,
  MySqlTableRowIdentityValues,
  MySqlTableSortDirection,
  MySqlTableUpdateValues,
  MySqlTableRowPage,
} from "../../application/mysql/MySqlTableDataProvider";
import type { DeleteMySqlTableRowUseCase } from "../../application/useCases/DeleteMySqlTableRowUseCase";
import type { InsertMySqlTableRowUseCase } from "../../application/useCases/InsertMySqlTableRowUseCase";
import type { ListStoredConnectionsUseCase } from "../../application/useCases/ListStoredConnectionsUseCase";
import type { ListMySqlTableColumnsUseCase } from "../../application/useCases/ListMySqlTableColumnsUseCase";
import type { ListMySqlTableRowPageUseCase } from "../../application/useCases/ListMySqlTableRowPageUseCase";
import type { ListPostgreSqlTableColumnsUseCase } from "../../application/useCases/ListPostgreSqlTableColumnsUseCase";
import type { ListPostgreSqlTableRowPageUseCase } from "../../application/useCases/ListPostgreSqlTableRowPageUseCase";
import type { DeleteSqlite3TableRowUseCase } from "../../application/useCases/DeleteSqlite3TableRowUseCase";
import type { InsertSqlite3TableRowUseCase } from "../../application/useCases/InsertSqlite3TableRowUseCase";
import type { ListSqlite3TableColumnsUseCase } from "../../application/useCases/ListSqlite3TableColumnsUseCase";
import type { ListSqlite3TableRowPageUseCase } from "../../application/useCases/ListSqlite3TableRowPageUseCase";
import type { UpdateSqlite3TableRowUseCase } from "../../application/useCases/UpdateSqlite3TableRowUseCase";
import type { UpdateMySqlTableRowUseCase } from "../../application/useCases/UpdateMySqlTableRowUseCase";
import type { ExtensionActivationParticipant } from "../bootstrap/ExtensionActivationParticipant";
import { showUserErrorMessage } from "../commands/UserErrorPresenter";
import { OpenMySqlSqlTerminalCommand } from "../commands/OpenMySqlSqlTerminalCommand";
import { OpenPostgreSqlSqlTerminalCommand } from "../commands/OpenPostgreSqlSqlTerminalCommand";
import { OpenSqlite3SqlTerminalCommand } from "../commands/OpenSqlite3SqlTerminalCommand";
import type {
  MySqlTableTreeNode,
  PostgreSqlTableTreeNode,
  Sqlite3TableTreeNode,
} from "../explorer/MySqlConnectionsTreeNode";
import type { MySqlTableDataWebviewMessage } from "./MySqlTableDataWebviewMessage";

/**
 * 表示当前表数据页可打开的表节点。
 */
type TableDataTreeNode = MySqlTableTreeNode | PostgreSqlTableTreeNode | Sqlite3TableTreeNode;

/**
 * 保存单个 MySQL 表数据面板的可变状态。
 */
interface MySqlTablePanelState {
  readonly panel: vscode.WebviewPanel;
  readonly tableNode: TableDataTreeNode;
  pageIndex: number;
  pageSize: number;
  filterKeyword: string;
  filterConditions: readonly MySqlTableFilterCondition[];
  sortColumnName?: string;
  sortDirection: MySqlTableSortDirection;
  hiddenColumnNames: Set<string>;
  currentSql?: string;
  latestColumns: readonly MySqlTableColumnMetadata[];
  latestRows: readonly Record<string, MySqlTableCellValue>[];
}

/**
 * 保存表数据页可由 VS Code 恢复的轻量状态。
 */
interface MySqlTablePanelSerializedState {
  readonly engine: "mysql" | "postgresql" | "sqlite3";
  readonly connectionId: string;
  readonly databaseName?: string;
  readonly schemaName: string;
  readonly tableName: string;
  readonly pageIndex: number;
  readonly pageSize: number;
  readonly filterKeyword: string;
  readonly filterConditions: readonly MySqlTableFilterCondition[];
  readonly sortColumnName?: string;
  readonly sortDirection: MySqlTableSortDirection;
  readonly hiddenColumnNames: readonly string[];
}

/**
 * 管理 MySQL 表数据面板。
 */
export class MySqlTableDataPanel
  implements ExtensionActivationParticipant, vscode.WebviewPanelSerializer
{
  /**
   * 保存表数据页 Webview 的 VS Code viewType。
   */
  private static readonly viewType = "ppzPlus.mysqlTableData";

  /**
   * 保存表数据页使用的分页大小。
   */
  private static readonly defaultPageSize = 30;

  /**
   * 按完整表键保存已打开的表数据面板。
   */
  private readonly panelStatesByKey = new Map<string, MySqlTablePanelState>();

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
    private readonly insertMySqlTableRowUseCase: InsertMySqlTableRowUseCase,
    private readonly updateMySqlTableRowUseCase: UpdateMySqlTableRowUseCase,
    private readonly deleteMySqlTableRowUseCase: DeleteMySqlTableRowUseCase,
    private readonly listPostgreSqlTableColumnsUseCase: ListPostgreSqlTableColumnsUseCase,
    private readonly listPostgreSqlTableRowPageUseCase: ListPostgreSqlTableRowPageUseCase,
    private readonly listSqlite3TableColumnsUseCase: ListSqlite3TableColumnsUseCase,
    private readonly listSqlite3TableRowPageUseCase: ListSqlite3TableRowPageUseCase,
    private readonly insertSqlite3TableRowUseCase: InsertSqlite3TableRowUseCase,
    private readonly updateSqlite3TableRowUseCase: UpdateSqlite3TableRowUseCase,
    private readonly deleteSqlite3TableRowUseCase: DeleteSqlite3TableRowUseCase,
  ) {}

  /**
   * 注册表数据页 Webview 恢复器。
   *
   * @param {vscode.ExtensionContext} context VS Code 扩展生命周期上下文。
   */
  public activate(context: vscode.ExtensionContext): void {
    context.subscriptions.push(
      vscode.window.registerWebviewPanelSerializer(MySqlTableDataPanel.viewType, this),
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
    const restoredState = this.parseSerializedState(serializedState);

    if (!restoredState) {
      panel.webview.html = this.renderRestoreErrorHtml("表数据页状态无效。");
      return;
    }

    const connection = await this.findRestoredConnection(
      restoredState.connectionId,
      restoredState.engine,
    );

    if (!connection) {
      panel.webview.html = this.renderRestoreErrorHtml("未找到此表数据页对应的数据库连接。");
      return;
    }

    const tableNode = this.createRestoredTableNode(connection, restoredState);
    const state: MySqlTablePanelState = {
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

    this.panelStatesByKey.set(this.createPanelKey(tableNode), state);
    this.registerPanelHandlers(state);
    panel.webview.html = this.renderLoadingHtml(tableNode);
    await this.renderTableData(state);
  }

  /**
   * 打开或显示选中表的数据页。
   *
   * @param {TableDataTreeNode} tableNode 当前选中的表 Tree 节点。
   */
  public async open(tableNode: TableDataTreeNode): Promise<void> {
    const panelKey = this.createPanelKey(tableNode);
    const existingState = this.panelStatesByKey.get(panelKey);

    if (existingState) {
      existingState.panel.reveal(vscode.ViewColumn.Active);
      await this.renderTableData(existingState);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      MySqlTableDataPanel.viewType,
      `${tableNode.tableName} 表数据`,
      vscode.ViewColumn.Active,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
      },
    );

    const state: MySqlTablePanelState = {
      panel,
      tableNode,
      pageIndex: 0,
      pageSize: MySqlTableDataPanel.defaultPageSize,
      filterKeyword: "",
      filterConditions: [],
      sortDirection: "asc",
      hiddenColumnNames: new Set<string>(),
      latestColumns: [],
      latestRows: [],
    };

    this.panelStatesByKey.set(panelKey, state);
    this.registerPanelHandlers(state);

    panel.webview.html = this.renderLoadingHtml(tableNode);
    await this.renderTableData(state);
  }

  /**
   * 为表数据页注册生命周期和消息处理。
   *
   * @param {MySqlTablePanelState} state 当前表数据面板状态。
   */
  private registerPanelHandlers(state: MySqlTablePanelState): void {
    state.panel.onDidDispose(() => {
      this.panelStatesByKey.delete(this.createPanelKey(state.tableNode));
    });
    state.panel.webview.onDidReceiveMessage(async (message: MySqlTableDataWebviewMessage) => {
      await this.handleWebviewMessage(state, message);
    });
  }

  /**
   * 解析 VS Code 保存的表数据页 Webview 状态。
   *
   * @param {unknown} value 原始恢复状态。
   * @returns {MySqlTablePanelSerializedState | undefined} 可用于恢复表数据页的轻量状态；无效时为空。
   */
  private parseSerializedState(value: unknown): MySqlTablePanelSerializedState | undefined {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return undefined;
    }

    const serializedState = value as Record<string, unknown>;
    const connectionId = serializedState.connectionId;
    const schemaName = serializedState.schemaName;
    const tableName = serializedState.tableName;

    if (
      typeof connectionId !== "string" ||
      typeof schemaName !== "string" ||
      typeof tableName !== "string" ||
      connectionId.trim().length === 0 ||
      schemaName.trim().length === 0 ||
      tableName.trim().length === 0
    ) {
      return undefined;
    }

    const pageIndex = serializedState.pageIndex;
    const pageSize = serializedState.pageSize;
    const filterKeyword = serializedState.filterKeyword;
    const filterConditions = serializedState.filterConditions;
    const sortColumnName = serializedState.sortColumnName;
    const sortDirection = serializedState.sortDirection;
    const hiddenColumnNames = serializedState.hiddenColumnNames;
    const databaseName = serializedState.databaseName;

    return {
      engine:
        serializedState.engine === "postgresql"
          ? "postgresql"
          : serializedState.engine === "sqlite3"
            ? "sqlite3"
            : "mysql",
      connectionId,
      databaseName: typeof databaseName === "string" ? databaseName : undefined,
      schemaName,
      tableName,
      pageIndex:
        typeof pageIndex === "number" && Number.isFinite(pageIndex)
          ? Math.max(0, Math.floor(pageIndex))
          : 0,
      pageSize:
        typeof pageSize === "number" && Number.isFinite(pageSize)
          ? Math.max(1, Math.floor(pageSize))
          : MySqlTableDataPanel.defaultPageSize,
      filterKeyword: typeof filterKeyword === "string" ? filterKeyword : "",
      filterConditions: this.parseFilterConditions(filterConditions),
      sortColumnName:
        typeof sortColumnName === "string" && sortColumnName.length > 0
          ? sortColumnName
          : undefined,
      sortDirection: sortDirection === "desc" ? "desc" : "asc",
      hiddenColumnNames: Array.isArray(hiddenColumnNames)
        ? hiddenColumnNames.filter(
            (columnName): columnName is string => typeof columnName === "string",
          )
        : [],
    };
  }

  /**
   * 解析 Webview 状态中保存的字段过滤条件。
   *
   * @param {unknown} value 原始过滤条件值。
   * @returns {readonly MySqlTableFilterCondition[]} 可传给应用层的字段过滤条件列表。
   */
  private parseFilterConditions(value: unknown): readonly MySqlTableFilterCondition[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .map((item) => this.parseFilterCondition(item))
      .filter((item): item is MySqlTableFilterCondition => item !== undefined);
  }

  /**
   * 解析单条字段过滤条件。
   *
   * @param {unknown} value 原始字段过滤条件值。
   * @returns {MySqlTableFilterCondition | undefined} 可用字段过滤条件；无效时为空。
   */
  private parseFilterCondition(value: unknown): MySqlTableFilterCondition | undefined {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return undefined;
    }

    const filterCondition = value as Record<string, unknown>;
    const columnName = filterCondition.columnName;
    const operator = filterCondition.operator;
    const rawConditionValue = filterCondition.value;

    if (typeof columnName !== "string" || !this.isSupportedFilterOperator(operator)) {
      return undefined;
    }

    return {
      columnName,
      operator,
      value: Array.isArray(rawConditionValue)
        ? rawConditionValue.filter((item): item is string => typeof item === "string")
        : typeof rawConditionValue === "string"
          ? rawConditionValue
          : undefined,
    };
  }

  /**
   * 判断过滤操作符是否为表数据页支持的旧 PPZ 操作符。
   *
   * @param {unknown} value 待检查的操作符。
   * @returns {value is MySqlTableFilterCondition['operator']} 是否为支持的过滤操作符。
   */
  private isSupportedFilterOperator(
    value: unknown,
  ): value is MySqlTableFilterCondition["operator"] {
    return (
      value === "=" ||
      value === "!=" ||
      value === ">" ||
      value === ">=" ||
      value === "<" ||
      value === "<=" ||
      value === "like" ||
      value === "in" ||
      value === "not in" ||
      value === "null" ||
      value === "not null"
    );
  }

  /**
   * 按连接 ID 和数据库引擎查找可恢复的连接配置。
   *
   * @param {string} connectionId 需要恢复的连接标识。
   * @param {'mysql' | 'postgresql' | 'sqlite3'} engine 需要恢复的数据库引擎。
   * @returns {Promise<ConnectionConfig | undefined>} 匹配的连接配置；不存在时为空。
   */
  private async findRestoredConnection(
    connectionId: string,
    engine: "mysql" | "postgresql" | "sqlite3",
  ): Promise<ConnectionConfig | undefined> {
    const connections = await this.listStoredConnectionsUseCase.execute();
    const connection = connections.find((item) => item.id === connectionId);

    if (!connection || connection.engine !== engine) {
      return undefined;
    }

    return connection;
  }

  /**
   * 根据恢复状态创建表节点。
   *
   * @param {ConnectionConfig} connection 已恢复的连接配置。
   * @param {MySqlTablePanelSerializedState} restoredState 已解析的 Webview 状态。
   * @returns {TableDataTreeNode} 可供表数据页使用的表节点。
   */
  private createRestoredTableNode(
    connection: ConnectionConfig,
    restoredState: MySqlTablePanelSerializedState,
  ): TableDataTreeNode {
    if (connection.engine === "postgresql") {
      const databaseName =
        restoredState.databaseName ??
        (connection.mode === "parameters" ? connection.database : undefined);

      return {
        kind: "postgresqlTable",
        connection,
        databaseName: databaseName ?? "",
        schemaName: restoredState.schemaName,
        tableName: restoredState.tableName,
      };
    }

    if (connection.engine === "sqlite3") {
      return {
        kind: "sqlite3Table",
        connection,
        schemaName: "main",
        tableName: restoredState.tableName,
        tableType: "table",
      };
    }

    return {
      kind: "table",
      connection,
      schemaName: restoredState.schemaName,
      tableName: restoredState.tableName,
    };
  }

  /**
   * 处理分页和刷新的 Webview 动作。
   *
   * @param {MySqlTablePanelState} state 正在更新的面板状态。
   * @param {MySqlTableDataWebviewMessage} message Webview 发出的消息。
   */
  private async handleWebviewMessage(
    state: MySqlTablePanelState,
    message: MySqlTableDataWebviewMessage,
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
        if (this.isReadOnlyTableNode(state.tableNode)) {
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
        if (this.isReadOnlyTableNode(state.tableNode)) {
          await this.showReadOnlyTableMessage();
          return;
        }
        await this.insertRow(state);
        return;
      case "copyRow":
        if (this.isReadOnlyTableNode(state.tableNode)) {
          await this.showReadOnlyTableMessage();
          return;
        }
        await this.copyRow(state, message.rowIndex);
        return;
      case "editRow":
        if (this.isReadOnlyTableNode(state.tableNode)) {
          await this.showReadOnlyTableMessage();
          return;
        }
        await this.editRow(state, message.rowIndex);
        return;
      case "deleteRow":
        if (this.isReadOnlyTableNode(state.tableNode)) {
          await this.showReadOnlyTableMessage();
          return;
        }
        await this.deleteRow(state, message.rowIndex);
        return;
      case "saveEditedRows":
        if (this.isReadOnlyTableNode(state.tableNode)) {
          await this.showReadOnlyTableMessage();
          return;
        }
        await this.saveEditedRows(state, message.edits);
        return;
    }
  }

  /**
   * 判断当前表节点是否只读。
   *
   * @param {TableDataTreeNode} tableNode 当前表节点。
   * @returns {boolean} 是否只开放只读能力。
   */
  private isReadOnlyTableNode(tableNode: TableDataTreeNode): boolean {
    return tableNode.kind === "postgresqlTable";
  }

  /**
   * 从当前面板状态中读取可写的 MySQL 表节点。
   *
   * @param {MySqlTablePanelState} state 当前表数据面板状态。
   * @returns {MySqlTableTreeNode | undefined} MySQL 表节点；非 MySQL 表时返回 undefined。
   */
  private getMySqlTableNode(state: MySqlTablePanelState): MySqlTableTreeNode | undefined {
    return state.tableNode.kind === "table" ? state.tableNode : undefined;
  }

  /**
   * 从当前面板状态中读取可写的 SQLite3 表节点。
   *
   * @param {MySqlTablePanelState} state 当前表数据面板状态。
   * @returns {Sqlite3TableTreeNode | undefined} SQLite3 表节点；非 SQLite3 表时返回 undefined。
   */
  private getSqlite3TableNode(state: MySqlTablePanelState): Sqlite3TableTreeNode | undefined {
    return state.tableNode.kind === "sqlite3Table" ? state.tableNode : undefined;
  }

  /**
   * 展示只读表页提示。
   */
  private async showReadOnlyTableMessage(): Promise<void> {
    await vscode.window.showInformationMessage("当前 PostgreSQL 表数据页暂时只支持读取。");
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
   * 收集字段值并新增一条表记录。
   *
   * @param {MySqlTablePanelState} state 当前表数据面板状态。
   */
  private async insertRow(
    state: MySqlTablePanelState,
    sourceRow?: Record<string, MySqlTableCellValue>,
  ): Promise<void> {
    try {
      const tableNode = this.getMySqlTableNode(state);
      const sqlite3TableNode = this.getSqlite3TableNode(state);

      if (!tableNode && !sqlite3TableNode) {
        await this.showReadOnlyTableMessage();
        return;
      }

      const columns = tableNode
        ? await this.listMySqlTableColumnsUseCase.execute(
            tableNode.connection,
            tableNode.schemaName,
            tableNode.tableName,
          )
        : await this.listSqlite3TableColumnsUseCase.execute(
            sqlite3TableNode!.connection,
            sqlite3TableNode!.tableName,
          );
      const values = await this.promptInsertValues(columns, sourceRow);

      if (values === undefined) {
        return;
      }

      const shouldSave = await this.confirmPendingChange("保存新增记录？");

      if (!shouldSave) {
        return;
      }

      const result = tableNode
        ? await this.insertMySqlTableRowUseCase.execute(
            tableNode.connection,
            tableNode.schemaName,
            tableNode.tableName,
            values,
          )
        : await this.insertSqlite3TableRowUseCase.execute(
            sqlite3TableNode!.connection,
            sqlite3TableNode!.tableName,
            values,
          );

      state.pageIndex = 0;
      await vscode.window.showInformationMessage(`已新增 ${result.affectedRows} 条记录。`);
      await this.renderTableData(state);
    } catch (error) {
      await showUserErrorMessage({
        operation: "新增表记录",
        error,
      });
    }
  }

  /**
   * 以当前聚焦行作为默认值新增一条表记录。
   *
   * @param {MySqlTablePanelState} state 当前表数据面板状态。
   * @param {number} rowIndex 当前页行索引。
   */
  private async copyRow(state: MySqlTablePanelState, rowIndex: number): Promise<void> {
    const row = state.latestRows[rowIndex];

    if (!row) {
      await vscode.window.showWarningMessage("当前选中的记录已不可用。");
      return;
    }

    await this.insertRow(state, row);
  }

  /**
   * 通过 VS Code 输入框收集单条新增记录的字段值。
   *
   * @param {readonly MySqlTableColumnMetadata[]} columns 当前表字段元数据。
   * @param {Record<string, MySqlTableCellValue>} sourceRow 作为新增默认值的来源行。
   * @returns {Promise<MySqlTableInsertValues | undefined>} 用户提交的字段值；取消时返回 undefined。
   */
  private async promptInsertValues(
    columns: readonly MySqlTableColumnMetadata[],
    sourceRow?: Record<string, MySqlTableCellValue>,
  ): Promise<MySqlTableInsertValues | undefined> {
    const values: Record<string, string | number | boolean | null> = {};
    const writableColumns = columns.filter(
      (column) => !column.extra.toLowerCase().includes("auto_increment"),
    );

    for (const column of writableColumns) {
      const sourceValue = sourceRow?.[column.name] ?? null;
      const value = await vscode.window.showInputBox({
        title: `填写 ${column.name}`,
        value: sourceValue === null ? "" : String(sourceValue),
        prompt: `类型：${column.dataType}${column.nullable ? "，可为空" : ""}。留空使用 DEFAULT；输入 NULL 写入 NULL。`,
        ignoreFocusOut: true,
      });

      if (value === undefined) {
        return undefined;
      }

      if (value.length === 0) {
        continue;
      }

      values[column.name] = value.toUpperCase() === "NULL" ? null : value;
    }

    return values;
  }

  /**
   * 编辑当前页中的一条表记录。
   *
   * @param {MySqlTablePanelState} state 当前表数据面板状态。
   * @param {number} rowIndex 当前页行索引。
   */
  private async editRow(state: MySqlTablePanelState, rowIndex: number): Promise<void> {
    try {
      const tableNode = this.getMySqlTableNode(state);
      const sqlite3TableNode = this.getSqlite3TableNode(state);

      if (!tableNode && !sqlite3TableNode) {
        await this.showReadOnlyTableMessage();
        return;
      }

      const row = state.latestRows[rowIndex];
      const primaryKeyColumns = state.latestColumns.filter((column) => column.isPrimaryKey);

      if (!row) {
        await vscode.window.showWarningMessage("当前选中的记录已不可用。");
        return;
      }

      if (primaryKeyColumns.length === 0) {
        await vscode.window.showWarningMessage(
          `${state.tableNode.tableName} 表缺少主键，不能进行编辑、删除操作`,
        );
        return;
      }

      const identityValues = this.createIdentityValues(primaryKeyColumns, row);
      const values = await this.promptUpdateValues(state.latestColumns, row);

      if (values === undefined) {
        return;
      }

      if (Object.keys(values).length === 0) {
        await vscode.window.showInformationMessage("没有待保存的数据");
        return;
      }

      const shouldSave = await this.confirmPendingChange("保存修改？");

      if (!shouldSave) {
        return;
      }

      const result = tableNode
        ? await this.updateMySqlTableRowUseCase.execute(
            tableNode.connection,
            tableNode.schemaName,
            tableNode.tableName,
            identityValues,
            values,
          )
        : await this.updateSqlite3TableRowUseCase.execute(
            sqlite3TableNode!.connection,
            sqlite3TableNode!.tableName,
            identityValues,
            values,
          );

      await vscode.window.showInformationMessage(`已保存 ${result.affectedRows} 条记录。`);
      await this.renderTableData(state);
    } catch (error) {
      await showUserErrorMessage({
        operation: "编辑表记录",
        error,
      });
    }
  }

  /**
   * 保存 Webview 表格中的内联编辑。
   *
   * @param state 当前表数据面板状态。
   * @param edits 前端收集的逐行字段修改。
   */
  private async saveEditedRows(
    state: MySqlTablePanelState,
    edits: readonly {
      readonly rowIndex: number;
      readonly values: Record<string, string | number | boolean | null>;
    }[],
  ): Promise<void> {
    try {
      const tableNode = this.getMySqlTableNode(state);
      const sqlite3TableNode = this.getSqlite3TableNode(state);

      if (!tableNode && !sqlite3TableNode) {
        await this.showReadOnlyTableMessage();
        return;
      }

      const primaryKeyColumns = state.latestColumns.filter((column) => column.isPrimaryKey);

      if (primaryKeyColumns.length === 0) {
        await vscode.window.showWarningMessage(
          `${state.tableNode.tableName} 表缺少主键，不能进行编辑、删除操作`,
        );
        return;
      }

      const normalizedEdits = edits
        .map((edit) => {
          const row = state.latestRows[edit.rowIndex];
          if (!row) {
            return undefined;
          }

          const values = this.normalizeInlineEditValues(state.latestColumns, edit.values);
          if (Object.keys(values).length === 0) {
            return undefined;
          }

          return {
            row,
            values,
          };
        })
        .filter(
          (
            edit,
          ): edit is {
            readonly row: Record<string, MySqlTableCellValue>;
            readonly values: MySqlTableUpdateValues;
          } => edit !== undefined,
        );

      if (normalizedEdits.length === 0) {
        await vscode.window.showInformationMessage("没有待保存的数据");
        return;
      }

      let affectedRows = 0;
      for (const edit of normalizedEdits) {
        const result = tableNode
          ? await this.updateMySqlTableRowUseCase.execute(
              tableNode.connection,
              tableNode.schemaName,
              tableNode.tableName,
              this.createIdentityValues(primaryKeyColumns, edit.row),
              edit.values,
            )
          : await this.updateSqlite3TableRowUseCase.execute(
              sqlite3TableNode!.connection,
              sqlite3TableNode!.tableName,
              this.createIdentityValues(primaryKeyColumns, edit.row),
              edit.values,
            );
        affectedRows += result.affectedRows;
      }

      await vscode.window.showInformationMessage(`已保存 ${affectedRows} 条记录。`);
      await this.renderTableData(state);
    } catch (error) {
      await showUserErrorMessage({
        operation: "保存表记录修改",
        error,
      });
    }
  }

  /**
   * 归一化 Webview 内联编辑提交的字段值。
   *
   * @param {readonly MySqlTableColumnMetadata[]} columns 当前表字段元数据。
   * @param {Record<string, string | number | boolean | null>} values Webview 提交的原始字段值。
   * @returns {MySqlTableUpdateValues} 可传入更新用例的字段值。
   */
  private normalizeInlineEditValues(
    columns: readonly MySqlTableColumnMetadata[],
    values: Record<string, string | number | boolean | null>,
  ): MySqlTableUpdateValues {
    const editableColumnNames = new Set(
      columns
        .filter(
          (column) =>
            !column.isPrimaryKey && !column.extra.toLowerCase().includes("auto_increment"),
        )
        .map((column) => column.name),
    );
    const normalizedValues: Record<string, MySqlTableCellValue> = {};

    for (const [columnName, value] of Object.entries(values)) {
      if (editableColumnNames.has(columnName)) {
        normalizedValues[columnName] = value;
      }
    }

    return normalizedValues;
  }

  /**
   * 根据主键字段从当前行创建原行定位值。
   *
   * @param {readonly MySqlTableColumnMetadata[]} primaryKeyColumns 主键字段列表。
   * @param {Record<string, MySqlTableCellValue>} row 当前页中的原始行。
   * @returns {MySqlTableRowIdentityValues} 原行定位值。
   */
  private createIdentityValues(
    primaryKeyColumns: readonly MySqlTableColumnMetadata[],
    row: Record<string, MySqlTableCellValue>,
  ): MySqlTableRowIdentityValues {
    return Object.fromEntries(
      primaryKeyColumns.map((column) => [column.name, row[column.name] ?? null]),
    );
  }

  /**
   * 删除当前页中的一条表记录。
   *
   * @param {MySqlTablePanelState} state 当前表数据面板状态。
   * @param {number} rowIndex 当前页行索引。
   */
  private async deleteRow(state: MySqlTablePanelState, rowIndex: number): Promise<void> {
    try {
      const tableNode = this.getMySqlTableNode(state);
      const sqlite3TableNode = this.getSqlite3TableNode(state);

      if (!tableNode && !sqlite3TableNode) {
        await this.showReadOnlyTableMessage();
        return;
      }

      const row = state.latestRows[rowIndex];
      const primaryKeyColumns = state.latestColumns.filter((column) => column.isPrimaryKey);

      if (!row) {
        await vscode.window.showWarningMessage("当前选中的记录已不可用。");
        return;
      }

      if (primaryKeyColumns.length === 0) {
        await vscode.window.showWarningMessage(
          `${state.tableNode.tableName} 表缺少主键，不能进行编辑、删除操作`,
        );
        return;
      }

      const confirmation = await vscode.window.showWarningMessage(
        "确定删除？",
        {
          modal: true,
          detail: this.createDeleteWarningMessage(primaryKeyColumns, row),
        },
        "确定",
      );

      if (confirmation !== "确定") {
        return;
      }

      const result = tableNode
        ? await this.deleteMySqlTableRowUseCase.execute(
            tableNode.connection,
            tableNode.schemaName,
            tableNode.tableName,
            this.createIdentityValues(primaryKeyColumns, row),
          )
        : await this.deleteSqlite3TableRowUseCase.execute(
            sqlite3TableNode!.connection,
            sqlite3TableNode!.tableName,
            this.createIdentityValues(primaryKeyColumns, row),
          );

      await vscode.window.showInformationMessage(`已删除 ${result.affectedRows} 条记录。`);
      await this.renderTableData(state);
    } catch (error) {
      await showUserErrorMessage({
        operation: "删除表记录",
        error,
      });
    }
  }

  /**
   * 创建对齐旧 PPZ 的删除确认明细。
   *
   * @param {readonly MySqlTableColumnMetadata[]} primaryKeyColumns 当前表主键字段列表。
   * @param {Record<string, MySqlTableCellValue>} row 当前准备删除的记录。
   * @returns {string} 展示给用户确认的删除风险说明。
   */
  private createDeleteWarningMessage(
    primaryKeyColumns: readonly MySqlTableColumnMetadata[],
    row: Record<string, MySqlTableCellValue>,
  ): string {
    const warning = primaryKeyColumns
      .map(
        (column) => `${column.name} 为 ${this.formatCellValueForMessage(row[column.name] ?? null)}`,
      )
      .join(" 且 ");

    return `您正在删除 ${warning} 的记录，删除后不可恢复`;
  }

  /**
   * 将单元格值转换为确认弹窗中的短文本。
   *
   * @param {MySqlTableCellValue} value 单元格原始展示值。
   * @returns {string} 可放入 VS Code 消息框的文本。
   */
  private formatCellValueForMessage(value: MySqlTableCellValue): string {
    if (value === null) {
      return "NULL";
    }

    return String(value);
  }

  /**
   * 通过 VS Code 输入框收集单条记录更新值。
   *
   * @param {readonly MySqlTableColumnMetadata[]} columns 当前表字段元数据。
   * @param {Record<string, MySqlTableCellValue>} row 当前页中的原始行。
   * @returns {Promise<MySqlTableUpdateValues | undefined>} 用户提交的更新值；取消时返回 undefined。
   */
  private async promptUpdateValues(
    columns: readonly MySqlTableColumnMetadata[],
    row: Record<string, MySqlTableCellValue>,
  ): Promise<MySqlTableUpdateValues | undefined> {
    const values: Record<string, MySqlTableCellValue> = {};
    const editableColumns = columns.filter(
      (column) => !column.isPrimaryKey && !column.extra.toLowerCase().includes("auto_increment"),
    );

    for (const column of editableColumns) {
      const currentValue = row[column.name] ?? null;
      const value = await vscode.window.showInputBox({
        title: `编辑 ${column.name}`,
        value: currentValue === null ? "" : String(currentValue),
        prompt: `类型：${column.dataType}${column.nullable ? "，可为空" : ""}。留空保持原值；输入 NULL 设置为 NULL。`,
        ignoreFocusOut: true,
      });

      if (value === undefined) {
        return undefined;
      }

      if (value.length === 0) {
        continue;
      }

      const nextValue = value.toUpperCase() === "NULL" ? null : value;

      if (nextValue !== currentValue) {
        values[column.name] = nextValue;
      }
    }

    return values;
  }

  /**
   * 确认是否保存当前尚未写入数据库的修改。
   *
   * @param {string} message 确认弹窗消息。
   * @returns {Promise<boolean>} 用户选择保存时返回 true。
   */
  private async confirmPendingChange(message: string): Promise<boolean> {
    const confirmation = await vscode.window.showWarningMessage(
      message,
      {
        modal: true,
      },
      "保存",
      "放弃",
    );

    return confirmation === "保存";
  }

  /**
   * 加载表字段和行数据，并渲染当前面板状态。
   *
   * @param {MySqlTablePanelState} state 正在渲染的面板状态。
   */
  private async renderTableData(state: MySqlTablePanelState): Promise<void> {
    state.panel.title = `${state.tableNode.tableName} 表数据`;
    state.panel.webview.html = this.renderLoadingHtml(state.tableNode);

    try {
      const [columns, rowPage] = await this.loadTableData(state);
      state.currentSql = rowPage.sql;
      state.latestColumns = columns;
      state.latestRows = rowPage.rows;

      state.panel.webview.html = this.renderTableHtml(state, columns, rowPage);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      state.panel.webview.html = this.renderErrorHtml(state.tableNode, message);
      await showUserErrorMessage({
        operation: "加载表数据",
        error,
      });
    }
  }

  /**
   * 根据表节点类型加载字段和分页行数据。
   *
   * @param {MySqlTablePanelState} state 正在渲染的面板状态。
   * @returns 字段和分页行数据。
   */
  private async loadTableData(
    state: MySqlTablePanelState,
  ): Promise<readonly [readonly MySqlTableColumnMetadata[], MySqlTableRowPage]> {
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
          this.createQueryOptions(state),
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
          this.createQueryOptions(state),
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
        this.createQueryOptions(state),
      ),
    ]);
  }

  /**
   * 将当前面板状态转换为表数据查询选项。
   *
   * @param {MySqlTablePanelState} state 当前面板状态。
   * @returns {MySqlTableQueryOptions} 排序和过滤查询选项。
   */
  private createQueryOptions(state: MySqlTablePanelState): MySqlTableQueryOptions {
    const filterKeyword = state.filterKeyword.trim();
    const hasFilterConditions = state.filterConditions.length > 0;
    return {
      filter:
        filterKeyword.length > 0 || hasFilterConditions
          ? {
              keyword: filterKeyword,
              conditions: state.filterConditions,
            }
          : undefined,
      sort: state.sortColumnName
        ? {
            columnName: state.sortColumnName,
            direction: state.sortDirection,
          }
        : undefined,
    };
  }

  /**
   * 为完整表名创建稳定的面板键。
   *
   * @param {TableDataTreeNode} tableNode 当前选中的表 Tree 节点。
   * @returns {string} 唯一的面板键。
   */
  private createPanelKey(tableNode: TableDataTreeNode): string {
    if (tableNode.kind === "postgresqlTable") {
      return `${tableNode.connection.id}:${tableNode.databaseName}:${tableNode.schemaName}:${tableNode.tableName}`;
    }

    if (tableNode.kind === "sqlite3Table") {
      return `${tableNode.connection.id}:main:${tableNode.tableName}`;
    }

    return `${tableNode.connection.id}:${tableNode.schemaName}:${tableNode.tableName}`;
  }

  /**
   * 从当前面板状态创建可保存到 Webview 的轻量状态。
   *
   * @param {MySqlTablePanelState} state 当前表数据面板状态。
   * @returns {MySqlTablePanelSerializedState} 可由 VS Code 恢复的表数据页状态。
   */
  private createSerializedState(state: MySqlTablePanelState): MySqlTablePanelSerializedState {
    return {
      engine:
        state.tableNode.kind === "postgresqlTable"
          ? "postgresql"
          : state.tableNode.kind === "sqlite3Table"
            ? "sqlite3"
            : "mysql",
      connectionId: state.tableNode.connection.id,
      databaseName:
        state.tableNode.kind === "postgresqlTable" ? state.tableNode.databaseName : undefined,
      schemaName: state.tableNode.schemaName,
      tableName: state.tableNode.tableName,
      pageIndex: state.pageIndex,
      pageSize: state.pageSize,
      filterKeyword: state.filterKeyword,
      filterConditions: state.filterConditions,
      sortColumnName: state.sortColumnName,
      sortDirection: state.sortDirection,
      hiddenColumnNames: Array.from(state.hiddenColumnNames),
    };
  }

  /**
   * 在表数据加载期间渲染临时加载视图。
   *
   * @param {TableDataTreeNode} tableNode 当前选中的表 Tree 节点。
   * @returns {string} 加载状态的 HTML 文档。
   */
  private renderLoadingHtml(tableNode: TableDataTreeNode): string {
    const qualifiedName =
      tableNode.kind === "postgresqlTable"
        ? `${tableNode.databaseName}.${tableNode.schemaName}.${tableNode.tableName}`
        : tableNode.kind === "sqlite3Table"
          ? `${tableNode.connection.name}.${tableNode.tableName}`
          : `${tableNode.schemaName}.${tableNode.tableName}`;
    return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8" />
	<meta name="viewport" content="width=device-width, initial-scale=1.0" />
	<title>${this.escapeHtml(tableNode.tableName)} 表数据</title>
	<style>
		body {
			font-family: var(--vscode-font-family);
			background: var(--vscode-editor-background);
			color: var(--vscode-editor-foreground);
			padding: 24px;
		}
	</style>
</head>
<body>
	<h2>正在加载 ${this.escapeHtml(qualifiedName)}...</h2>
</body>
</html>`;
  }

  /**
   * 为当前表面板渲染错误视图。
   *
   * @param {TableDataTreeNode} tableNode 当前选中的表 Tree 节点。
   * @param {string} message 需要展示的错误消息。
   * @returns {string} 错误状态的 HTML 文档。
   */
  private renderErrorHtml(tableNode: TableDataTreeNode, message: string): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8" />
	<meta name="viewport" content="width=device-width, initial-scale=1.0" />
	<title>${this.escapeHtml(tableNode.tableName)} 表数据</title>
	<style>
		body {
			font-family: var(--vscode-font-family);
			background: var(--vscode-editor-background);
			color: var(--vscode-editor-foreground);
			padding: 24px;
		}
		.error {
			color: var(--vscode-errorForeground);
		}
		button {
			margin-top: 16px;
			padding: 6px 12px;
		}
	</style>
</head>
<body>
	<h2>${this.escapeHtml(tableNode.schemaName)}.${this.escapeHtml(tableNode.tableName)}</h2>
	<p class="error">${this.escapeHtml(message)}</p>
		<button onclick="acquireVsCodeApi().postMessage({ type: 'refresh' })">重试</button>
</body>
</html>`;
  }

  /**
   * 渲染 Webview 状态无法恢复时的错误页。
   *
   * @param {string} message 需要展示的恢复错误。
   * @returns {string} 错误状态的 HTML 文档。
   */
  private renderRestoreErrorHtml(message: string): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8" />
	<meta name="viewport" content="width=device-width, initial-scale=1.0" />
	<title>MySQL 表数据</title>
	<style>
		body {
			font-family: var(--vscode-font-family);
			background: var(--vscode-editor-background);
			color: var(--vscode-editor-foreground);
			padding: 24px;
		}
		.error {
			color: var(--vscode-errorForeground);
		}
	</style>
</head>
<body>
	<h2>MySQL 表数据</h2>
	<p class="error">${this.escapeHtml(message)}</p>
</body>
</html>`;
  }

  /**
   * 渲染完整的表数据 HTML 文档。
   *
   * @param {MySqlTablePanelState} state 当前面板状态。
   * @param {readonly MySqlTableColumnMetadata[]} columns 当前选中表的字段元数据。
   * @param {MySqlTableRowPage} rowPage 当前选中表的分页行数据。
   * @returns {string} 渲染到 Webview 内的 HTML 文档。
   */
  private renderTableHtml(
    state: MySqlTablePanelState,
    columns: readonly MySqlTableColumnMetadata[],
    rowPage: MySqlTableRowPage,
  ): string {
    const tableNode = state.tableNode;
    const isReadOnly = this.isReadOnlyTableNode(tableNode);
    const hasPrimaryKey = !isReadOnly && columns.some((column) => column.isPrimaryKey);
    const readOnlyDisabled = isReadOnly ? " disabled" : "";
    const readOnlyTitle = isReadOnly ? "PostgreSQL 表数据页暂时只支持读取" : "";
    const breadcrumbTitle =
      tableNode.kind === "postgresqlTable"
        ? `${tableNode.connection.name} / ${tableNode.databaseName} / ${tableNode.schemaName} / ${tableNode.tableName}`
        : tableNode.kind === "sqlite3Table"
          ? `${tableNode.connection.name} / ${tableNode.tableName}`
          : `${tableNode.connection.name} / ${tableNode.schemaName} / ${tableNode.tableName}`;
    const databaseBreadcrumb =
      tableNode.kind === "postgresqlTable"
        ? `${this.renderIcon("arrow-right")}
					<span>${this.escapeHtml(tableNode.databaseName)}</span>`
        : "";
    const columnHeaders =
      columns.length === 0
        ? '<th class="empty-header">无字段</th>'
        : columns
            .map((column) => {
              const sortDirection =
                state.sortColumnName === column.name ? state.sortDirection : undefined;
              const hidden = state.hiddenColumnNames.has(column.name);
              const title = [column.dataType, column.isPrimaryKey ? "PK" : undefined]
                .filter((item): item is string => item !== undefined)
                .join(" / ");
              return `<th data-column-name="${this.escapeHtml(column.name)}"${hidden ? " hidden" : ""}>
				<div class="sort-field" data-sort-column="${this.escapeHtml(column.name)}" title="${this.escapeHtml(title)}">
					<span>${this.escapeHtml(column.name)}</span>
					<span class="sort-icons">
						<span class="sort-icon up${sortDirection === "desc" ? " selected" : ""}"></span>
						<span class="sort-icon down${sortDirection === "asc" ? " selected" : ""}"></span>
					</span>
				</div>
			</th>`;
            })
            .join("");

    const rowsMarkup =
      rowPage.rows.length === 0
        ? `<tr><td colspan="${Math.max(columns.length, 1)}" class="empty-cell">暂无数据</td></tr>`
        : rowPage.rows
            .map(
              (row, rowIndex) =>
                `<tr data-row-index="${rowIndex}">${
                  columns.length === 0
                    ? '<td class="empty-cell">无字段</td>'
                    : columns
                        .map((column) =>
                          this.renderCell(
                            rowIndex,
                            column,
                            row[column.name] ?? null,
                            hasPrimaryKey,
                            state.hiddenColumnNames.has(column.name),
                          ),
                        )
                        .join("")
                }</tr>`,
            )
            .join("");
    const pageNumber = rowPage.pageIndex + 1;
    const pageCount = Math.max(1, Math.ceil(rowPage.totalRowCount / rowPage.pageSize));
    const columnVisibilityControls = columns
      .map((column) => {
        const checked = state.hiddenColumnNames.has(column.name) ? "" : " checked";
        return `<label class="column-toggle">
					<input type="checkbox" data-column-name="${this.escapeHtml(column.name)}"${checked} />
					<span>${this.escapeHtml(column.name)}</span>
				</label>`;
      })
      .join("");
    const serializedState = this.serializeScriptValue(this.createSerializedState(state));
    const paginatedSql = this.serializeScriptValue(rowPage.sql);
    const sqlWithoutPagination = this.serializeScriptValue(rowPage.sqlWithoutPagination);
    const filterConditions = this.serializeScriptValue(state.filterConditions);
    const filterColumnNames = this.serializeScriptValue(columns.map((column) => column.name));
    const iconSprite = this.renderIconSprite();

    return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8" />
	<meta name="viewport" content="width=device-width, initial-scale=1.0" />
	<title>${this.escapeHtml(tableNode.tableName)} 表数据</title>
	<style>
		:root {
			color-scheme: light dark;
		}
		body {
			--padding-h: .88em;
			--color0: 0, 0, 0;
			--color1: 255, 255, 255;
			margin: 0;
			padding: 0;
			font-family: var(--vscode-font-family);
			font-size: var(--vscode-font-size);
			background: var(--vscode-editor-background);
			color: var(--vscode-editor-foreground);
			line-height: 1;
		}
		header nav {
			padding: .38em var(--padding-h);
			color: var(--vscode-descriptionForeground);
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		}
		header nav span {
			font-size: .9em;
		}
		header nav svg {
			margin: 0 .3em;
			opacity: .72;
		}
		header nav .active {
			color: var(--vscode-editor-foreground);
		}
		.operations {
			box-sizing: border-box;
			display: flex;
			justify-content: space-between;
			align-items: center;
			height: 2em;
			padding: 0 var(--padding-h);
			background: var(--vscode-button-background);
			color: var(--vscode-button-foreground);
			white-space: nowrap;
		}
		.btns,
		.pagination,
		.dialog-actions {
			display: flex;
			align-items: center;
		}
		.btns {
			flex: 0 0 auto;
		}
		.pagination {
			flex: 0 0 auto;
			font-size: .86em;
		}
		button {
			font: inherit;
			cursor: pointer;
		}
		.operations button {
			box-sizing: border-box;
			min-width: auto;
			height: 2em;
			border: 0;
			border-radius: 1px;
			background: transparent;
			color: inherit;
			padding: 0 .5em;
			line-height: 2;
			text-align: center;
		}
		.operations .btns > .icon-btn {
			padding: 0 .58em;
		}
		.operations button:hover:not(:disabled),
		.operations button:focus-visible {
			background: var(--vscode-button-hoverBackground);
			outline: none;
		}
		.operations button:disabled {
			opacity: .38;
			cursor: default;
		}
		.pagination .txt {
			font-size: .8em;
			margin: 0 .2em;
		}
		.pagination button {
			padding: 0 .28em;
		}
		.pagination button.big svg {
			transform: scale(1.3);
		}
		.pagination .page-input {
			box-sizing: border-box;
			width: 2.2em;
			height: 1.3em;
			border: 0;
			border-radius: 4px;
			background: rgba(var(--color1), .1);
			color: inherit;
			padding: 0 .16em;
			text-align: center;
		}
		.pagination .page-size {
			margin: 0 .3em;
		}
		.icon {
			width: 1em;
			height: 1em;
			vertical-align: -0.15em;
			fill: currentColor;
			overflow: hidden;
		}
		.table-wrapper {
			height: calc(100vh - 3.76rem);
			overflow: auto;
		}
		table.pne {
			min-width: 100%;
			border-collapse: collapse;
			border-spacing: 0;
		}
		.pne thead {
			background: rgba(var(--color0), .68);
		}
		.pne th,
		.pne td {
			box-sizing: border-box;
			max-width: 16em;
			height: 2em;
			padding: 0 .5em;
			border: 0;
			line-height: 2em;
			text-align: left;
			white-space: nowrap;
			overflow: hidden;
			text-overflow: ellipsis;
		}
		.pne thead th {
			position: sticky;
			top: 0;
			background: rgba(var(--color1), .08);
			color: var(--vscode-editor-foreground);
			z-index: 1;
		}
		.pne tr > *:first-child {
			padding-left: 1em;
		}
		.pne tbody tr:nth-child(even) {
			background: rgba(var(--color1), .06);
		}
		.pne tbody tr:hover {
			background: rgba(var(--color1), .1);
		}
		.pne tr.highlight {
			background: rgba(var(--color1), .1) !important;
		}
		.pne th.highlight,
		.pne td.highlight {
			background: rgba(var(--color1), .1);
		}
		.sort-field {
			display: flex;
			align-items: center;
			min-width: 0;
			cursor: pointer;
		}
		.sort-field span:first-child {
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		}
		.sort-icons {
			position: relative;
			display: inline-block;
			flex: 0 0 auto;
			width: .73em;
			height: .86em;
			margin-left: .5em;
			cursor: pointer;
		}
		.sort-icon {
			display: block;
			position: absolute;
			left: .08em;
			width: 0;
			height: 0;
			opacity: .5;
			border-left: .24em solid transparent;
			border-right: .24em solid transparent;
		}
		.sort-icon.selected {
			opacity: 1;
		}
		.sort-icon.up {
			top: .06em;
			border-bottom: .32em solid currentColor;
		}
		.sort-icon.down {
			bottom: .06em;
			border-top: .32em solid currentColor;
		}
		.pne td {
			cursor: cell;
			outline: none;
		}
		.pne td:hover {
			background: rgba(var(--color1), .1);
		}
		.pne td:focus {
			white-space: initial;
		}
		.empty-cell {
			text-align: center;
			color: var(--vscode-descriptionForeground);
		}
		.empty-header {
			color: var(--vscode-descriptionForeground);
		}
		.dialog-mask {
			display: none;
			position: fixed;
			inset: 0;
			z-index: 10;
			align-items: center;
			justify-content: center;
			background: rgba(var(--color0), .5);
		}
		body[data-dialog="search"] #searchDialog,
		body[data-dialog="fields"] #fieldsDialog,
		body[data-dialog="sql"] #sqlDialog {
			display: flex;
		}
		.dialog {
			box-sizing: border-box;
			width: min(38em, calc(100vw - 2rem));
			max-height: calc(100vh - 2rem);
			overflow: auto;
			border: 1px solid rgba(var(--color1), .08);
			border-radius: .8em;
			background: rgba(var(--color0), .95);
			color: var(--vscode-editor-foreground);
			box-shadow: 0 .5rem 1.5rem rgba(0, 0, 0, .28);
		}
		.dialog-title {
			padding: .9em 1.8em .7em;
			border-bottom: 1px solid rgba(var(--color1), .18);
			font-size: .95em;
			font-weight: bold;
			opacity: .9;
			text-align: center;
		}
		.dialog-body {
			min-height: 13em;
			padding: .8em 1.8em;
		}
		.dialog-body label {
			display: block;
			margin-bottom: .62rem;
		}
		.dialog-body input:not([type="checkbox"]):not([type="radio"]),
		.dialog-body select {
			box-sizing: border-box;
			width: 100%;
			min-height: 1.9rem;
			margin-top: .28rem;
			border: 1px solid var(--vscode-input-border, transparent);
			background: var(--vscode-input-background);
			color: var(--vscode-input-foreground);
			padding: .28rem .45rem;
		}
		.search-dialog .dialog-body {
			min-height: 15em;
			padding: 1.8em;
		}
		.search-condition-list {
			display: grid;
			gap: 1.2em;
		}
		.search-condition-row {
			display: flex;
			align-items: center;
		}
		.search-condition-row select,
		.search-condition-row input,
		.search-keyword input {
			height: 2em;
			color: inherit;
			text-align: center;
			border: 1px solid rgba(var(--color1), .3);
			border-radius: 1em;
			background-color: transparent;
			appearance: none;
			outline: none;
		}
		.search-condition-row select:focus,
		.search-condition-row input:focus,
		.search-keyword input:focus {
			border-color: var(--vscode-focusBorder);
		}
		.search-condition-row select option {
			color: initial;
		}
		.search-condition-row > .condition-column {
			width: 12.31em;
			margin-right: 1em;
		}
		.search-condition-row > .condition-operator {
			width: 3.8em;
			margin-right: 1em;
		}
		.search-condition-row > .condition-value,
		.search-condition-row > .input-array {
			width: 12em;
			flex: 1;
			margin-right: .5em;
		}
		.input-array-item {
			display: flex;
			margin-bottom: .8em;
		}
		.input-array-item input {
			flex: 1;
			margin-right: .5em;
		}
		.search-condition-row button,
		.add-condition-button,
		.add-array-item {
			min-width: 2rem;
			border: 0;
			border-radius: 1em;
			background: transparent;
			color: inherit;
			opacity: .5;
			padding: .28rem .55rem;
			transition: all .1s ease;
		}
		.search-condition-row button:hover:not(:disabled),
		.add-condition-button:hover:not(:disabled),
		.add-array-item:hover:not(:disabled) {
			background: rgba(var(--color1), .1);
			opacity: 1;
		}
		.add-condition-button {
			display: block;
			margin: 1.2em auto 0;
		}
		.search-condition-row[data-null-operator="true"] .condition-value {
			visibility: hidden;
		}
		.search-keyword {
			margin-top: 1.4em;
			opacity: .82;
		}
		.search-keyword label {
			display: grid;
			gap: .45em;
			margin: 0;
		}
		.column-grid {
			display: flex;
			flex-wrap: wrap;
			padding: .7em .6em 0 .2em;
		}
		.field-dialog .dialog-body {
			padding: 1.5em .6em .6em 2em;
		}
		.column-toggle {
			display: flex;
			align-items: center;
			gap: .38rem;
			min-width: 0;
			margin-right: 2em;
			margin-bottom: 1em;
		}
		.column-toggle input {
			width: auto;
			min-height: auto;
			margin: 0;
		}
		.column-toggle span {
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		}
		.dialog-actions {
			justify-content: center;
			gap: .6em;
			padding: .8em 1.8em 1em;
			border-top: 1px solid rgba(var(--color1), .18);
		}
		.dialog-actions button {
			min-width: 6em;
			height: 2em;
			border: 0;
			border-radius: 1px;
			background: var(--vscode-button-background);
			color: var(--vscode-button-foreground);
			padding: 0 1em;
		}
		.dialog-actions button.secondary {
			background: var(--vscode-button-background);
			color: var(--vscode-button-foreground);
		}
		pre.sql-view {
			max-height: 18rem;
			margin: 0;
			flex: 1;
			overflow: auto;
			white-space: pre-wrap;
			font-family: var(--vscode-editor-font-family, var(--vscode-font-family));
			font-size: .9em;
		}
		.sql-dialog .dialog-body {
			display: flex;
			flex-direction: column;
			padding: 1em 2em;
			line-height: 2;
		}
		.sql-pagination-options {
			display: flex;
			gap: 1rem;
			margin-top: .85rem;
		}
		.dialog-body .sql-pagination-options label {
			display: inline-flex;
			align-items: center;
			gap: .32rem;
			margin: 0;
		}
		.dialog-body .sql-pagination-options input {
			width: auto;
			min-height: auto;
			margin: 0;
		}
		@media (max-width: 900px) {
			.search-condition-row {
				align-items: stretch;
				flex-direction: column;
				gap: .7em;
			}
			.search-condition-row > .condition-column,
			.search-condition-row > .condition-operator,
			.search-condition-row > .condition-value,
			.search-condition-row > .input-array {
				width: 100%;
				margin-right: 0;
			}
			.search-condition-row[data-null-operator="true"] .condition-value,
			.search-condition-row[data-null-operator="true"] .input-array {
				display: none;
			}
		}
	</style>
</head>
<body>
	${iconSprite}
		<header>
			<nav title="${this.escapeHtml(breadcrumbTitle)}">
				<span>${this.escapeHtml(tableNode.connection.name)}</span>
				${this.renderIcon("arrow-right")}
				${databaseBreadcrumb}
				<span>${this.escapeHtml(tableNode.schemaName)}</span>
				${this.renderIcon("arrow-right")}
				<span class="active">${this.escapeHtml(tableNode.tableName)}</span>
			</nav>
		<div class="operations">
			<div class="btns">
				<button type="button" class="icon-btn" title="刷新" onclick="postAction('refresh')">${this.renderIcon("light")}</button>
				<button type="button" class="icon-btn" title="搜索" onclick="showDialog('search')">${this.renderIcon("search")}</button>
				<button type="button" class="icon-btn" title="字段选择" onclick="showDialog('fields')">${this.renderIcon("filter")}</button>
				<button type="button" class="icon-btn" title="${isReadOnly ? this.escapeHtml(readOnlyTitle) : "插入"}" onclick="postAction('insertRow')"${readOnlyDisabled}>${this.renderIcon("add")}</button>
				<button type="button" class="icon-btn" title="拷贝" id="copyButton" onclick="copyFocusedRow()" disabled>${this.renderIcon("copy")}</button>
				<button type="button" class="icon-btn" title="保存" id="saveButton" onclick="saveEditedRows()" disabled>${this.renderIcon("save")}</button>
				<button type="button" class="icon-btn" title="撤销全部" id="undoButton" onclick="undoEditedRows()" disabled>${this.renderIcon("undo")}</button>
				<button type="button" class="icon-btn" title="删除" id="deleteButton" onclick="deleteFocusedRow()" disabled>${this.renderIcon("delete")}</button>
				<button type="button" class="icon-btn" title="查看当前 sql" onclick="showDialog('sql')">${this.renderIcon("sql")}</button>
				<button type="button" class="icon-btn" title="${isReadOnly ? "PostgreSQL SQL 终端尚未支持" : "打开终端"}" onclick="postAction('openSqlTerminal')"${readOnlyDisabled}>${this.renderIcon("terminal")}</button>
			</div>
			<div class="pagination">
				<button type="button" class="icon-btn" title="刷新" onclick="applyPagination()">${this.renderIcon("refresh")}</button>
				<span class="txt">每页</span>
				<input id="pageSizeInput" class="page-input page-size" value="${rowPage.pageSize}" inputmode="numeric" />
				<span class="txt">条记录，共 </span>
				<span>${rowPage.totalRowCount}</span>
				<span class="txt"> 条、</span>
				<span>${pageCount}</span><span class="txt"> 页</span>
				<button type="button" class="icon-btn big" title="第一页" onclick="goToPage(1)" ${pageNumber <= 1 ? "disabled" : ""}>${this.renderIcon("arrow-left2")}</button>
				<button type="button" class="icon-btn big" title="上一页" onclick="goToPage(${Math.max(1, pageNumber - 1)})" ${pageNumber <= 1 ? "disabled" : ""}>${this.renderIcon("arrow-left")}</button>
				<input id="pageIndexInput" class="page-input" value="${pageNumber}" inputmode="numeric" />
				<button type="button" class="icon-btn big" title="下一页" onclick="goToPage(${Math.min(pageCount, pageNumber + 1)})" ${pageNumber >= pageCount ? "disabled" : ""}>${this.renderIcon("arrow-right")}</button>
				<button type="button" class="icon-btn big" title="最后一页" onclick="goToPage(${pageCount})" ${pageNumber >= pageCount ? "disabled" : ""}>${this.renderIcon("arrow-right2")}</button>
			</div>
		</div>
	</header>
	<div class="table-wrapper">
		<table class="pne">
			<thead>
				<tr>${columnHeaders}</tr>
			</thead>
			<tbody>
				${rowsMarkup}
			</tbody>
		</table>
	</div>
	<div class="dialog-mask" id="searchDialog" role="dialog" aria-modal="true">
		<div class="dialog search-dialog">
			<div class="dialog-title">搜索数据</div>
			<div class="dialog-body">
				<div id="filterConditions" class="search-condition-list"></div>
				<button type="button" class="add-condition-button" onclick="addFilterCondition()">+</button>
				<div class="search-keyword">
					<label>
						<span>关键字</span>
						<input id="filterKeyword" value="${this.escapeHtml(state.filterKeyword)}" />
					</label>
				</div>
			</div>
			<div class="dialog-actions">
				<button type="button" onclick="applyQueryOptions()">搜索</button>
				<button type="button" onclick="emptySearch()">清空</button>
				<button type="button" onclick="closeDialog()">关闭</button>
			</div>
		</div>
	</div>
	<div class="dialog-mask" id="fieldsDialog" role="dialog" aria-modal="true">
		<div class="dialog field-dialog">
			<div class="dialog-title">字段选择</div>
			<div class="dialog-body">
				<div class="column-grid">
					${columnVisibilityControls}
				</div>
			</div>
			<div class="dialog-actions">
				<button type="button" onclick="setAllColumns(true)">全选</button>
				<button type="button" onclick="invertColumns()">反选</button>
				<button type="button" onclick="setAllColumns(false)">全不选</button>
				<button type="button" onclick="closeDialog()">关闭</button>
			</div>
		</div>
	</div>
	<div class="dialog-mask" id="sqlDialog" role="dialog" aria-modal="true">
		<div class="dialog sql-dialog">
			<div class="dialog-title">查看 SQL</div>
			<div class="dialog-body">
				<pre class="sql-view"><code id="sqlViewerContent">${this.escapeHtml(rowPage.sqlWithoutPagination)}</code></pre>
				<div class="sql-pagination-options">
					<label>
						<input type="radio" name="sqlPaginationMode" value="with" onchange="updateSqlViewer()" />
						<span>带分页</span>
					</label>
					<label>
						<input type="radio" name="sqlPaginationMode" value="without" onchange="updateSqlViewer()" checked />
						<span>不带</span>
					</label>
				</div>
			</div>
			<div class="dialog-actions">
				<button type="button" onclick="openCurrentSqlDocument()">在新文件中打开</button>
				<button type="button" onclick="copyCurrentSql()">复制到剪切板</button>
				<button type="button" onclick="openCurrentSqlInTerminal()">在终端中打开</button>
				<button type="button" class="secondary" onclick="closeDialog()">关闭</button>
			</div>
		</div>
	</div>
	<script>
		const vscode = acquireVsCodeApi();
		const initialState = ${serializedState};
		let currentState = { ...initialState };
		const paginatedSql = ${paginatedSql};
		const sqlWithoutPagination = ${sqlWithoutPagination};
			const filterColumnNames = ${filterColumnNames};
			let filterConditions = ${filterConditions};
			const isReadOnly = ${isReadOnly ? "true" : "false"};
			const hasPrimaryKey = ${hasPrimaryKey ? "true" : "false"};
		const totalRowCount = ${rowPage.totalRowCount};
		let focusedRowIndex = undefined;
		const editing = {};
		vscode.setState(currentState);
		function persistState(nextState) {
			currentState = {
				...currentState,
				...nextState
			};
			vscode.setState(currentState);
		}
		function postAction(type) {
			if ((type === 'refresh' || type === 'deleteRow') && hasPendingEdits()) {
				warnPendingEdits();
				return;
			}
			vscode.postMessage({ type });
		}
		function hasPendingEdits() {
			return Object.keys(editing).length > 0;
		}
		function warnPendingEdits() {
			window.alert('请先保存或撤销修改');
		}
		function getPageCount(pageSize) {
			return Math.max(1, Math.ceil(totalRowCount / pageSize));
		}
		function normalizePageSize() {
			const input = document.getElementById('pageSizeInput');
			const parsedSize = Number.parseInt(input.value, 10);
			if (!Number.isFinite(parsedSize) || parsedSize <= 0) {
				input.value = String(currentState.pageSize);
				return currentState.pageSize;
			}
			return parsedSize;
		}
		function normalizePageIndex(pageSize) {
			const input = document.getElementById('pageIndexInput');
			const parsedIndex = Number.parseInt(input.value, 10);
			const pageCount = getPageCount(pageSize);
			if (!Number.isFinite(parsedIndex) || parsedIndex <= 0) {
				input.value = '1';
				return 1;
			}
			if (parsedIndex >= pageCount) {
				input.value = String(pageCount);
				return pageCount;
			}
			return parsedIndex;
		}
		function applyPagination() {
			if (hasPendingEdits()) {
				warnPendingEdits();
				return;
			}
			const pageSize = normalizePageSize();
			requestPage(normalizePageIndex(pageSize), pageSize);
		}
		function goToPage(pageNumber) {
			if (hasPendingEdits()) {
				warnPendingEdits();
				return;
			}
			const pageSize = normalizePageSize();
			const pageCount = getPageCount(pageSize);
			const normalizedPageNumber = Math.min(Math.max(1, pageNumber), pageCount);
			requestPage(normalizedPageNumber, pageSize);
		}
		function requestPage(pageNumber, pageSize) {
			const nextPageIndex = Math.max(0, pageNumber - 1);
			document.getElementById('pageIndexInput').value = String(pageNumber);
			persistState({
				pageIndex: nextPageIndex,
				pageSize
			});
			vscode.postMessage({
				type: 'goToPage',
				pageIndex: nextPageIndex,
				pageSize
			});
		}
		function sortByColumn(columnName) {
			let sortColumnName = columnName;
			let sortDirection = 'asc';
			if (currentState.sortColumnName === columnName) {
				if (currentState.sortDirection === 'asc') {
					sortDirection = 'desc';
				} else {
					sortColumnName = '';
					sortDirection = 'asc';
				}
			}
			persistState({
				sortColumnName,
				sortDirection,
				pageIndex: 0
			});
			vscode.postMessage({
				type: 'applyQueryOptions',
				filterKeyword: currentState.filterKeyword,
				filterConditions: currentState.filterConditions || [],
				sortColumnName,
				sortDirection
			});
		}
		function showDialog(dialogName) {
			document.body.dataset.dialog = dialogName;
			if (dialogName === 'search') {
				renderFilterConditions();
			}
			if (dialogName === 'sql') {
				updateSqlViewer();
			}
		}
		function closeDialog() {
			document.body.removeAttribute('data-dialog');
		}
		function escapeClientHtml(value) {
			return String(value)
				.replaceAll('&', '&amp;')
				.replaceAll('<', '&lt;')
				.replaceAll('>', '&gt;')
				.replaceAll('"', '&quot;')
				.replaceAll("'", '&#39;');
		}
		function isNullFilterOperator(operator) {
			return operator === 'null' || operator === 'not null';
		}
		function getConditionInputValue(condition) {
			if (Array.isArray(condition.value)) {
				return condition.value;
			}
			return condition.value || '';
		}
		function isArrayFilterOperator(operator) {
			return operator === 'in' || operator === 'not in';
		}
		function renderConditionValueControl(condition) {
			if (isNullFilterOperator(condition.operator)) {
				return '<div class="condition-value filler"></div>';
			}
			if (!isArrayFilterOperator(condition.operator)) {
				return '<input class="condition-value" value="' +
					escapeClientHtml(getConditionInputValue(condition)) + '" />';
			}
			const values = Array.isArray(condition.value) && condition.value.length > 0
				? condition.value
				: [''];
			const items = values.map((value) => [
				'<div class="input-array-item">',
				'<input class="condition-array-value" value="' + escapeClientHtml(value) + '" />',
				'<button type="button" class="condition-array-remove" title="删除">×</button>',
				'</div>'
			].join('')).join('');
			return [
				'<div class="input-array">',
				items,
				'<button type="button" class="add-array-item" title="新增">+</button>',
				'</div>'
			].join('');
		}
		function renderFilterConditions() {
			const container = document.getElementById('filterConditions');
			if (!container) {
				return;
			}
			const operators = ['=', '!=', '>', '>=', '<', '<=', 'like', 'in', 'not in', 'null', 'not null'];
			container.innerHTML = filterConditions.map((condition, index) => {
				const normalizedCondition = {
					columnName: condition.columnName || filterColumnNames[0] || '',
					operator: operators.includes(condition.operator) ? condition.operator : '=',
					value: condition.value
				};
				const columnOptions = filterColumnNames.map((columnName) =>
					'<option value="' + escapeClientHtml(columnName) + '"' +
					(normalizedCondition.columnName === columnName ? ' selected' : '') +
					'>' + escapeClientHtml(columnName) + '</option>'
				).join('');
				const operatorOptions = operators.map((operator) =>
					'<option value="' + escapeClientHtml(operator) + '"' +
					(normalizedCondition.operator === operator ? ' selected' : '') +
					'>' + escapeClientHtml(operator) + '</option>'
				).join('');
				const isNullOperator = isNullFilterOperator(normalizedCondition.operator);
				return [
					'<div class="search-condition-row" data-null-operator="' + String(isNullOperator) + '">',
					'<select class="condition-column">' + columnOptions + '</select>',
					'<select class="condition-operator">' + operatorOptions + '</select>',
					renderConditionValueControl(normalizedCondition),
					'<button type="button" class="condition-remove" title="删除">×</button>',
					'</div>'
				].join('');
			}).join('');
			for (const [index, row] of Array.from(container.querySelectorAll('.search-condition-row')).entries()) {
				row.querySelector('.condition-column')?.addEventListener('change', () => {
					filterConditions = collectFilterConditions();
				});
				row.querySelector('.condition-value')?.addEventListener('input', () => {
					filterConditions = collectFilterConditions();
				});
				for (const input of row.querySelectorAll('.condition-array-value')) {
					input.addEventListener('input', () => {
						filterConditions = collectFilterConditions();
					});
				}
				row.querySelector('.condition-operator')?.addEventListener('change', (event) => {
					filterConditions = collectFilterConditions();
					const operator = event.target.value;
					if (operator === 'like') {
						const current = filterConditions[index];
						if (current && !current.value) {
							filterConditions[index] = { ...current, value: '%%' };
						}
					} else if (isArrayFilterOperator(operator)) {
						const current = filterConditions[index];
						if (current && !Array.isArray(current.value)) {
							filterConditions[index] = { ...current, value: [''] };
						}
					}
					renderFilterConditions();
				});
				row.querySelector('.add-array-item')?.addEventListener('click', () => {
					filterConditions = collectFilterConditions();
					const current = filterConditions[index];
					if (current) {
						const values = Array.isArray(current.value) ? [...current.value] : [];
						values.push('');
						filterConditions[index] = { ...current, value: values };
					}
					renderFilterConditions();
				});
				for (const [arrayIndex, button] of Array.from(row.querySelectorAll('.condition-array-remove')).entries()) {
					button.addEventListener('click', () => {
						filterConditions = collectFilterConditions();
						const current = filterConditions[index];
						if (current) {
							const values = Array.isArray(current.value) ? [...current.value] : [];
							values.splice(arrayIndex, 1);
							filterConditions[index] = { ...current, value: values.length > 0 ? values : [''] };
						}
						renderFilterConditions();
					});
				}
				row.querySelector('.condition-remove')?.addEventListener('click', () => {
					filterConditions = collectFilterConditions();
					filterConditions.splice(index, 1);
					renderFilterConditions();
				});
			}
		}
		function collectFilterConditions() {
			const rows = Array.from(document.querySelectorAll('#filterConditions .search-condition-row'));
			return rows.map((row) => {
				const columnName = row.querySelector('.condition-column')?.value || '';
				const operator = row.querySelector('.condition-operator')?.value || '=';
				const rawValue = row.querySelector('.condition-value')?.value || '';
				const condition = {
					columnName,
					operator
				};
				if (!isNullFilterOperator(operator)) {
					condition.value = isArrayFilterOperator(operator)
						? Array.from(row.querySelectorAll('.condition-array-value')).map((item) => item.value)
						: rawValue;
				}
				return condition;
			}).filter((condition) => condition.columnName.length > 0);
		}
		function addFilterCondition() {
			filterConditions = collectFilterConditions();
			filterConditions.push({
				columnName: filterColumnNames[0] || '',
				operator: '=',
				value: ''
			});
			renderFilterConditions();
		}
		function getCurrentSql() {
			const selectedMode = document.querySelector('input[name="sqlPaginationMode"]:checked')?.value;
			return selectedMode === 'with' ? paginatedSql : sqlWithoutPagination;
		}
		function updateSqlViewer() {
			const viewer = document.getElementById('sqlViewerContent');
			if (viewer) {
				viewer.innerText = getCurrentSql();
			}
		}
		function copyCurrentSql() {
			vscode.postMessage({
				type: 'copyCurrentSql',
				sql: getCurrentSql()
			});
		}
		function openCurrentSqlDocument() {
			vscode.postMessage({
				type: 'openCurrentSqlDocument',
				sql: getCurrentSql()
			});
		}
		function openCurrentSqlInTerminal() {
			vscode.postMessage({
				type: 'openSqlTerminal',
				sql: getCurrentSql()
			});
		}
		function editRow(rowIndex) {
			vscode.postMessage({
				type: 'editRow',
				rowIndex
			});
		}
		function deleteRow(rowIndex) {
			if (hasPendingEdits()) {
				warnPendingEdits();
				return;
			}
			vscode.postMessage({
				type: 'deleteRow',
				rowIndex
			});
		}
		function setFocusedCell(cell) {
			const row = cell.closest('tr[data-row-index]');
			if (!row) {
				return;
			}
			focusedRowIndex = Number.parseInt(row.dataset.rowIndex, 10);
			for (const item of document.querySelectorAll('.pne .highlight')) {
				item.classList.remove('highlight');
			}
			row.classList.add('highlight');
			const cellIndex = Array.from(row.children).indexOf(cell);
			for (const headerCell of document.querySelectorAll('.pne thead th')) {
				headerCell.classList.toggle(
					'highlight',
					Array.from(headerCell.parentElement.children).indexOf(headerCell) === cellIndex
				);
			}
			cell.classList.add('highlight');
			updateToolbarState();
		}
		function updateToolbarState() {
			const hasFocus = focusedRowIndex !== undefined && Number.isFinite(focusedRowIndex);
			const hasEditing = Object.keys(editing).length > 0;
			document.getElementById('copyButton').disabled = isReadOnly || !hasFocus;
			document.getElementById('deleteButton').disabled = isReadOnly || !hasPrimaryKey || !hasFocus;
			document.getElementById('saveButton').disabled = isReadOnly || !hasPrimaryKey || !hasEditing;
			document.getElementById('undoButton').disabled = isReadOnly || !hasPrimaryKey || !hasEditing;
		}
		function recordCellEdit(cell) {
			const row = cell.closest('tr[data-row-index]');
			if (!row) {
				return;
			}
			const rowIndex = row.dataset.rowIndex;
			const columnName = cell.dataset.columnName;
			const originalValue = cell.dataset.originalValue;
			const nextValue = cell.innerText;
			if (!editing[rowIndex]) {
				editing[rowIndex] = {};
			}
			if (nextValue === originalValue) {
				delete editing[rowIndex][columnName];
				if (Object.keys(editing[rowIndex]).length === 0) {
					delete editing[rowIndex];
				}
			} else {
				editing[rowIndex][columnName] =
					nextValue.toUpperCase() === 'NULL' ? null : nextValue;
			}
			updateToolbarState();
		}
		function saveEditedRows() {
			const edits = Object.entries(editing).map(([rowIndex, values]) => ({
				rowIndex: Number.parseInt(rowIndex, 10),
				values
			}));
			vscode.postMessage({
				type: 'saveEditedRows',
				edits
			});
		}
		function undoEditedRows() {
			if (!window.confirm('撤销全部？\\n您可以使用 ctrl-z(windows) 或 cmd-z(macos) 来撤销一小步')) {
				return;
			}
			for (const cell of document.querySelectorAll('[data-original-value]')) {
				cell.innerText = cell.dataset.originalValue;
			}
			for (const rowIndex of Object.keys(editing)) {
				delete editing[rowIndex];
			}
			updateToolbarState();
		}
		function deleteFocusedRow() {
			if (focusedRowIndex !== undefined) {
				deleteRow(focusedRowIndex);
			}
		}
		function copyFocusedRow() {
			if (focusedRowIndex !== undefined) {
				vscode.postMessage({
					type: 'copyRow',
					rowIndex: focusedRowIndex
				});
			}
		}
		function applyQueryOptions() {
			const filterKeyword = document.getElementById('filterKeyword').value;
			filterConditions = collectFilterConditions();
			const sortColumnName = currentState.sortColumnName || '';
			const sortDirection = currentState.sortDirection || 'asc';
			persistState({
				filterKeyword,
				filterConditions,
				sortColumnName,
				sortDirection,
				pageIndex: 0
			});
			vscode.postMessage({
				type: 'applyQueryOptions',
				filterKeyword,
				filterConditions,
				sortColumnName,
				sortDirection
			});
		}
		function emptySearch() {
			filterConditions = [];
			const filterKeyword = document.getElementById('filterKeyword');
			if (filterKeyword) {
				filterKeyword.value = '';
			}
			renderFilterConditions();
			persistState({
				filterKeyword: '',
				filterConditions: [],
				pageIndex: currentState.pageIndex
			});
		}
		function setAllColumns(checked) {
			for (const checkbox of document.querySelectorAll('#fieldsDialog [data-column-name]')) {
				checkbox.checked = checked;
			}
			applyColumnVisibility();
		}
		function invertColumns() {
			for (const checkbox of document.querySelectorAll('#fieldsDialog [data-column-name]')) {
				checkbox.checked = !checkbox.checked;
			}
			applyColumnVisibility();
		}
		function applyColumnVisibility() {
			const hiddenColumnNames = [];
			for (const checkbox of document.querySelectorAll('#fieldsDialog [data-column-name]')) {
				if (!checkbox.checked) {
					hiddenColumnNames.push(checkbox.dataset.columnName);
				}
			}
			updateColumnVisibilityInDocument(hiddenColumnNames);
			persistState({ hiddenColumnNames });
			vscode.postMessage({
				type: 'setVisibleColumns',
				hiddenColumnNames
			});
		}
		function updateColumnVisibilityInDocument(hiddenColumnNames) {
			const hiddenColumnNameSet = new Set(hiddenColumnNames);
			for (const cell of document.querySelectorAll('.pne [data-column-name]')) {
				cell.hidden = hiddenColumnNameSet.has(cell.dataset.columnName);
			}
		}
		document.addEventListener('keydown', (event) => {
			if (event.key === 'Escape') {
				closeDialog();
			}
		});
		for (const header of document.querySelectorAll('[data-sort-column]')) {
			header.addEventListener('click', () => sortByColumn(header.dataset.sortColumn));
		}
		for (const cell of document.querySelectorAll('.pne tbody td[data-column-name]')) {
			cell.addEventListener('click', () => setFocusedCell(cell));
			cell.addEventListener('input', () => recordCellEdit(cell));
		}
		for (const checkbox of document.querySelectorAll('#fieldsDialog [data-column-name]')) {
			checkbox.addEventListener('change', () => applyColumnVisibility());
		}
		updateToolbarState();
	</script>
</body>
</html>`;
  }

  /**
   * 按旧 PPZ 表格结构渲染单个表格单元格。
   *
   * @param {number} rowIndex 当前页行索引。
   * @param {MySqlTableColumnMetadata} column 当前单元格所属字段元数据。
   * @param {string | number | boolean | null} value 待渲染的单元格值。
   * @param {boolean} canEditRow 当前表是否允许通过主键编辑行。
   * @param {boolean} hidden 当前字段是否初始隐藏。
   * @returns {string} HTML 表格单元格标记。
   */
  private renderCell(
    rowIndex: number,
    column: MySqlTableColumnMetadata,
    value: string | number | boolean | null,
    canEditRow: boolean,
    hidden: boolean,
  ): string {
    const displayValue = value === null ? "" : String(value);
    const editable =
      canEditRow && !column.isPrimaryKey && !column.extra.toLowerCase().includes("auto_increment");

    return `<td
			data-row-index="${rowIndex}"
			data-column-name="${this.escapeHtml(column.name)}"
			data-original-value="${this.escapeHtml(displayValue)}"
			title="${this.escapeHtml(`${column.name}: ${column.dataType}`)}"
			${editable ? 'contenteditable="true"' : ""}
			${hidden ? "hidden" : ""}
		>${this.escapeHtml(displayValue)}</td>`;
  }

  /**
   * 渲染旧 PPZ iconfont 的 SVG symbol 子集。
   *
   * @returns {string} 当前表数据页工具栏所需的隐藏 SVG 符号。
   */
  private renderIconSprite(): string {
    return `<svg aria-hidden="true" style="position:absolute;width:0;height:0;overflow:hidden">
			<symbol id="icon-search" viewBox="0 0 1024 1024"><path d="M956.29141 864.626199 806.130436 705.068204c46.465265-72.432683 71.080895-160.022577 65.098647-252.750491-14.762215-229.339292-211.081463-403.244041-438.438611-388.447033C205.400578 78.668711 33.067628 276.605805 47.83189 505.930771c14.797008 229.405807 211.054857 403.307486 438.47238 388.512525 94.259804-6.135744 179.073468-43.763736 245.01532-102.06149l145.643078 154.744363c25.171286 20.206204 63.346747 18.111496 85.221964-4.709255C984.122269 919.6637 981.461673 884.818077 956.29141 864.626199zM477.945905 760.445442c-157.312862 10.117428-293.166993-109.276822-303.415404-266.750343-10.282181-157.375284 108.952434-293.200762 266.266319-303.31819 157.313885-10.123568 293.235554 109.304452 303.484989 266.663362C754.55785 614.530165 635.25979 750.322897 477.945905 760.445442z"></path></symbol>
			<symbol id="icon-terminal" viewBox="0 0 1024 1024"><path d="M128 128h768a42.666667 42.666667 0 0 1 42.666667 42.666667v682.666666a42.666667 42.666667 0 0 1-42.666667 42.666667H128a42.666667 42.666667 0 0 1-42.666667-42.666667V170.666667a42.666667 42.666667 0 0 1 42.666667-42.666667z m384 512v85.333333h256v-85.333333h-256z m-153.002667-128l-120.661333 120.661333L298.666667 693.034667 479.701333 512 298.666667 330.965333 238.336 391.338667 358.997333 512z"></path></symbol>
			<symbol id="icon-undo" viewBox="0 0 1024 1024"><path d="M884.451 455.595c-18.251-42.96-44.333-81.57-77.521-114.758s-71.797-59.269-114.758-77.521c-44.598-18.947-91.854-28.553-140.456-28.553H373.73c-0.93 0-1.852 0.031-2.772 0.07V86.666c0-17.787-21.505-26.695-34.083-14.117L116.843 292.581c-7.797 7.797-7.797 20.438 0 28.235l220.032 220.032c12.577 12.577 34.083 3.67 34.083-14.117V362.693c0.92 0.039 1.842 0.07 2.772 0.07h177.986c128.636 0 233.288 104.652 233.288 233.288 0 128.636-104.652 233.288-233.288 233.288H373.73c-35.346 0-64 28.653-64 64s28.654 64 64 64h177.986c48.603 0 95.858-9.606 140.456-28.554 42.961-18.251 81.57-44.333 114.758-77.521s59.27-71.797 77.521-114.758c18.947-44.598 28.554-91.854 28.554-140.456s-9.607-95.857-28.554-140.455z"></path></symbol>
			<symbol id="icon-save" viewBox="0 0 1024 1024"><path d="M725.333333 128H213.333333c-46.933333 0-85.333333 38.4-85.333333 85.333333v597.333334c0 46.933333 38.4 85.333333 85.333333 85.333333h597.333334c46.933333 0 85.333333-38.4 85.333333-85.333333V298.666667l-170.666667-170.666667z m-213.333333 682.666667c-72.533333 0-128-55.466667-128-128s55.466667-128 128-128 128 55.466667 128 128-55.466667 128-128 128z m128-426.666667H213.333333V213.333333h426.666667v170.666667z"></path></symbol>
			<symbol id="icon-sql" viewBox="0 0 1024 1024"><path d="M271.1 327.5 208.6 382.7c-22-30.6-44.3-45.8-67.1-45.8-11.1 0-20.1 3-27.2 8.9-7 5.9-10.6 12.6-10.6 20.1 0 7.4 2.5 14.5 7.6 21.1 6.8 8.9 27.5 27.9 61.9 57 32.2 26.9 51.8 43.9 58.6 51 17.1 17.3 29.3 33.8 36.4 49.6 7.1 15.8 10.7 33 10.7 51.7 0 36.4-12.6 66.5-37.7 90.2-25.2 23.7-58 35.6-98.4 35.6-31.6 0-59.1-7.7-82.6-23.2-23.4-15.5-43.5-39.8-60.2-73l71-42.8c21.3 39.2 45.9 58.8 73.7 58.8 14.5 0 26.7-4.2 36.6-12.7 9.9-8.4 14.8-18.2 14.8-29.3 0-10.1-3.7-20.1-11.2-30.2-7.5-10.1-23.9-25.4-49.2-46.1-48.3-39.4-79.6-69.8-93.7-91.2-14.1-21.4-21.1-42.8-21.1-64.1 0-30.8 11.7-57.2 35.2-79.2 23.4-22 52.4-33 86.8-33 22.1 0 43.2 5.1 63.3 15.4C226.1 281.6 247.8 300.3 271.1 327.5z"></path><path d="M709.2 646l77.2 99.8-100 0-39.2-50.5c-32.4 17.8-68.6 26.6-108.4 26.6-66.6 0-122-23-166.1-68.9-44.1-45.9-66.1-100.7-66.1-164.2 0-42.4 10.3-81.4 30.8-116.9 20.5-35.5 48.7-63.7 84.7-84.6 35.9-20.9 74.5-31.4 115.7-31.4 63 0 117 22.7 162.2 68.2 45.2 45.4 67.8 100.8 67.8 166.2C767.8 550.5 748.2 602.3 709.2 646zM656.5 577.8c17.9-26.5 26.8-55.9 26.8-88.1 0-42-14.2-77.7-42.6-107.1-28.4-29.3-62.7-44-103-44-41.5 0-76.2 14.3-104.2 42.8-28 28.6-42 64.8-42 108.9 0 49.1 17.6 87.9 52.9 116.4 27.6 22.3 58.9 33.5 94 33.5 20.1 0 39.1-3.9 56.8-11.8l-79.4-102.2 100.7 0L656.5 577.8z"></path><path d="M816.5 267.1l84.4 0 0 363.1L1024 630.2l0 80.5L816.5 710.7 816.5 267.1z"></path></symbol>
			<symbol id="icon-copy" viewBox="0 0 1024 1024"><path d="M808.768 197.312c10.432 0 17.408 6.912 17.408 17.344l0 485.568c0 10.368-6.976 17.344-17.408 17.344l-87.296 0c-19.136 0-34.944 15.552-34.944 34.624 0 19.136 15.808 34.688 34.944 34.688l104.768 0c38.464 0 69.824-31.168 69.824-69.312l0-520.32C896 159.168 864.64 128 826.176 128l-384 0c-38.4 0-69.824 31.232-69.824 69.312l0 34.688c0 19.072 15.68 34.688 34.88 34.688 19.2 0 34.88-15.616 34.88-34.688L442.112 214.656c0-10.432 6.976-17.344 17.408-17.344L808.768 197.312z"></path><path d="M128 363.968l0 469.376C128 867.84 160.32 896 199.808 896l394.944 0c39.488 0 71.872-28.16 71.872-62.656L666.624 363.968c0-34.432-32.384-62.592-71.872-62.592L199.808 301.376C160.32 301.376 128 329.536 128 363.968z"></path></symbol>
			<symbol id="icon-arrow-right2" viewBox="0 0 1024 1024"><path d="M265.386667 292.266667l30.293333-29.866667a21.333333 21.333333 0 0 1 30.293333 0l219.306667 218.88a32 32 0 0 1 9.386667 22.613333v16.213334a32.853333 32.853333 0 0 1-9.386667 22.613333l-219.306667 218.88a21.333333 21.333333 0 0 1-30.293333 0l-30.293333-30.293333a20.906667 20.906667 0 0 1 0-29.866667L455.253333 512 265.386667 322.56a21.333333 21.333333 0 0 1 0-30.293333zM661.333333 768h42.666667a21.333333 21.333333 0 0 0 21.333333-21.333333v-469.333334a21.333333 21.333333 0 0 0-21.333333-21.333333h-42.666667a21.333333 21.333333 0 0 0-21.333333 21.333333v469.333334a21.333333 21.333333 0 0 0 21.333333 21.333333z"></path></symbol>
			<symbol id="icon-arrow-left" viewBox="0 0 1024 1024"><path d="M350.72 542.72a32 32 0 0 1-9.386667-22.613333v-16.213334a32.853333 32.853333 0 0 1 9.386667-22.613333l219.306667-218.88a21.333333 21.333333 0 0 1 30.293333 0l30.293333 30.293333a20.906667 20.906667 0 0 1 0 29.866667L440.746667 512l189.866666 189.44a21.333333 21.333333 0 0 1 0 30.293333l-30.293333 29.866667a21.333333 21.333333 0 0 1-30.293333 0z"></path></symbol>
			<symbol id="icon-arrow-right" viewBox="0 0 1024 1024"><path d="M673.28 481.28a32 32 0 0 1 9.386667 22.613333v16.213334a32.853333 32.853333 0 0 1-9.386667 22.613333l-219.306667 218.88a21.333333 21.333333 0 0 1-30.293333 0l-30.293333-30.293333a20.906667 20.906667 0 0 1 0-29.866667L583.253333 512 393.386667 322.56a21.333333 21.333333 0 0 1 0-30.293333l30.293333-29.866667a21.333333 21.333333 0 0 1 30.293333 0z"></path></symbol>
			<symbol id="icon-arrow-left2" viewBox="0 0 1024 1024"><path d="M758.613333 731.733333l-30.293333 29.866667a21.333333 21.333333 0 0 1-30.293333 0l-219.306667-218.88a32 32 0 0 1-9.386667-22.613333v-16.213334a32.853333 32.853333 0 0 1 9.386667-22.613333l219.306667-218.88a21.333333 21.333333 0 0 1 30.293333 0l30.293333 30.293333a20.906667 20.906667 0 0 1 0 29.866667L568.746667 512l189.866666 189.44a21.333333 21.333333 0 0 1 0 30.293333zM362.666667 256h-42.666667a21.333333 21.333333 0 0 0-21.333333 21.333333v469.333334a21.333333 21.333333 0 0 0 21.333333 21.333333h42.666667a21.333333 21.333333 0 0 0 21.333333-21.333333v-469.333334a21.333333 21.333333 0 0 0-21.333333-21.333333z"></path></symbol>
			<symbol id="icon-refresh" viewBox="0 0 1024 1024"><path d="M149.824 640h-60.096l128-128 128 128h-55.552a256.192 256.192 0 0 0 443.648 0h140.352A384.128 384.128 0 0 1 149.76 640zM874.24 384h56.128l-128 128-128-128h59.52a256.192 256.192 0 0 0-443.648 0H149.824A384.128 384.128 0 0 1 874.24 384z"></path></symbol>
			<symbol id="icon-add" viewBox="0 0 1024 1024"><path d="M876.089 439.182h-291.271v-291.271c0-40.268-32.549-72.818-72.818-72.818s-72.818 32.549-72.818 72.818v291.271h-291.271c-40.268 0-72.818 32.549-72.818 72.818s32.549 72.818 72.818 72.818h291.271v291.271c0 40.268 32.549 72.818 72.818 72.818s72.818-32.549 72.818-72.818v-291.271h291.271c40.268 0 72.818-32.549 72.818-72.818s-32.549-72.818-72.818-72.818z"></path></symbol>
			<symbol id="icon-delete" viewBox="0 0 1024 1024"><path d="M896 196.923077H649.846154V118.153846c0-43.323077-35.446154-78.769231-78.769231-78.769231h-118.153846c-43.323077 0-78.769231 35.446154-78.769231 78.769231v78.769231H128c-15.753846 0-29.538462 13.784615-29.538462 29.538461v59.076924c0 15.753846 13.784615 29.538462 29.538462 29.538461h768c15.753846 0 29.538462-13.784615 29.538462-29.538461v-59.076924c0-15.753846-13.784615-29.538462-29.538462-29.538461zM452.923077 137.846154c0-11.815385 7.876923-19.692308 19.692308-19.692308h78.76923c11.815385 0 19.692308 7.876923 19.692308 19.692308v59.076923h-118.153846V137.846154z m364.307692 256h-610.461538c-15.753846 0-29.538462 13.784615-29.538462 29.538461V886.153846c0 55.138462 43.323077 98.461538 98.461539 98.461539h472.615384c55.138462 0 98.461538-43.323077 98.461539-98.461539V423.384615c0-15.753846-13.784615-29.538462-29.538462-29.538461zM452.923077 827.076923c0 11.815385-7.876923 19.692308-19.692308 19.692308h-39.384615c-11.815385 0-19.692308-7.876923-19.692308-19.692308V551.384615c0-11.815385 7.876923-19.692308 19.692308-19.692307h39.384615c11.815385 0 19.692308 7.876923 19.692308 19.692307v275.692308z m196.923077 0c0 11.815385-7.876923 19.692308-19.692308 19.692308h-39.384615c-11.815385 0-19.692308-7.876923-19.692308-19.692308V551.384615c0-11.815385 7.876923-19.692308 19.692308-19.692307h39.384615c11.815385 0 19.692308 7.876923 19.692308 19.692307v275.692308z"></path></symbol>
			<symbol id="icon-filter" viewBox="0 0 1024 1024"><path d="M825.6 117.333333H198.4C157.866667 117.333333 123.733333 151.466667 123.733333 192v4.266667c0 14.933333 6.4 32 17.066667 42.666666l256 302.933334v251.733333c0 12.8 6.4 23.466667 17.066667 27.733333l162.133333 81.066667 2.133333 2.133333c21.333333 8.533333 42.666667-6.4 42.666667-29.866666V541.866667l256-302.933334c27.733333-32 23.466667-78.933333-8.533333-104.533333-8.533333-10.666667-25.6-17.066667-42.666667-17.066667z"></path></symbol>
			<symbol id="icon-light" viewBox="0 0 1024 1024"><path d="M893.6 371.68C888.672 359.744 876.96 352 864.032 352l-248.096 0 55.328-249.12c3.072-13.888-3.36-28.16-15.84-35.008s-27.968-4.704-38.016 5.408l-480 480c-9.152 9.152-11.904 22.976-6.944 34.944S147.104 608 160.032 608l242.304 0-112.384 308.992c-5.12 14.08 0.224 29.856 12.896 37.92 5.28 3.328 11.264 4.96 17.184 4.96 8.256 0 16.48-3.2 22.656-9.376l544-543.968C895.808 397.376 898.56 383.648 893.6 371.68z"></path></symbol>
		</svg>`;
  }

  /**
   * 渲染旧 PPZ iconfont 图标引用。
   *
   * @param {string} iconId 旧 PPZ iconfont 中的图标标识。
   * @returns {string} SVG 图标引用。
   */
  private renderIcon(iconId: string): string {
    return `<svg class="icon" aria-hidden="true"><use href="#icon-${this.escapeHtml(iconId)}"></use></svg>`;
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
   * 将数据安全序列化为可嵌入 script 的 JSON。
   *
   * @param {unknown} value 需要嵌入 Webview 脚本的数据。
   * @returns {string} 经过转义的 JSON 字符串。
   */
  private serializeScriptValue(value: unknown): string {
    return JSON.stringify(value)
      .replaceAll("<", "\\u003c")
      .replaceAll(">", "\\u003e")
      .replaceAll("&", "\\u0026")
      .replaceAll("\u2028", "\\u2028")
      .replaceAll("\u2029", "\\u2029");
  }
}
