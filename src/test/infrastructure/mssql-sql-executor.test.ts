import * as assert from "assert";

import type { MssqlConnectionConfig } from "../../domain/connections/ConnectionConfig";
import { MssqlConnectionAdapter } from "../../infrastructure/mssql/MssqlConnectionAdapter";
import { MssqlSqlExecutor } from "../../infrastructure/mssql/MssqlSqlExecutor";
import { MssqlRuntimeLoader } from "../../infrastructure/mssql/MssqlRuntimeLoader";
import type {
  MssqlRuntimeModule,
  MssqlRuntimeQueryResult,
} from "../../infrastructure/mssql/MssqlRuntimeTypes";

/**
 * 构建 fake 查询结果。
 *
 * @param {Partial<MssqlRuntimeQueryResult>} result 原始结果字段。
 * @returns {MssqlRuntimeQueryResult} fake 查询结果。
 */
function makeResult(result: Partial<MssqlRuntimeQueryResult>): MssqlRuntimeQueryResult {
  return result;
}

/**
 * 构建注入 fake 运行时的 MSSQL SQL 执行器。
 *
 * @param {MssqlRuntimeQueryResult} result fake 查询返回值。
 * @param {Error | undefined} queryError 可选的查询错误。
 * @returns {MssqlSqlExecutor} SQL 执行器。
 */
function makeExecutor(result: MssqlRuntimeQueryResult, queryError?: Error): MssqlSqlExecutor {
  const runtimeModule: MssqlRuntimeModule = {
    ConnectionPool: class {
      /**
       * 模拟建立连接池。
       *
       * @returns {Promise<unknown>} 当前连接池。
       */
      public async connect(): Promise<unknown> {
        return this;
      }

      /**
       * 模拟关闭连接池。
       */
      public async close(): Promise<void> {
        return undefined;
      }

      /**
       * 创建返回固定结果的 fake 请求。
       *
       * @returns {unknown} fake 请求对象。
       */
      public request(): unknown {
        return {
          input(): unknown {
            return this;
          },
          async query(): Promise<MssqlRuntimeQueryResult> {
            if (queryError) {
              throw queryError;
            }
            return result;
          },
        };
      }
    } as unknown as MssqlRuntimeModule["ConnectionPool"],
  };

  const loader = new MssqlRuntimeLoader();
  loader.loadMssqlModule = async () => runtimeModule;

  return new MssqlSqlExecutor(new MssqlConnectionAdapter(), loader);
}

/**
 * 按本地时区把 Date 格式化为 `YYYY-MM-DD HH:MM:SS.mmm`，
 * 与共享 formatDateCellValue 的展示规则一致，避免测试依赖构建机时区。
 *
 * @param {Date} value 原始 Date 值。
 * @returns {string} 本地时间字符串。
 */
function formatLocalDateTime(value: Date): string {
  const pad = (part: number, width: number): string => part.toString().padStart(width, "0");
  return [
    pad(value.getFullYear(), 4),
    "-",
    pad(value.getMonth() + 1, 2),
    "-",
    pad(value.getDate(), 2),
    " ",
    pad(value.getHours(), 2),
    ":",
    pad(value.getMinutes(), 2),
    ":",
    pad(value.getSeconds(), 2),
    ".",
    pad(value.getMilliseconds(), 3),
  ].join("");
}

/**
 * 构建参数模式的 MSSQL 测试连接。
 *
 * @returns {MssqlConnectionConfig} 测试连接配置。
 */
function makeConnection(): MssqlConnectionConfig {
  return {
    engine: "mssql",
    mode: "parameters",
    id: "mssql-1",
    name: "local",
    host: "127.0.0.1",
    port: 1433,
    username: "sa",
    database: "PpzTest",
    encrypt: false,
    trustServerCertificate: true,
  };
}

suite("Infrastructure — MssqlSqlExecutor", () => {
  test("查询语句归一化首个结果集", async () => {
    const executor = makeExecutor(
      makeResult({
        recordset: [{ id: 1, name: "alice", created_at: new Date("2026-01-02T03:04:05.678Z") }],
        recordsets: [[{ id: 1, name: "alice", created_at: new Date("2026-01-02T03:04:05.678Z") }]],
        rowsAffected: [1],
      }),
    );
    const result = await executor.executeSql(makeConnection(), undefined, "SELECT 1");

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.isQuery, true);
    assert.deepStrictEqual(
      result.fields.map((field) => field.name),
      ["id", "name", "created_at"],
    );
    assert.strictEqual(result.rows[0].id, 1);
    assert.strictEqual(
      result.rows[0].created_at,
      formatLocalDateTime(new Date("2026-01-02T03:04:05.678Z")),
      "日期应按本地时间格式化为 YYYY-MM-DD HH:MM:SS.mmm",
    );
    assert.strictEqual(result.affectedRows, null);
  });

  test("非查询语句返回受影响行数", async () => {
    const executor = makeExecutor(makeResult({ rowsAffected: [2] }));
    const result = await executor.executeSql(makeConnection(), undefined, "UPDATE 1");

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.isQuery, false);
    assert.strictEqual(result.affectedRows, 2);
    assert.strictEqual(result.resultSets[0].metadata[0].key, "受影响行数");
  });

  test("多结果集逐个归一化", async () => {
    const executor = makeExecutor(
      makeResult({
        recordsets: [[{ a: 1 }], [{ b: 2 }]],
        rowsAffected: [1, 1],
      }),
    );
    const result = await executor.executeSql(makeConnection(), undefined, "SELECT 1; SELECT 2");

    assert.strictEqual(result.resultSets.length, 2);
    assert.strictEqual(result.rows[0].a, 1, "顶层取首个结果集");
    assert.strictEqual(result.resultSets[1].rows[0].b, 2);
  });

  test("执行错误返回失败结果与错误信息", async () => {
    const executor = makeExecutor(makeResult({}), new Error("Invalid object name"));
    const result = await executor.executeSql(makeConnection(), undefined, "SELECT * FROM 缺失表");

    assert.strictEqual(result.success, false);
    assert.strictEqual(result.errorMessage, "Invalid object name");
    assert.strictEqual(result.rows.length, 0);
  });
});
