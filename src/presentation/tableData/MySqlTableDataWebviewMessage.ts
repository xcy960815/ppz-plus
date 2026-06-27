/**
 * 请求当前表面板的上一页数据。
 */
export interface MySqlTableDataPreviousPageMessage {
	readonly type: 'previousPage';
}

/**
 * 请求当前表面板的下一页数据。
 */
export interface MySqlTableDataNextPageMessage {
	readonly type: 'nextPage';
}

/**
 * 请求重新加载当前表面板页。
 */
export interface MySqlTableDataRefreshMessage {
	readonly type: 'refresh';
}

/**
 * 描述 MySQL 表数据 Webview 可接收的消息。
 */
export type MySqlTableDataWebviewMessage =
	| MySqlTableDataPreviousPageMessage
	| MySqlTableDataNextPageMessage
	| MySqlTableDataRefreshMessage;
