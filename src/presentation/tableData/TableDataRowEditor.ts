import * as vscode from "vscode";

import type {
  TableCellValue,
  TableColumnMetadata,
  TableInsertValues,
  TableRowIdentityValues,
  TableUpdateValues,
} from "../../application/shared/TableDataTypes";
import type { DeleteMySqlTableRowUseCase } from "../../application/useCases/mysql/DeleteMySqlTableRowUseCase";
import type { InsertMySqlTableRowUseCase } from "../../application/useCases/mysql/InsertMySqlTableRowUseCase";
import type { ListMySqlTableColumnsUseCase } from "../../application/useCases/mysql/ListMySqlTableColumnsUseCase";
import type { UpdateMySqlTableRowUseCase } from "../../application/useCases/mysql/UpdateMySqlTableRowUseCase";
import type { DeleteSqlite3TableRowUseCase } from "../../application/useCases/sqlite3/DeleteSqlite3TableRowUseCase";
import type { InsertSqlite3TableRowUseCase } from "../../application/useCases/sqlite3/InsertSqlite3TableRowUseCase";
import type { ListSqlite3TableColumnsUseCase } from "../../application/useCases/sqlite3/ListSqlite3TableColumnsUseCase";
import type { UpdateSqlite3TableRowUseCase } from "../../application/useCases/sqlite3/UpdateSqlite3TableRowUseCase";
import { showUserErrorMessage } from "../commands/UserErrorPresenter";
import type {
  MySqlTableTreeNode,
  Sqlite3TableTreeNode,
} from "../explorer/DatabaseConnectionsTreeNode";
import { showReadOnlyTableMessage } from "./TableDataPanelState";
import type { DatabaseTablePanelState } from "./TableDataPanelState";

/**
 * 汇集行编辑编排所需的读写用例。
 */
export interface TableDataRowEditorDeps {
  /** 用于加载 MySQL 表字段的用例。 */
  readonly listMySqlTableColumnsUseCase: ListMySqlTableColumnsUseCase;
  /** 用于加载 SQLite3 表字段的用例。 */
  readonly listSqlite3TableColumnsUseCase: ListSqlite3TableColumnsUseCase;
  /** 用于新增 MySQL 表记录的用例。 */
  readonly insertMySqlTableRowUseCase: InsertMySqlTableRowUseCase;
  /** 用于更新 MySQL 表记录的用例。 */
  readonly updateMySqlTableRowUseCase: UpdateMySqlTableRowUseCase;
  /** 用于删除 MySQL 表记录的用例。 */
  readonly deleteMySqlTableRowUseCase: DeleteMySqlTableRowUseCase;
  /** 用于新增 SQLite3 表记录的用例。 */
  readonly insertSqlite3TableRowUseCase: InsertSqlite3TableRowUseCase;
  /** 用于更新 SQLite3 表记录的用例。 */
  readonly updateSqlite3TableRowUseCase: UpdateSqlite3TableRowUseCase;
  /** 用于删除 SQLite3 表记录的用例。 */
  readonly deleteSqlite3TableRowUseCase: DeleteSqlite3TableRowUseCase;
}

/**
 * 编排表数据页的行级写操作：新增、拷贝、编辑、内联保存和删除。
 *
 * 写入成功后通过注入的 reload 回调通知面板重新加载数据。
 */
export class TableDataRowEditor {
  /**
   * 创建行编辑编排器。
   *
   * @param {TableDataRowEditorDeps} deps 行级读写用例集合。
   * @param {(state: DatabaseTablePanelState) => Promise<void>} reload 写入成功后重新加载面板数据的回调。
   */
  public constructor(
    private readonly deps: TableDataRowEditorDeps,
    private readonly reload: (state: DatabaseTablePanelState) => Promise<void>,
  ) {}

  /**
   * 从当前面板状态中读取可写的 MySQL 表节点。
   *
   * @param {DatabaseTablePanelState} state 当前表数据面板状态。
   * @returns {MySqlTableTreeNode | undefined} MySQL 表节点；非 MySQL 表时返回 undefined。
   */
  private getMySqlTableNode(state: DatabaseTablePanelState): MySqlTableTreeNode | undefined {
    return state.tableNode.kind === "table" ? state.tableNode : undefined;
  }

  /**
   * 从当前面板状态中读取可写的 SQLite3 表节点。
   *
   * @param {DatabaseTablePanelState} state 当前表数据面板状态。
   * @returns {Sqlite3TableTreeNode | undefined} SQLite3 表节点；非 SQLite3 表时返回 undefined。
   */
  private getSqlite3TableNode(state: DatabaseTablePanelState): Sqlite3TableTreeNode | undefined {
    return state.tableNode.kind === "sqlite3Table" ? state.tableNode : undefined;
  }
  /**
   * 收集字段值并新增一条表记录。
   *
   * @param {DatabaseTablePanelState} state 当前表数据面板状态。
   */
  public async insertRow(
    state: DatabaseTablePanelState,
    sourceRow?: Record<string, TableCellValue>,
  ): Promise<void> {
    try {
      const tableNode = this.getMySqlTableNode(state);
      const sqlite3TableNode = this.getSqlite3TableNode(state);

      if (!tableNode && !sqlite3TableNode) {
        await showReadOnlyTableMessage();
        return;
      }

      const columns = tableNode
        ? await this.deps.listMySqlTableColumnsUseCase.execute(
            tableNode.connection,
            tableNode.schemaName,
            tableNode.tableName,
          )
        : await this.deps.listSqlite3TableColumnsUseCase.execute(
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
        ? await this.deps.insertMySqlTableRowUseCase.execute(
            tableNode.connection,
            tableNode.schemaName,
            tableNode.tableName,
            values,
          )
        : await this.deps.insertSqlite3TableRowUseCase.execute(
            sqlite3TableNode!.connection,
            sqlite3TableNode!.tableName,
            values,
          );

      state.pageIndex = 0;
      await vscode.window.showInformationMessage(`已新增 ${result.affectedRows} 条记录。`);
      await this.reload(state);
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
   * @param {DatabaseTablePanelState} state 当前表数据面板状态。
   * @param {number} rowIndex 当前页行索引。
   */
  public async copyRow(state: DatabaseTablePanelState, rowIndex: number): Promise<void> {
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
   * @param {readonly TableColumnMetadata[]} columns 当前表字段元数据。
   * @param {Record<string, TableCellValue>} sourceRow 作为新增默认值的来源行。
   * @returns {Promise<TableInsertValues | undefined>} 用户提交的字段值；取消时返回 undefined。
   */
  private async promptInsertValues(
    columns: readonly TableColumnMetadata[],
    sourceRow?: Record<string, TableCellValue>,
  ): Promise<TableInsertValues | undefined> {
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
   * @param {DatabaseTablePanelState} state 当前表数据面板状态。
   * @param {number} rowIndex 当前页行索引。
   */
  public async editRow(state: DatabaseTablePanelState, rowIndex: number): Promise<void> {
    try {
      const tableNode = this.getMySqlTableNode(state);
      const sqlite3TableNode = this.getSqlite3TableNode(state);

      if (!tableNode && !sqlite3TableNode) {
        await showReadOnlyTableMessage();
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
        ? await this.deps.updateMySqlTableRowUseCase.execute(
            tableNode.connection,
            tableNode.schemaName,
            tableNode.tableName,
            identityValues,
            values,
          )
        : await this.deps.updateSqlite3TableRowUseCase.execute(
            sqlite3TableNode!.connection,
            sqlite3TableNode!.tableName,
            identityValues,
            values,
          );

      await vscode.window.showInformationMessage(`已保存 ${result.affectedRows} 条记录。`);
      await this.reload(state);
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
  public async saveEditedRows(
    state: DatabaseTablePanelState,
    edits: readonly {
      readonly rowIndex: number;
      readonly values: Record<string, string | number | boolean | null>;
    }[],
  ): Promise<void> {
    try {
      const tableNode = this.getMySqlTableNode(state);
      const sqlite3TableNode = this.getSqlite3TableNode(state);

      if (!tableNode && !sqlite3TableNode) {
        await showReadOnlyTableMessage();
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
            readonly row: Record<string, TableCellValue>;
            readonly values: TableUpdateValues;
          } => edit !== undefined,
        );

      if (normalizedEdits.length === 0) {
        await vscode.window.showInformationMessage("没有待保存的数据");
        return;
      }

      let affectedRows = 0;
      for (const edit of normalizedEdits) {
        const result = tableNode
          ? await this.deps.updateMySqlTableRowUseCase.execute(
              tableNode.connection,
              tableNode.schemaName,
              tableNode.tableName,
              this.createIdentityValues(primaryKeyColumns, edit.row),
              edit.values,
            )
          : await this.deps.updateSqlite3TableRowUseCase.execute(
              sqlite3TableNode!.connection,
              sqlite3TableNode!.tableName,
              this.createIdentityValues(primaryKeyColumns, edit.row),
              edit.values,
            );
        affectedRows += result.affectedRows;
      }

      await vscode.window.showInformationMessage(`已保存 ${affectedRows} 条记录。`);
      await this.reload(state);
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
   * @param {readonly TableColumnMetadata[]} columns 当前表字段元数据。
   * @param {Record<string, string | number | boolean | null>} values Webview 提交的原始字段值。
   * @returns {TableUpdateValues} 可传入更新用例的字段值。
   */
  private normalizeInlineEditValues(
    columns: readonly TableColumnMetadata[],
    values: Record<string, string | number | boolean | null>,
  ): TableUpdateValues {
    const editableColumnNames = new Set(
      columns
        .filter(
          (column) =>
            !column.isPrimaryKey && !column.extra.toLowerCase().includes("auto_increment"),
        )
        .map((column) => column.name),
    );
    const normalizedValues: Record<string, TableCellValue> = {};

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
   * @param {readonly TableColumnMetadata[]} primaryKeyColumns 主键字段列表。
   * @param {Record<string, TableCellValue>} row 当前页中的原始行。
   * @returns {TableRowIdentityValues} 原行定位值。
   */
  private createIdentityValues(
    primaryKeyColumns: readonly TableColumnMetadata[],
    row: Record<string, TableCellValue>,
  ): TableRowIdentityValues {
    return Object.fromEntries(
      primaryKeyColumns.map((column) => [column.name, row[column.name] ?? null]),
    );
  }

  /**
   * 删除当前页中的一条表记录。
   *
   * @param {DatabaseTablePanelState} state 当前表数据面板状态。
   * @param {number} rowIndex 当前页行索引。
   */
  public async deleteRow(state: DatabaseTablePanelState, rowIndex: number): Promise<void> {
    try {
      const tableNode = this.getMySqlTableNode(state);
      const sqlite3TableNode = this.getSqlite3TableNode(state);

      if (!tableNode && !sqlite3TableNode) {
        await showReadOnlyTableMessage();
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
        ? await this.deps.deleteMySqlTableRowUseCase.execute(
            tableNode.connection,
            tableNode.schemaName,
            tableNode.tableName,
            this.createIdentityValues(primaryKeyColumns, row),
          )
        : await this.deps.deleteSqlite3TableRowUseCase.execute(
            sqlite3TableNode!.connection,
            sqlite3TableNode!.tableName,
            this.createIdentityValues(primaryKeyColumns, row),
          );

      await vscode.window.showInformationMessage(`已删除 ${result.affectedRows} 条记录。`);
      await this.reload(state);
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
   * @param {readonly TableColumnMetadata[]} primaryKeyColumns 当前表主键字段列表。
   * @param {Record<string, TableCellValue>} row 当前准备删除的记录。
   * @returns {string} 展示给用户确认的删除风险说明。
   */
  private createDeleteWarningMessage(
    primaryKeyColumns: readonly TableColumnMetadata[],
    row: Record<string, TableCellValue>,
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
   * @param {TableCellValue} value 单元格原始展示值。
   * @returns {string} 可放入 VS Code 消息框的文本。
   */
  private formatCellValueForMessage(value: TableCellValue): string {
    if (value === null) {
      return "NULL";
    }

    return String(value);
  }

  /**
   * 通过 VS Code 输入框收集单条记录更新值。
   *
   * @param {readonly TableColumnMetadata[]} columns 当前表字段元数据。
   * @param {Record<string, TableCellValue>} row 当前页中的原始行。
   * @returns {Promise<TableUpdateValues | undefined>} 用户提交的更新值；取消时返回 undefined。
   */
  private async promptUpdateValues(
    columns: readonly TableColumnMetadata[],
    row: Record<string, TableCellValue>,
  ): Promise<TableUpdateValues | undefined> {
    const values: Record<string, TableCellValue> = {};
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
}
