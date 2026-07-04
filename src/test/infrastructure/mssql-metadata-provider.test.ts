import * as assert from "assert";

import type { MssqlConnectionConfig } from "../../domain/connections/ConnectionConfig";
import { MssqlConnectionAdapter } from "../../infrastructure/mssql/MssqlConnectionAdapter";
import { MssqlMetadataProvider } from "../../infrastructure/mssql/MssqlMetadataProvider";
import { MssqlRuntimeLoader } from "../../infrastructure/mssql/MssqlRuntimeLoader";
import type {
  MssqlDriverOptions,
  MssqlRuntimeConnectionPool,
  MssqlRuntimeModule,
  MssqlRuntimeQueryResult,
  MssqlRuntimeRequest,
} from "../../infrastructure/mssql/MssqlRuntimeTypes";

/**
 * 记录 fake 运行时收到的连接选项与执行的查询。
 */
interface FakeRuntimeState {
  readonly optionsByQuery: { options: MssqlDriverOptions; sql: string }[];
  rows: ReadonlyArray<Record<string, unknown>>;
}

/**
 * 构建注入 fake 运行时的 MSSQL 元数据提供者。
 *
 * @param {ReadonlyArray<Record<string, unknown>>} rows 每次查询返回的行集合。
 * @returns 元数据提供者及其运行时状态。
 */
function makeProvider(rows: ReadonlyArray<Record<string, unknown>>): {
  readonly provider: MssqlMetadataProvider;
  readonly state: FakeRuntimeState;
} {
  const state: FakeRuntimeState = { optionsByQuery: [], rows };

  class FakePool implements MssqlRuntimeConnectionPool {
    /**
     * 保存构造连接池时使用的驱动选项。
     */
    public constructor(private readonly options: MssqlDriverOptions) {}

    /**
     * 模拟建立连接池。
     *
     * @returns {Promise<MssqlRuntimeConnectionPool>} 当前连接池。
     */
    public async connect(): Promise<MssqlRuntimeConnectionPool> {
      return this;
    }

    /**
     * 模拟关闭连接池。
     */
    public async close(): Promise<void> {
      return undefined;
    }

    /**
     * 创建记录查询的 fake 请求。
     *
     * @returns {MssqlRuntimeRequest} fake 请求对象。
     */
    public request(): MssqlRuntimeRequest {
      const options = this.options;
      return {
        async query(sql: string): Promise<MssqlRuntimeQueryResult> {
          state.optionsByQuery.push({ options, sql });
          return { recordset: state.rows };
        },
      };
    }
  }

  const runtimeModule: MssqlRuntimeModule = {
    ConnectionPool: FakePool as unknown as MssqlRuntimeModule["ConnectionPool"],
  };

  class FakeLoader extends MssqlRuntimeLoader {
    /**
     * 返回 fake MSSQL 运行时模块。
     *
     * @returns {Promise<MssqlRuntimeModule>} fake 运行时模块。
     */
    public override async loadMssqlModule(): Promise<MssqlRuntimeModule> {
      return runtimeModule;
    }
  }

  const provider = new MssqlMetadataProvider(new MssqlConnectionAdapter(), new FakeLoader());
  return { provider, state };
}

/**
 * 构建基础 MSSQL 参数连接配置。
 *
 * @returns {MssqlConnectionConfig} MSSQL 参数连接配置。
 */
function makeConfig(): MssqlConnectionConfig {
  return {
    id: "mssql",
    name: "MSSQL",
    engine: "mssql",
    mode: "parameters",
    host: "127.0.0.1",
    port: 1433,
    username: "sa",
    password: "secret",
    database: "master",
    encrypt: true,
    trustServerCertificate: false,
  };
}

suite("Infrastructure — MSSQL 元数据提供者", () => {
  test("listDatabases 过滤系统库并返回 name 列表", async () => {
    const { provider, state } = makeProvider([{ name: "AppDb" }, { name: "ReportDb" }]);

    const databases = await provider.listDatabases(makeConfig());

    assert.deepStrictEqual(databases, [{ name: "AppDb" }, { name: "ReportDb" }]);
    assert.ok(state.optionsByQuery[0]?.sql.includes("sys.databases"));
    assert.ok(state.optionsByQuery[0]?.sql.includes("database_id > 4"));
  });

  test("listSchemas 连接目标 database 而非拼接库名", async () => {
    const { provider, state } = makeProvider([{ name: "dbo" }]);

    const schemas = await provider.listSchemas(makeConfig(), "AppDb");

    assert.deepStrictEqual(schemas, [{ databaseName: "AppDb", name: "dbo" }]);
    // 关键：跨库浏览通过重设连接 database 建立，不在 SQL 里拼接库名。
    assert.strictEqual(state.optionsByQuery[0]?.options.database, "AppDb");
    assert.ok(!state.optionsByQuery[0]?.sql.includes("AppDb"));
  });

  test("listTables 使用参数化 schema 字面量并连接目标 database", async () => {
    const { provider, state } = makeProvider([{ name: "orders" }]);

    const tables = await provider.listTables(makeConfig(), "AppDb", "sales");

    assert.deepStrictEqual(tables, [
      { databaseName: "AppDb", schemaName: "sales", name: "orders" },
    ]);
    assert.strictEqual(state.optionsByQuery[0]?.options.database, "AppDb");
    assert.ok(state.optionsByQuery[0]?.sql.includes("'sales'"));
  });

  test("单引号 schema 名被转义避免破坏查询", async () => {
    const { provider, state } = makeProvider([]);

    await provider.listTables(makeConfig(), "AppDb", "o'brien");

    assert.ok(state.optionsByQuery[0]?.sql.includes("'o''brien'"));
  });

  test("忽略非字符串或空 name 行", async () => {
    const { provider } = makeProvider([{ name: "AppDb" }, { name: "" }, { name: 123 }, {}]);

    const databases = await provider.listDatabases(makeConfig());

    assert.deepStrictEqual(databases, [{ name: "AppDb" }]);
  });
});
