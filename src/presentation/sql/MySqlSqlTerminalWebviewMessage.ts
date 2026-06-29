/**
 * 请求执行 MySQL SQL。
 */
export interface MySqlSqlTerminalExecuteMessage {
	readonly type: 'execute';
	readonly connectionId: string;
	readonly sql: string;
}

/**
 * 描述 MySQL SQL 终端 Webview 可接收的消息。
 */
export type MySqlSqlTerminalWebviewMessage =
	MySqlSqlTerminalExecuteMessage;
