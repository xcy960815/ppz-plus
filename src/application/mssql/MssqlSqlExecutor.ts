import type { MssqlConnectionConfig } from "../../domain/connections/ConnectionConfig";
import type { SqlExecutionResult } from "../../domain/query/SqlExecutionResult";

/**
 * 向应用层提供 MSSQL SQL 执行能力。
 */
export interface MssqlSqlExecutor {
  /**
   * 执行一段 MSSQL SQL 并返回归一化结果。
   *
   * @param {MssqlConnectionConfig} connection MSSQL 连接配置。
   * @param {string | undefined} databaseName 本次执行要连接的 database。
   * @param {string} sql 用户输入的 SQL 文本。
   * @returns {Promise<SqlExecutionResult>} 统一 SQL 执行结果。
   */
  executeSql(
    connection: MssqlConnectionConfig,
    databaseName: string | undefined,
    sql: string,
  ): Promise<SqlExecutionResult>;
}
