import * as assert from "assert";

import type { MssqlConnectionConfig } from "../../domain/connections/ConnectionConfig";
import { MssqlConnectionAdapter } from "../../infrastructure/mssql/MssqlConnectionAdapter";
import { MssqlTableDataProvider } from "../../infrastructure/mssql/MssqlTableDataProvider";
import { MssqlRuntimeLoader } from "../../infrastructure/mssql/MssqlRuntimeLoader";
import type {
  MssqlDriverOptions,
  MssqlRuntimeConnectionPool,
  MssqlRuntimeModule,
  MssqlRuntimeQueryResult,
  MssqlRuntimeRequest,
} from "../../infrastructure/mssql/MssqlRuntimeTypes";

/**
 * 记录 fake 运行时收到的连接选项、SQL 与参数。
 */
interface FakeRuntimeState {
  readonly queries: { sql: string; values: readonly unknown[] }[];
}

/**
 * 按 SQL 内容路由返回行的 fake 查询集合。
 */
interface FakeQueryPlan {
  readonly columnRows: ReadonlyArray<Record<string, unknown>>;
  readonly primaryKeyRows: ReadonlyArray<Record<string, unknown>>;
  readonly countRows: ReadonlyArray<Record<string, unknown>>;
  readonly pageRows: ReadonlyArray<Record<string, unknown>>;
}

/**
 * 构建注入 fake 运行时的 MSSQL 表数据提供者。
 *
 * @param {FakeQueryPlan} plan 按 SQL 内容路由的返回行集合。
 * @returns 表数据提供者及其运行时状态。
 */
function makeProvider(plan: FakeQueryPlan): {
  readonly provider: MssqlTableDataProvider;
  readonly state: FakeRuntimeState;
} {
  const state: FakeRuntimeState = { queries: [] };

  class FakeRequest implements MssqlRuntimeRequest {
    /**
     * 记录参数绑定（fake 不消费参数值）。
     *
     * @param {string} name 参数名。
     * @param {unknown} value 参数值。
     * @returns {MssqlRuntimeRequest} 当前请求。
     */
    public input(name: string, value: unknown): MssqlRuntimeRequest {
      void name;
      void value;
      return this;
    }

    /**
     * 按路由表返回查询结果。
     *
     * @param {string} sql 待执行的 SQL。
     * @returns {Promise<MssqlRuntimeQueryResult>} 路由到的结果集。
     */
    public async query(sql: string): Promise<MssqlRuntimeQueryResult> {
      state.queries.push({ sql, values: [] });
      let rows: ReadonlyArray<Record<string, unknown>> = [];
      if (sql.includes("sys.key_constraints")) {
        rows = plan.primaryKeyRows;
      } else if (sql.includes("sys.columns")) {
        rows = plan.columnRows;
      } else if (sql.includes("COUNT(*)")) {
        rows = plan.countRows;
      } else {
        rows = plan.pageRows;
      }
      return { recordset: rows };
    }
  }

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
     * 创建记录 SQL 的 fake 请求。
     *
     * @returns {MssqlRuntimeRequest} fake 请求对象。
     */
    public request(): MssqlRuntimeRequest {
      return new FakeRequest();
    }
  }

  const runtimeModule: MssqlRuntimeModule = {
    ConnectionPool: FakePool as unknown as MssqlRuntimeModule["ConnectionPool"],
  };

  const loader = new MssqlRuntimeLoader();
  loader.loadMssqlModule = async () => runtimeModule;

  return {
    provider: new MssqlTableDataProvider(new MssqlConnectionAdapter(), loader),
    state,
  };
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

const COLUMN_ROWS: ReadonlyArray<Record<string, unknown>> = [
  {
    columnName: "id",
    dataType: "int",
    maxLength: 4,
    precision: 10,
    scale: 0,
    isNullable: false,
    columnDefault: null,
    isIdentity: 1,
  },
  {
    columnName: "name",
    dataType: "nvarchar",
    maxLength: 100,
    precision: 0,
    scale: 0,
    isNullable: false,
    columnDefault: null,
    isIdentity: 0,
  },
  {
    columnName: "bio",
    dataType: "nvarchar",
    maxLength: -1,
    precision: 0,
    scale: 0,
    isNullable: true,
    columnDefault: null,
    isIdentity: 0,
  },
  {
    columnName: "created_at",
    dataType: "datetime2",
    maxLength: 8,
    precision: 27,
    scale: 3,
    isNullable: false,
    columnDefault: null,
    isIdentity: 0,
  },
];
const PRIMARY_KEY_ROWS: ReadonlyArray<Record<string, unknown>> = [{ columnName: "id" }];

suite("Infrastructure — MssqlTableDataProvider", () => {
  test("listColumns 归一化字段元数据并识别主键与 identity", async () => {
    const { provider } = makeProvider({
      columnRows: COLUMN_ROWS,
      primaryKeyRows: PRIMARY_KEY_ROWS,
      countRows: [],
      pageRows: [],
    });
    const columns = await provider.listColumns(makeConnection(), "PpzTest", "dbo", "users");

    assert.strictEqual(columns.length, 4);
    assert.strictEqual(columns[0].name, "id");
    assert.strictEqual(columns[0].isPrimaryKey, true);
    assert.strictEqual(columns[0].extra, "identity");
    assert.strictEqual(columns[1].dataType, "nvarchar(50)");
    assert.strictEqual(columns[2].dataType, "nvarchar(max)");
    assert.strictEqual(columns[2].nullable, true);
    assert.strictEqual(columns[3].dataType, "datetime2(3)");
    assert.strictEqual(columns[3].dateTimePrecision, 3);
  });

  test("listRowPage 归一化分页结果并使用 OFFSET/FETCH", async () => {
    const pageRows = Array.from({ length: 11 }, (_, index) => ({ id: index + 1 }));
    const { provider, state } = makeProvider({
      columnRows: COLUMN_ROWS,
      primaryKeyRows: PRIMARY_KEY_ROWS,
      countRows: [{ totalRowCount: 45 }],
      pageRows,
    });
    const page = await provider.listRowPage(makeConnection(), "PpzTest", "dbo", "users", 2, 10);

    assert.strictEqual(page.totalRowCount, 45);
    assert.strictEqual(page.rows.length, 10, "超出 pageSize 的行应被裁剪");
    assert.strictEqual(page.hasNextPage, true);
    assert.strictEqual(page.pageIndex, 2);
    const rowSql = state.queries.find((item) => item.sql.includes("OFFSET"));
    assert.ok(rowSql?.sql.includes("OFFSET @p1 ROWS FETCH NEXT @p2 ROWS ONLY"));
    assert.ok(rowSql?.sql.includes("ORDER BY [id]"), "默认应按主键排序");
  });

  test("无主键表退化为 ORDER BY (SELECT NULL)", async () => {
    const { provider, state } = makeProvider({
      columnRows: [
        {
          columnName: "value",
          dataType: "nvarchar",
          maxLength: 40,
          precision: 0,
          scale: 0,
          isNullable: true,
          columnDefault: null,
          isIdentity: 0,
        },
      ],
      primaryKeyRows: [],
      countRows: [{ totalRowCount: 3 }],
      pageRows: [{ value: "a" }],
    });
    const page = await provider.listRowPage(makeConnection(), "PpzTest", "dbo", "no_pk", 0, 10);

    assert.strictEqual(page.totalRowCount, 3);
    const rowSql = state.queries.find((item) => item.sql.includes("OFFSET"));
    assert.ok(rowSql?.sql.includes("ORDER BY (SELECT NULL)"));
  });

  test("关键字过滤生成 CAST + LIKE 并参数化", async () => {
    const { provider, state } = makeProvider({
      columnRows: COLUMN_ROWS,
      primaryKeyRows: PRIMARY_KEY_ROWS,
      countRows: [{ totalRowCount: 11 }],
      pageRows: [],
    });
    const page = await provider.listRowPage(makeConnection(), "PpzTest", "dbo", "users", 0, 10, {
      filter: { keyword: "user_1" },
    });

    assert.strictEqual(page.totalRowCount, 11);
    const countSql = state.queries.find((item) => item.sql.includes("COUNT(*)"));
    assert.ok(countSql?.sql.includes("CAST([name] AS NVARCHAR(MAX)) LIKE @p1"));
    assert.ok(countSql?.sql.includes("OR"));
    assert.ok(page.sqlWithoutPagination.includes("'%user_1%'"), "展示 SQL 应内联过滤字面量");
  });

  test("排序条件覆盖默认主键排序", async () => {
    const { provider, state } = makeProvider({
      columnRows: COLUMN_ROWS,
      primaryKeyRows: PRIMARY_KEY_ROWS,
      countRows: [{ totalRowCount: 45 }],
      pageRows: [],
    });
    await provider.listRowPage(makeConnection(), "PpzTest", "dbo", "users", 0, 10, {
      sort: { columnName: "name", direction: "desc" },
    });

    const rowSql = state.queries.find((item) => item.sql.includes("OFFSET"));
    assert.ok(rowSql?.sql.includes("ORDER BY [name] DESC"));
  });
});
