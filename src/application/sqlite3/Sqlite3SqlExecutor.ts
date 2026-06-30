import type { Sqlite3ConnectionConfig } from "../../domain/connections/ConnectionConfig";
import type { SqlExecutionResult } from "../../domain/query/SqlExecutionResult";

/**
 * 向应用层提供 SQLite3 SQL 执行能力。
 */
export interface Sqlite3SqlExecutor {
  /**
   * 执行一段 SQLite3 SQL 并返回归一化结果。
   *
   * @param {Sqlite3ConnectionConfig} connection SQLite3 连接配置。
   * @param {string} sql 用户输入的 SQL 文本。
   * @returns {Promise<SqlExecutionResult>} 统一 SQL 执行结果。
   */
  executeSql(connection: Sqlite3ConnectionConfig, sql: string): Promise<SqlExecutionResult>;
}
