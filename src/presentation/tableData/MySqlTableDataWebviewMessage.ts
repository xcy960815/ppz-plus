import type { MySqlTableFilterCondition } from "../../application/mysql/MySqlTableDataProvider";

/**
 * 请求当前表面板的上一页数据。
 */
export interface MySqlTableDataPreviousPageMessage {
  readonly type: "previousPage";
}

/**
 * 请求当前表面板的下一页数据。
 */
export interface MySqlTableDataNextPageMessage {
  readonly type: "nextPage";
}

/**
 * 请求跳转到指定分页状态。
 */
export interface MySqlTableDataGoToPageMessage {
  readonly type: "goToPage";
  readonly pageIndex: number;
  readonly pageSize: number;
}

/**
 * 请求重新加载当前表面板页。
 */
export interface MySqlTableDataRefreshMessage {
  readonly type: "refresh";
}

/**
 * 请求按新的过滤和排序条件加载当前表面板。
 */
export interface MySqlTableDataApplyQueryOptionsMessage {
  readonly type: "applyQueryOptions";
  readonly filterKeyword: string;
  readonly filterConditions?: readonly MySqlTableFilterCondition[];
  readonly sortColumnName: string;
  readonly sortDirection: "asc" | "desc";
}

/**
 * 请求清空过滤和排序条件。
 */
export interface MySqlTableDataClearQueryOptionsMessage {
  readonly type: "clearQueryOptions";
}

/**
 * 请求更新当前表面板的可见字段。
 */
export interface MySqlTableDataSetVisibleColumnsMessage {
  readonly type: "setVisibleColumns";
  readonly hiddenColumnNames: readonly string[];
}

/**
 * 请求使用当前 SQL 打开 SQL 终端。
 */
export interface MySqlTableDataOpenSqlTerminalMessage {
  readonly type: "openSqlTerminal";
  readonly sql?: string;
}

/**
 * 请求复制当前查看的 SQL。
 */
export interface MySqlTableDataCopyCurrentSqlMessage {
  readonly type: "copyCurrentSql";
  readonly sql: string;
}

/**
 * 请求在临时 SQL 文档中打开当前查看的 SQL。
 */
export interface MySqlTableDataOpenCurrentSqlDocumentMessage {
  readonly type: "openCurrentSqlDocument";
  readonly sql: string;
}

/**
 * 请求新增一条表记录。
 */
export interface MySqlTableDataInsertRowMessage {
  readonly type: "insertRow";
}

/**
 * 请求以当前页中的一条表记录作为默认值新增记录。
 */
export interface MySqlTableDataCopyRowMessage {
  readonly type: "copyRow";
  readonly rowIndex: number;
}

/**
 * 请求编辑当前页中的一条表记录。
 */
export interface MySqlTableDataEditRowMessage {
  readonly type: "editRow";
  readonly rowIndex: number;
}

/**
 * 请求删除当前页中的一条表记录。
 */
export interface MySqlTableDataDeleteRowMessage {
  readonly type: "deleteRow";
  readonly rowIndex: number;
}

/**
 * 请求保存当前页面上的内联单元格编辑。
 */
export interface MySqlTableDataSaveEditedRowsMessage {
  readonly type: "saveEditedRows";
  readonly edits: readonly {
    readonly rowIndex: number;
    readonly values: Record<string, string | number | boolean | null>;
  }[];
}

/**
 * 描述 MySQL 表数据 Webview 可接收的消息。
 */
export type MySqlTableDataWebviewMessage =
  | MySqlTableDataPreviousPageMessage
  | MySqlTableDataNextPageMessage
  | MySqlTableDataGoToPageMessage
  | MySqlTableDataRefreshMessage
  | MySqlTableDataApplyQueryOptionsMessage
  | MySqlTableDataClearQueryOptionsMessage
  | MySqlTableDataSetVisibleColumnsMessage
  | MySqlTableDataOpenSqlTerminalMessage
  | MySqlTableDataCopyCurrentSqlMessage
  | MySqlTableDataOpenCurrentSqlDocumentMessage
  | MySqlTableDataInsertRowMessage
  | MySqlTableDataCopyRowMessage
  | MySqlTableDataEditRowMessage
  | MySqlTableDataDeleteRowMessage
  | MySqlTableDataSaveEditedRowsMessage;
