/**
 * 描述 MSSQL SQL 终端执行消息。
 */
export interface MssqlSqlTerminalExecuteMessage {
  readonly type: "execute";
  readonly connectionId: string;
  readonly databaseName?: string;
  readonly sql: string;
}

/**
 * 描述 MSSQL SQL 终端 Webview 可接收的消息。
 */
export type MssqlSqlTerminalWebviewMessage = MssqlSqlTerminalExecuteMessage;
