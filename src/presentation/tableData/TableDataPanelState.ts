import * as vscode from "vscode";

import type {
  TableCellValue,
  TableColumnMetadata,
  TableFilterCondition,
  TableQueryOptions,
  TableSortDirection,
} from "../../application/shared/TableDataTypes";
import type {
  MySqlTableTreeNode,
  PostgreSqlTableTreeNode,
  Sqlite3TableTreeNode,
} from "../explorer/DatabaseConnectionsTreeNode";

/**
 * 表示当前表数据页可打开的表节点。
 */
export type TableDataTreeNode = MySqlTableTreeNode | PostgreSqlTableTreeNode | Sqlite3TableTreeNode;

/**
 * 表示当前表数据页已经支持恢复的连接配置。
 */
export type TableDataConnection = TableDataTreeNode["connection"];

/**
 * 保存表数据页使用的默认分页大小。
 */
export const DEFAULT_TABLE_PAGE_SIZE = 30;

/**
 * 保存单个数据库表数据面板的可变状态。
 */
export interface DatabaseTablePanelState {
  readonly panel: vscode.WebviewPanel;
  readonly tableNode: TableDataTreeNode;
  pageIndex: number;
  pageSize: number;
  filterKeyword: string;
  filterConditions: readonly TableFilterCondition[];
  sortColumnName?: string;
  sortDirection: TableSortDirection;
  hiddenColumnNames: Set<string>;
  currentSql?: string;
  latestColumns: readonly TableColumnMetadata[];
  latestRows: readonly Record<string, TableCellValue>[];
}

/**
 * 保存表数据页可由 VS Code 恢复的轻量状态。
 */
export interface DatabaseTablePanelSerializedState {
  readonly engine: "mysql" | "postgresql" | "sqlite3";
  readonly connectionId: string;
  readonly databaseName?: string;
  readonly schemaName: string;
  readonly tableName: string;
  readonly pageIndex: number;
  readonly pageSize: number;
  readonly filterKeyword: string;
  readonly filterConditions: readonly TableFilterCondition[];
  readonly sortColumnName?: string;
  readonly sortDirection: TableSortDirection;
  readonly hiddenColumnNames: readonly string[];
}

/**
 * 判断当前表节点是否只读。
 *
 * @param {TableDataTreeNode} tableNode 当前表节点。
 * @returns {boolean} 是否只开放只读能力。
 */
export function isReadOnlyTableNode(tableNode: TableDataTreeNode): boolean {
  return tableNode.kind === "postgresqlTable";
}

/**
 * 展示只读表页提示。
 */
export async function showReadOnlyTableMessage(): Promise<void> {
  await vscode.window.showInformationMessage("当前 PostgreSQL 表数据页暂时只支持读取。");
}

/**
 * 为完整表名创建稳定的面板键。
 *
 * @param {TableDataTreeNode} tableNode 当前选中的表 Tree 节点。
 * @returns {string} 唯一的面板键。
 */
export function createPanelKey(tableNode: TableDataTreeNode): string {
  if (tableNode.kind === "postgresqlTable") {
    return `${tableNode.connection.id}:${tableNode.databaseName}:${tableNode.schemaName}:${tableNode.tableName}`;
  }

  if (tableNode.kind === "sqlite3Table") {
    return `${tableNode.connection.id}:main:${tableNode.tableName}`;
  }

  return `${tableNode.connection.id}:${tableNode.schemaName}:${tableNode.tableName}`;
}

/**
 * 将当前面板状态转换为表数据查询选项。
 *
 * @param {DatabaseTablePanelState} state 当前面板状态。
 * @returns {TableQueryOptions} 排序和过滤查询选项。
 */
export function createQueryOptions(state: DatabaseTablePanelState): TableQueryOptions {
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
 * 从当前面板状态创建可保存到 Webview 的轻量状态。
 *
 * @param {DatabaseTablePanelState} state 当前表数据面板状态。
 * @returns {DatabaseTablePanelSerializedState} 可由 VS Code 恢复的表数据页状态。
 */
export function createSerializedState(
  state: DatabaseTablePanelState,
): DatabaseTablePanelSerializedState {
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
 * 根据恢复状态创建表节点。
 *
 * @param {TableDataConnection} connection 已恢复的连接配置。
 * @param {DatabaseTablePanelSerializedState} restoredState 已解析的 Webview 状态。
 * @returns {TableDataTreeNode} 可供表数据页使用的表节点。
 */
export function createRestoredTableNode(
  connection: TableDataConnection,
  restoredState: DatabaseTablePanelSerializedState,
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
 * 解析 VS Code 保存的表数据页 Webview 状态。
 *
 * @param {unknown} value 原始恢复状态。
 * @param {number} defaultPageSize 无效分页大小时使用的默认分页大小。
 * @returns {DatabaseTablePanelSerializedState | undefined} 可用于恢复表数据页的轻量状态；无效时为空。
 */
export function parseSerializedState(
  value: unknown,
  defaultPageSize: number = DEFAULT_TABLE_PAGE_SIZE,
): DatabaseTablePanelSerializedState | undefined {
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
        : defaultPageSize,
    filterKeyword: typeof filterKeyword === "string" ? filterKeyword : "",
    filterConditions: parseFilterConditions(filterConditions),
    sortColumnName:
      typeof sortColumnName === "string" && sortColumnName.length > 0 ? sortColumnName : undefined,
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
 * @returns {readonly TableFilterCondition[]} 可传给应用层的字段过滤条件列表。
 */
function parseFilterConditions(value: unknown): readonly TableFilterCondition[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => parseFilterCondition(item))
    .filter((item): item is TableFilterCondition => item !== undefined);
}

/**
 * 解析单条字段过滤条件。
 *
 * @param {unknown} value 原始字段过滤条件值。
 * @returns {TableFilterCondition | undefined} 可用字段过滤条件；无效时为空。
 */
function parseFilterCondition(value: unknown): TableFilterCondition | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const filterCondition = value as Record<string, unknown>;
  const columnName = filterCondition.columnName;
  const operator = filterCondition.operator;
  const rawConditionValue = filterCondition.value;

  if (typeof columnName !== "string" || !isSupportedFilterOperator(operator)) {
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
 * @returns {value is TableFilterCondition['operator']} 是否为支持的过滤操作符。
 */
function isSupportedFilterOperator(value: unknown): value is TableFilterCondition["operator"] {
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
