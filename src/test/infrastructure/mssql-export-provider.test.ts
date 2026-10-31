import * as assert from "assert";

import type { MssqlConnectionConfig } from "../../domain/connections/ConnectionConfig";
import { MssqlConnectionAdapter } from "../../infrastructure/mssql/MssqlConnectionAdapter";
import { MssqlExportProvider } from "../../infrastructure/mssql/MssqlExportProvider";
import { MssqlRuntimeLoader } from "../../infrastructure/mssql/MssqlRuntimeLoader";
import type {
  MssqlRuntimeConnectionPool,
  MssqlRuntimeModule,
  MssqlRuntimeQueryResult,
  MssqlRuntimeRequest,
} from "../../infrastructure/mssql/MssqlRuntimeTypes";

/**
 * 描述 fake 连接池可路由返回的行集合。
 */
interface FakeQueryPlan {
  readonly columnRows?: ReadonlyArray<Record<string, unknown>>;
  readonly primaryKeyRows?: ReadonlyArray<Record<string, unknown>>;
  readonly indexRows?: ReadonlyArray<Record<string, unknown>>;
  readonly foreignKeyRows?: ReadonlyArray<Record<string, unknown>>;
  readonly tableRows?: ReadonlyArray<Record<string, unknown>>;
  readonly dataRows?: ReadonlyArray<Record<string, unknown>>;
}

/**
 * 构建 fake 连接池与查询记录。
 *
 * @param {FakeQueryPlan} plan 按 SQL 内容路由的返回行集合。
 * @returns {{ pools: MssqlRuntimeConnectionPool[]; queries: string[] }} 连接池工厂与查询记录。
 */
function makePoolFactory(plan: FakeQueryPlan): {
  pools: MssqlRuntimeConnectionPool[];
  queries: string[];
} {
  const queries: string[] = [];

  function route(sql: string): ReadonlyArray<Record<string, unknown>> {
    if (sql.includes("COUNT(*)")) {
      return [{ identityCount: 1 }];
    }
    if (sql.includes("sys.key_constraints")) {
      return plan.primaryKeyRows ?? [];
    }
    if (sql.includes("sys.indexes")) {
      return plan.indexRows ?? [];
    }
    if (sql.includes("sys.foreign_keys")) {
      return plan.foreignKeyRows ?? [];
    }
    if (sql.includes("sys.columns")) {
      return plan.columnRows ?? [];
    }
    if (sql.includes("sys.tables")) {
      return plan.tableRows ?? [];
    }
    return plan.dataRows ?? [];
  }

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
      queries.push(sql);
      return { recordset: route(sql) };
    }
  }

  class FakePool implements MssqlRuntimeConnectionPool {
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
     * 创建 fake 请求。
     *
     * @returns {MssqlRuntimeRequest} fake 请求对象。
     */
    public request(): MssqlRuntimeRequest {
      return new FakeRequest();
    }
  }

  return { pools: [new FakePool()], queries };
}

/**
 * 构建注入 fake 运行时的导出提供者。
 *
 * @param {FakeQueryPlan} plan 查询路由计划。
 * @returns {{ provider: MssqlExportProvider; queries: string[] }} 导出提供者与查询记录。
 */
function makeProvider(plan: FakeQueryPlan): { provider: MssqlExportProvider; queries: string[] } {
  const { pools, queries } = makePoolFactory(plan);
  const runtimeModule: MssqlRuntimeModule = {
    ConnectionPool: class {
      /**
       * 模拟建立连接池。
       *
       * @returns {Promise<MssqlRuntimeConnectionPool>} 共享的 fake 连接池。
       */
      public async connect(): Promise<MssqlRuntimeConnectionPool> {
        return pools[0];
      }

      /**
       * 模拟关闭连接池。
       */
      public async close(): Promise<void> {
        return undefined;
      }

      /**
       * 创建 fake 请求。
       *
       * @returns {MssqlRuntimeRequest} fake 请求对象。
       */
      public request(): MssqlRuntimeRequest {
        return pools[0].request();
      }
    } as unknown as MssqlRuntimeModule["ConnectionPool"],
  };

  const loader = new MssqlRuntimeLoader();
  loader.loadMssqlModule = async () => runtimeModule;

  return { provider: new MssqlExportProvider(new MssqlConnectionAdapter(), loader), queries };
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

const COLUMN_ROWS = [
  {
    columnName: "id",
    dataType: "int",
    maxLength: 4,
    precision: 10,
    scale: 0,
    isNullable: false,
    defaultExpression: null,
    seedValue: 1,
    incrementValue: 1,
    computedDefinition: null,
    isIdentity: 1,
  },
  {
    columnName: "name",
    dataType: "nvarchar",
    maxLength: 100,
    precision: 0,
    scale: 0,
    isNullable: false,
    defaultExpression: null,
    seedValue: null,
    incrementValue: null,
    computedDefinition: null,
    isIdentity: 0,
  },
];
const PRIMARY_KEY_ROWS = [{ constraintName: "PK_users", columnName: "id", isDescendingKey: false }];
const DATA_ROWS = [
  { id: 1, name: "alice" },
  { id: 2, name: "你好" },
];

suite("Infrastructure — MssqlExportProvider", () => {
  test("表级 both 导出生成建表、identity 包裹与中文 INSERT", async () => {
    const { provider } = makeProvider({
      columnRows: COLUMN_ROWS,
      primaryKeyRows: PRIMARY_KEY_ROWS,
      dataRows: DATA_ROWS,
    });
    const document = await provider.exportTable(
      makeConnection(),
      { databaseName: "PpzTest", schemaName: "dbo", tableName: "users" },
      "both",
    );

    assert.ok(document.content.includes("CREATE SCHEMA"), "应含条件创建 schema");
    assert.ok(document.content.includes("CREATE TABLE [dbo].[users]"), "应含建表语句");
    assert.ok(document.content.includes("IDENTITY(1, 1) NOT NULL"), "identity 定义应含种子与增量");
    assert.ok(
      document.content.includes("CONSTRAINT [PK_users] PRIMARY KEY CLUSTERED ([id] ASC)"),
      "应含主键约束",
    );
    assert.ok(
      document.content.includes("SET IDENTITY_INSERT [dbo].[users] ON;"),
      "identity 表应包裹",
    );
    assert.ok(document.content.includes("VALUES (1, N'alice');"), "应含参数化 INSERT");
    assert.ok(document.content.includes("VALUES (2, N'你好');"), "中文应原样导出");
    assert.strictEqual(document.title, "PpzTest.dbo.users.sql");
  });

  test("schema 级导出不内联外键并聚合收尾", async () => {
    const { provider } = makeProvider({
      columnRows: COLUMN_ROWS,
      primaryKeyRows: PRIMARY_KEY_ROWS,
      foreignKeyRows: [
        {
          fkName: "FK_orders_users",
          columnName: "user_id",
          refSchemaName: "dbo",
          refTableName: "users",
          refColumnName: "id",
          columnOrdinal: 1,
        },
      ],
      tableRows: [{ name: "users" }],
      dataRows: DATA_ROWS,
    });
    const document = await provider.exportSchema(
      makeConnection(),
      { databaseName: "PpzTest", schemaName: "dbo" },
      "both",
    );

    assert.ok(document.content.includes("CREATE TABLE [dbo].[users]"), "应含建表");
    assert.ok(
      document.content.indexOf("REFERENCES [dbo].[users]") >
        document.content.indexOf("CREATE TABLE [dbo].[users]"),
      "外键应位于建表之后统一添加",
    );
    assert.ok(document.content.includes("ADD CONSTRAINT [FK_orders_users]"), "应含外键语句");
  });

  test("纯 DML 导出不生成建表语句", async () => {
    const { provider } = makeProvider({
      columnRows: COLUMN_ROWS,
      primaryKeyRows: PRIMARY_KEY_ROWS,
      dataRows: DATA_ROWS,
    });
    const document = await provider.exportTable(
      makeConnection(),
      { databaseName: "PpzTest", schemaName: "dbo", tableName: "users" },
      "dml",
    );

    assert.ok(!document.content.includes("CREATE TABLE"), "纯 DML 不应包含建表");
    assert.ok(document.content.includes("INSERT INTO [dbo].[users]"));
  });

  test("空表导出注释占位", async () => {
    const { provider } = makeProvider({
      columnRows: COLUMN_ROWS,
      primaryKeyRows: PRIMARY_KEY_ROWS,
      dataRows: [],
    });
    const document = await provider.exportTable(
      makeConnection(),
      { databaseName: "PpzTest", schemaName: "dbo", tableName: "users" },
      "dml",
    );

    assert.ok(document.content.includes("中未找到数据"), "空表应有注释占位");
  });
});
