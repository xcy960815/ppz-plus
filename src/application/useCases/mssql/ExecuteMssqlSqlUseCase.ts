import type { MssqlConnectionConfig } from "../../../domain/connections/ConnectionConfig";
import type { SqlExecutionResult } from "../../../domain/query/SqlExecutionResult";
import type { MssqlSqlExecutor } from "../../mssql/MssqlSqlExecutor";

/**
 * 执行 MSSQL SQL 文本的应用用例。
 */
export class ExecuteMssqlSqlUseCase {
  /**
   * 创建 MSSQL SQL 执行用例。
   *
   * @param mssqlSqlExecutor 用于实际执行 SQL 的 MSSQL 能力提供者。
   */
  public constructor(private readonly mssqlSqlExecutor: MssqlSqlExecutor) {}

  /**
   * 执行用户提交的 MSSQL SQL。
   *
   * @param {MssqlConnectionConfig} connection MSSQL 连接配置。
   * @param {string | undefined} databaseName 本次执行要连接的 database。
   * @param {string} sql 用户输入的 SQL 文本。
   * @returns {Promise<SqlExecutionResult>} 统一 SQL 执行结果。
   */
  public async execute(
    connection: MssqlConnectionConfig,
    databaseName: string | undefined,
    sql: string,
  ): Promise<SqlExecutionResult> {
    const normalizedSql = sql.trim();
    const normalizedDatabaseName =
      databaseName && databaseName.trim().length > 0 ? databaseName.trim() : undefined;

    if (normalizedSql.length === 0) {
      return {
        sql,
        success: false,
        isQuery: false,
        fields: [],
        rows: [],
        affectedRows: null,
        durationMs: 0,
        resultSets: [],
        errorMessage: "SQL 不能为空。",
      };
    }

    return this.mssqlSqlExecutor.executeSql(connection, normalizedDatabaseName, normalizedSql);
  }
}
