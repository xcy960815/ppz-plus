import type { MssqlConnectionConfig } from "../../domain/connections/ConnectionConfig";
import type {
  SqlExecutionCellValue,
  SqlExecutionField,
  SqlExecutionResult,
  SqlExecutionResultSet,
} from "../../domain/query/SqlExecutionResult";
import type { MssqlSqlExecutor as MssqlSqlExecutorContract } from "../../application/mssql/MssqlSqlExecutor";
import { MssqlConnectionAdapter } from "./MssqlConnectionAdapter";
import { MssqlRuntimeLoader } from "./MssqlRuntimeLoader";
import type { MssqlDriverOptions, MssqlRuntimeConnectionPool } from "./MssqlRuntimeTypes";
import { formatDateCellValue } from "../shared/formatDateCellValue";
import { stringifyObjectValue } from "../shared/stringifyObjectValue";

/**
 * 通过 mssql 驱动执行 MSSQL SQL。
 */
export class MssqlSqlExecutor implements MssqlSqlExecutorContract {
  /**
   * 创建基于 mssql 的 SQL 执行器。
   *
   * @param mssqlConnectionAdapter 用于归一化连接选项的适配器。
   * @param mssqlRuntimeLoader 用于延迟解析 mssql 运行时的加载器。
   */
  public constructor(
    private readonly mssqlConnectionAdapter: MssqlConnectionAdapter,
    private readonly mssqlRuntimeLoader: MssqlRuntimeLoader,
  ) {}

  /**
   * 执行 MSSQL SQL 并返回统一结果模型。
   *
   * 多语句时按语句拆分为多个结果集；首个查询结果集同时作为
   * 顶层 rows / fields 展示，后续结果集进入 resultSets。
   *
   * @param {MssqlConnectionConfig} connection MSSQL 连接配置。
   * @param {string | undefined} databaseName 本次执行要连接的 database。
   * @param {string} sql 用户输入的 SQL 文本。
   * @returns {Promise<SqlExecutionResult>} 统一 SQL 执行结果。
   */
  public async executeSql(
    connection: MssqlConnectionConfig,
    databaseName: string | undefined,
    sql: string,
  ): Promise<SqlExecutionResult> {
    const startedAt = Date.now();
    let pool: MssqlRuntimeConnectionPool | undefined;

    try {
      pool = await this.openPool(connection, databaseName);
      const result = await pool.request().query(sql);
      const durationMs = Date.now() - startedAt;
      const resultSets = this.normalizeResultSets(result);
      const primaryResultSet = resultSets[0] ?? this.createEmptyStatementResultSet();

      return {
        sql,
        success: true,
        isQuery: primaryResultSet.isQuery,
        fields: primaryResultSet.fields,
        rows: primaryResultSet.rows,
        affectedRows: primaryResultSet.affectedRows,
        durationMs,
        resultSets,
      };
    } catch (error) {
      return {
        sql,
        success: false,
        isQuery: false,
        fields: [],
        rows: [],
        affectedRows: null,
        durationMs: Date.now() - startedAt,
        resultSets: [],
        errorMessage: error instanceof Error ? error.message : String(error),
      };
    } finally {
      if (pool) {
        await this.closePool(pool);
      }
    }
  }

  /**
   * 将 mssql 返回值归一化为一个或多个 SQL 结果集。
   *
   * recordsets 为空时按非查询语句处理，受影响行数取各语句之和；
   * 存在查询结果集时逐个归一化展示。
   *
   * @param {import("./MssqlRuntimeTypes").MssqlRuntimeQueryResult} rawResult 驱动返回的原始结果。
   * @returns {readonly SqlExecutionResultSet[]} 归一化后的结果集列表。
   */
  private normalizeResultSets(rawResult: {
    readonly recordset?: ReadonlyArray<Record<string, unknown>>;
    readonly recordsets?: ReadonlyArray<ReadonlyArray<Record<string, unknown>>>;
    readonly rowsAffected?: readonly number[];
  }): readonly SqlExecutionResultSet[] {
    const recordsets = rawResult.recordsets ?? [];
    const rowsAffected = rawResult.rowsAffected ?? [];
    const affectedTotal = rowsAffected.reduce((sum, value) => sum + value, 0);

    if (recordsets.length === 0) {
      return [
        {
          isQuery: false,
          fields: [],
          rows: [],
          affectedRows: affectedTotal,
          metadata: [{ key: "受影响行数", value: affectedTotal }],
        },
      ];
    }

    return recordsets.map((recordset) => this.createQueryResultSet(recordset));
  }

  /**
   * 将单个查询结果集归一化。
   *
   * @param {ReadonlyArray<Record<string, unknown>>} recordset 驱动返回的行集合。
   * @returns {SqlExecutionResultSet} 归一化后的查询结果集。
   */
  private createQueryResultSet(
    recordset: ReadonlyArray<Record<string, unknown>>,
  ): SqlExecutionResultSet {
    const fields = this.readResultFields(recordset);
    return {
      isQuery: true,
      fields,
      rows: recordset.map((row) => this.normalizeRow(row)),
      affectedRows: null,
      metadata: [],
    };
  }

  /**
   * 从结果集行中读取字段列表。
   *
   * @param {ReadonlyArray<Record<string, unknown>>} recordset 驱动返回的行集合。
   * @returns {readonly SqlExecutionField[]} 字段列表。
   */
  private readResultFields(
    recordset: ReadonlyArray<Record<string, unknown>>,
  ): readonly SqlExecutionField[] {
    const names = new Set<string>();
    for (const row of recordset) {
      for (const key of Object.keys(row)) {
        names.add(key);
      }
    }
    return Array.from(names).map((name) => ({ name }));
  }

  /**
   * 将单条行归一化为可序列化的单元格值。
   *
   * @param {Record<string, unknown>} row 驱动返回的原始行。
   * @returns {Record<string, SqlExecutionCellValue>} 归一化后的行对象。
   */
  private normalizeRow(row: Record<string, unknown>): Record<string, SqlExecutionCellValue> {
    return Object.fromEntries(
      Object.entries(row).map(([key, value]) => [key, this.normalizeCellValue(value)]),
    );
  }

  /**
   * 将单个单元格值归一化为可安全 JSON 渲染的值。
   *
   * @param {unknown} value 原始单元格值。
   * @returns {SqlExecutionCellValue} 归一化后的单元格值。
   */
  private normalizeCellValue(value: unknown): SqlExecutionCellValue {
    if (
      value === null ||
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      return value;
    }
    if (typeof value === "bigint") {
      return value.toString();
    }
    if (value instanceof Date) {
      return formatDateCellValue(value);
    }
    if (Buffer.isBuffer(value)) {
      return `0x${value.toString("hex")}`;
    }
    if (value && typeof value === "object") {
      return stringifyObjectValue(value);
    }
    return String(value);
  }

  /**
   * 创建空语句结果集。
   *
   * @returns {SqlExecutionResultSet} 空的查询结果集。
   */
  private createEmptyStatementResultSet(): SqlExecutionResultSet {
    return {
      isQuery: true,
      fields: [],
      rows: [],
      affectedRows: null,
      metadata: [],
    };
  }

  /**
   * 打开指向目标 database 的连接池。
   *
   * @param {MssqlConnectionConfig} connection MSSQL 连接配置。
   * @param {string | undefined} databaseName 本次执行要连接的 database。
   * @returns {Promise<MssqlRuntimeConnectionPool>} 已连接的连接池。
   */
  private async openPool(
    connection: MssqlConnectionConfig,
    databaseName: string | undefined,
  ): Promise<MssqlRuntimeConnectionPool> {
    const baseOptions = this.mssqlConnectionAdapter.resolveDriverOptions(connection);
    const options: MssqlDriverOptions =
      databaseName && databaseName.length > 0
        ? { ...baseOptions, database: databaseName }
        : baseOptions;
    const mssql = await this.mssqlRuntimeLoader.loadMssqlModule();
    const pool = new mssql.ConnectionPool(options);
    await pool.connect();
    return pool;
  }

  /**
   * 关闭连接池，关闭失败不覆盖主要执行结果。
   *
   * @param {MssqlRuntimeConnectionPool} pool 需要关闭的连接池。
   */
  private async closePool(pool: MssqlRuntimeConnectionPool): Promise<void> {
    try {
      await pool.close();
    } catch {
      /**
       * SQL 执行结果优先，关闭失败不覆盖主要结果。
       */
    }
  }
}
