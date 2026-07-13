import * as assert from "assert";

import type { Sqlite3ConnectionConfig } from "../../domain/connections/ConnectionConfig";
import type {
  Sqlite3TableDataProvider,
  Sqlite3TableColumnMetadata,
  Sqlite3TableRowPage,
  Sqlite3TableInsertResult,
  Sqlite3TableUpdateResult,
  Sqlite3TableDeleteResult,
} from "../../application/sqlite3/Sqlite3TableDataProvider";
import type {
  Sqlite3MetadataProvider,
  Sqlite3TableMetadata,
} from "../../application/sqlite3/Sqlite3MetadataProvider";
import type { Sqlite3SqlExecutor } from "../../application/sqlite3/Sqlite3SqlExecutor";
import type { Sqlite3ExportProvider } from "../../application/sqlite3/Sqlite3ExportProvider";
import type { SqlExecutionResult } from "../../domain/query/SqlExecutionResult";
import type {
  SqlExportDocument,
  SqlExportTableTarget,
} from "../../domain/export/SqlExportDocument";
import { ListSqlite3TablesUseCase } from "../../application/useCases/ListSqlite3TablesUseCase";
import { ListSqlite3TableColumnsUseCase } from "../../application/useCases/ListSqlite3TableColumnsUseCase";
import { ListSqlite3TableRowPageUseCase } from "../../application/useCases/ListSqlite3TableRowPageUseCase";
import { ExecuteSqlite3SqlUseCase } from "../../application/useCases/ExecuteSqlite3SqlUseCase";
import { ExportSqlite3TableUseCase } from "../../application/useCases/ExportSqlite3TableUseCase";
import { InsertSqlite3TableRowUseCase } from "../../application/useCases/InsertSqlite3TableRowUseCase";
import { UpdateSqlite3TableRowUseCase } from "../../application/useCases/UpdateSqlite3TableRowUseCase";
import { DeleteSqlite3TableRowUseCase } from "../../application/useCases/DeleteSqlite3TableRowUseCase";

// ---------------------------------------------------------------------------
// Fixture
// ---------------------------------------------------------------------------

function makeSqlite3Config(
  overrides: Partial<Sqlite3ConnectionConfig> = {},
): Sqlite3ConnectionConfig {
  return {
    id: "sqlite-conn-1",
    name: "测试 SQLite3",
    engine: "sqlite3",
    filePath: "/tmp/test.db",
    ...overrides,
  } as Sqlite3ConnectionConfig;
}

// ---------------------------------------------------------------------------
// ListSqlite3TablesUseCase
// ---------------------------------------------------------------------------

suite("Application — ListSqlite3TablesUseCase", () => {
  test("返回 mock 提供的表列表", async () => {
    const mockTables: Sqlite3TableMetadata[] = [
      { name: "users", type: "table" },
      { name: "orders", type: "table" },
      { name: "user_stats", type: "view" },
    ];

    const provider: Sqlite3MetadataProvider = {
      async listTables() {
        return mockTables;
      },
    };

    const useCase = new ListSqlite3TablesUseCase(provider);
    const result = await useCase.execute(makeSqlite3Config());

    assert.strictEqual(result.length, 3);
    assert.strictEqual(result[0].name, "users");
    assert.strictEqual(result[0].type, "table");
    assert.strictEqual(result[2].name, "user_stats");
    assert.strictEqual(result[2].type, "view");
  });

  test("空数据库返回空数组", async () => {
    const provider: Sqlite3MetadataProvider = {
      async listTables() {
        return [];
      },
    };

    const useCase = new ListSqlite3TablesUseCase(provider);
    const result = await useCase.execute(makeSqlite3Config());

    assert.strictEqual(result.length, 0);
  });
});

// ---------------------------------------------------------------------------
// ListSqlite3TableColumnsUseCase
// ---------------------------------------------------------------------------

suite("Application — ListSqlite3TableColumnsUseCase", () => {
  test("返回 mock 提供的表字段列表", async () => {
    const mockColumns: Sqlite3TableColumnMetadata[] = [
      {
        name: "id",
        dataType: "INTEGER",
        dateTimePrecision: null,
        nullable: false,
        isPrimaryKey: true,
        extra: "",
      },
      {
        name: "name",
        dataType: "TEXT",
        dateTimePrecision: null,
        nullable: true,
        isPrimaryKey: false,
        extra: "",
      },
    ];

    const provider: Sqlite3TableDataProvider = {
      async listColumns() {
        return mockColumns;
      },
      async listRowPage() {
        throw new Error("not called");
      },
      async insertRow() {
        throw new Error("not called");
      },
      async updateRow() {
        throw new Error("not called");
      },
      async deleteRow() {
        throw new Error("not called");
      },
    };

    const useCase = new ListSqlite3TableColumnsUseCase(provider);
    const result = await useCase.execute(makeSqlite3Config(), "users");

    assert.strictEqual(result.length, 2);
    assert.strictEqual(result[0].name, "id");
    assert.strictEqual(result[0].isPrimaryKey, true);
    assert.strictEqual(result[1].name, "name");
    assert.strictEqual(result[1].nullable, true);
  });
});

// ---------------------------------------------------------------------------
// ListSqlite3TableRowPageUseCase
// ---------------------------------------------------------------------------

suite("Application — ListSqlite3TableRowPageUseCase", () => {
  test("返回 mock 提供的分页行数据", async () => {
    const mockPage: Sqlite3TableRowPage = {
      pageIndex: 1,
      pageSize: 20,
      totalRowCount: 100,
      hasNextPage: true,
      sql: "SELECT * FROM users LIMIT 20 OFFSET 20",
      sqlWithoutPagination: "SELECT * FROM users",
      rows: [
        { id: 1, name: "Alice" },
        { id: 2, name: "Bob" },
      ],
    };

    const provider: Sqlite3TableDataProvider = {
      async listColumns() {
        throw new Error("not called");
      },
      async listRowPage() {
        return mockPage;
      },
      async insertRow() {
        throw new Error("not called");
      },
      async updateRow() {
        throw new Error("not called");
      },
      async deleteRow() {
        throw new Error("not called");
      },
    };

    const useCase = new ListSqlite3TableRowPageUseCase(provider);
    const result = await useCase.execute(makeSqlite3Config(), "users", 1, 20);

    assert.strictEqual(result.totalRowCount, 100);
    assert.strictEqual(result.pageIndex, 1);
    assert.strictEqual(result.pageSize, 20);
    assert.strictEqual(result.rows.length, 2);
    assert.strictEqual(result.rows[0].name, "Alice");
  });

  test("排序和过滤选项透传", async () => {
    let capturedOptions: unknown;

    const provider: Sqlite3TableDataProvider = {
      async listColumns() {
        throw new Error("not called");
      },
      async listRowPage(_conn, _table, _pi, _ps, options) {
        capturedOptions = options;
        return {
          pageIndex: 0,
          pageSize: 10,
          totalRowCount: 0,
          hasNextPage: false,
          sql: "",
          sqlWithoutPagination: "",
          rows: [],
        };
      },
      async insertRow() {
        throw new Error("not called");
      },
      async updateRow() {
        throw new Error("not called");
      },
      async deleteRow() {
        throw new Error("not called");
      },
    };

    const useCase = new ListSqlite3TableRowPageUseCase(provider);
    await useCase.execute(makeSqlite3Config(), "users", 0, 10, {
      sort: { columnName: "name", direction: "asc" },
      filter: {
        keyword: "Alice",
        conditions: [{ columnName: "active", operator: "=", value: "true" }],
      },
    });

    const opts = capturedOptions as Record<string, unknown>;
    assert.ok(opts);
    assert.ok(opts.sort);
    assert.strictEqual((opts.sort as Record<string, unknown>).columnName, "name");
    assert.ok(opts.filter);
  });
});

// ---------------------------------------------------------------------------
// ExecuteSqlite3SqlUseCase
// ---------------------------------------------------------------------------

suite("Application — ExecuteSqlite3SqlUseCase", () => {
  test("executor 执行正常的 SQL", async () => {
    const mockResult: SqlExecutionResult = {
      sql: "SELECT * FROM users",
      success: true,
      isQuery: true,
      fields: [{ name: "id" }],
      rows: [{ id: 1 }],
      affectedRows: null,
      durationMs: 12,
      resultSets: [],
    };

    const executor: Sqlite3SqlExecutor = {
      async executeSql() {
        return mockResult;
      },
    };

    const useCase = new ExecuteSqlite3SqlUseCase(executor);
    const result = await useCase.execute(makeSqlite3Config(), "SELECT * FROM users");

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.isQuery, true);
    assert.strictEqual(result.sql, "SELECT * FROM users");
  });

  test("空 SQL 返回验证错误", async () => {
    const executor: Sqlite3SqlExecutor = {
      async executeSql() {
        throw new Error("should not be called");
      },
    };

    const useCase = new ExecuteSqlite3SqlUseCase(executor);
    const result = await useCase.execute(makeSqlite3Config(), "   ");

    assert.strictEqual(result.success, false);
    assert.ok(result.errorMessage!.includes("不能为空"));
    assert.strictEqual(result.durationMs, 0);
  });

  test("SQL 前后空白自动 trim", async () => {
    let receivedSql = "";

    const executor: Sqlite3SqlExecutor = {
      async executeSql(_conn, sql) {
        receivedSql = sql;
        return {
          sql,
          success: true,
          isQuery: false,
          fields: [],
          rows: [],
          affectedRows: 0,
          durationMs: 5,
          resultSets: [],
        };
      },
    };

    const useCase = new ExecuteSqlite3SqlUseCase(executor);
    await useCase.execute(makeSqlite3Config(), "  SELECT 1;  ");

    assert.strictEqual(receivedSql, "SELECT 1;");
  });
});

// ---------------------------------------------------------------------------
// ExportSqlite3TableUseCase
// ---------------------------------------------------------------------------

suite("Application — ExportSqlite3TableUseCase", () => {
  test("导出指定表的 DDL", async () => {
    const mockDoc: SqlExportDocument = {
      title: "users.ddl.sql",
      format: "sql",
      kind: "ddl",
      target: { schemaName: "main", tableName: "users" },
      content: "CREATE TABLE users (id INTEGER PRIMARY KEY);\n",
    };

    const provider: Sqlite3ExportProvider = {
      async exportTable() {
        return mockDoc;
      },
    };

    const useCase = new ExportSqlite3TableUseCase(provider);
    const target: SqlExportTableTarget = { schemaName: "main", tableName: "users" };
    const result = await useCase.execute(makeSqlite3Config(), target, "ddl");

    assert.strictEqual(result.kind, "ddl");
    assert.strictEqual("tableName" in result.target && result.target.tableName, "users");
    assert.ok(result.content.includes("CREATE TABLE"));
  });

  test("导出 DML 文档", async () => {
    const mockDoc: SqlExportDocument = {
      title: "users.dml.sql",
      format: "sql",
      kind: "dml",
      target: { schemaName: "main", tableName: "users" },
      content: "INSERT INTO users VALUES (1, 'Alice');\n",
    };

    const provider: Sqlite3ExportProvider = {
      async exportTable() {
        return mockDoc;
      },
    };

    const useCase = new ExportSqlite3TableUseCase(provider);
    const target: SqlExportTableTarget = { schemaName: "main", tableName: "users" };
    const result = await useCase.execute(makeSqlite3Config(), target, "dml");

    assert.strictEqual(result.kind, "dml");
    assert.ok(result.content.includes("INSERT INTO"));
  });

  test("空表名抛错", async () => {
    const provider: Sqlite3ExportProvider = {
      async exportTable() {
        throw new Error("should not be called");
      },
    };

    const useCase = new ExportSqlite3TableUseCase(provider);
    const target: SqlExportTableTarget = { schemaName: "main", tableName: "   " };

    await assert.rejects(() => useCase.execute(makeSqlite3Config(), target, "ddl"), /表名/);
  });

  test("kind 为 both 时导出 DDL+DML", async () => {
    const mockDoc: SqlExportDocument = {
      title: "users.sql",
      format: "sql",
      kind: "both",
      target: { schemaName: "main", tableName: "users" },
      content: "CREATE TABLE ...\n\nINSERT INTO ...\n",
    };

    const provider: Sqlite3ExportProvider = {
      async exportTable() {
        return mockDoc;
      },
    };

    const useCase = new ExportSqlite3TableUseCase(provider);
    const target: SqlExportTableTarget = { schemaName: "main", tableName: "users" };
    const result = await useCase.execute(makeSqlite3Config(), target, "both");

    assert.strictEqual(result.kind, "both");
  });
});

// ---------------------------------------------------------------------------
// InsertSqlite3TableRowUseCase
// ---------------------------------------------------------------------------

suite("Application — InsertSqlite3TableRowUseCase", () => {
  test("插入一条记录", async () => {
    const mockResult: Sqlite3TableInsertResult = {
      affectedRows: 1,
      insertId: 42,
      sql: "INSERT INTO users (name) VALUES ('Alice')",
    };

    const provider: Sqlite3TableDataProvider = {
      async listColumns() {
        throw new Error("not called");
      },
      async listRowPage() {
        throw new Error("not called");
      },
      async insertRow() {
        return mockResult;
      },
      async updateRow() {
        throw new Error("not called");
      },
      async deleteRow() {
        throw new Error("not called");
      },
    };

    const useCase = new InsertSqlite3TableRowUseCase(provider);
    const result = await useCase.execute(makeSqlite3Config(), "users", {
      name: "Alice",
    });

    assert.strictEqual(result.affectedRows, 1);
    assert.strictEqual(result.insertId, 42);
  });

  test("空表名抛错", async () => {
    const provider: Sqlite3TableDataProvider = {
      async listColumns() {
        throw new Error("not called");
      },
      async listRowPage() {
        throw new Error("not called");
      },
      async insertRow() {
        throw new Error("should not be called");
      },
      async updateRow() {
        throw new Error("not called");
      },
      async deleteRow() {
        throw new Error("not called");
      },
    };

    const useCase = new InsertSqlite3TableRowUseCase(provider);
    await assert.rejects(() => useCase.execute(makeSqlite3Config(), "   ", {}), /表名/);
  });
});

// ---------------------------------------------------------------------------
// UpdateSqlite3TableRowUseCase
// ---------------------------------------------------------------------------

suite("Application — UpdateSqlite3TableRowUseCase", () => {
  test("更新一条记录", async () => {
    const mockResult: Sqlite3TableUpdateResult = {
      affectedRows: 1,
      sql: "UPDATE users SET name = 'Bob' WHERE id = 1",
    };

    const provider: Sqlite3TableDataProvider = {
      async listColumns() {
        throw new Error("not called");
      },
      async listRowPage() {
        throw new Error("not called");
      },
      async insertRow() {
        throw new Error("not called");
      },
      async updateRow() {
        return mockResult;
      },
      async deleteRow() {
        throw new Error("not called");
      },
    };

    const useCase = new UpdateSqlite3TableRowUseCase(provider);
    const result = await useCase.execute(makeSqlite3Config(), "users", { id: 1 }, { name: "Bob" });

    assert.strictEqual(result.affectedRows, 1);
  });

  test("空表名抛错", async () => {
    const provider: Sqlite3TableDataProvider = {
      async listColumns() {
        throw new Error("not called");
      },
      async listRowPage() {
        throw new Error("not called");
      },
      async insertRow() {
        throw new Error("not called");
      },
      async updateRow() {
        throw new Error("should not be called");
      },
      async deleteRow() {
        throw new Error("not called");
      },
    };

    const useCase = new UpdateSqlite3TableRowUseCase(provider);
    await assert.rejects(
      () => useCase.execute(makeSqlite3Config(), "   ", { id: 1 }, { name: "Bob" }),
      /表名/,
    );
  });

  test("空 identityValues 抛错", async () => {
    const provider: Sqlite3TableDataProvider = {
      async listColumns() {
        throw new Error("not called");
      },
      async listRowPage() {
        throw new Error("not called");
      },
      async insertRow() {
        throw new Error("not called");
      },
      async updateRow() {
        throw new Error("should not be called");
      },
      async deleteRow() {
        throw new Error("not called");
      },
    };

    const useCase = new UpdateSqlite3TableRowUseCase(provider);
    await assert.rejects(
      () => useCase.execute(makeSqlite3Config(), "users", {}, { name: "Bob" }),
      /主键值/,
    );
  });

  test("空 values 抛错", async () => {
    const provider: Sqlite3TableDataProvider = {
      async listColumns() {
        throw new Error("not called");
      },
      async listRowPage() {
        throw new Error("not called");
      },
      async insertRow() {
        throw new Error("not called");
      },
      async updateRow() {
        throw new Error("should not be called");
      },
      async deleteRow() {
        throw new Error("not called");
      },
    };

    const useCase = new UpdateSqlite3TableRowUseCase(provider);
    await assert.rejects(
      () => useCase.execute(makeSqlite3Config(), "users", { id: 1 }, {}),
      /字段值/,
    );
  });
});

// ---------------------------------------------------------------------------
// DeleteSqlite3TableRowUseCase
// ---------------------------------------------------------------------------

suite("Application — DeleteSqlite3TableRowUseCase", () => {
  test("删除一条记录", async () => {
    const mockResult: Sqlite3TableDeleteResult = {
      affectedRows: 1,
      sql: "DELETE FROM users WHERE id = 1",
    };

    const provider: Sqlite3TableDataProvider = {
      async listColumns() {
        throw new Error("not called");
      },
      async listRowPage() {
        throw new Error("not called");
      },
      async insertRow() {
        throw new Error("not called");
      },
      async updateRow() {
        throw new Error("not called");
      },
      async deleteRow() {
        return mockResult;
      },
    };

    const useCase = new DeleteSqlite3TableRowUseCase(provider);
    const result = await useCase.execute(makeSqlite3Config(), "users", { id: 1 });

    assert.strictEqual(result.affectedRows, 1);
  });

  test("空表名抛错", async () => {
    const provider: Sqlite3TableDataProvider = {
      async listColumns() {
        throw new Error("not called");
      },
      async listRowPage() {
        throw new Error("not called");
      },
      async insertRow() {
        throw new Error("not called");
      },
      async updateRow() {
        throw new Error("not called");
      },
      async deleteRow() {
        throw new Error("should not be called");
      },
    };

    const useCase = new DeleteSqlite3TableRowUseCase(provider);
    await assert.rejects(() => useCase.execute(makeSqlite3Config(), "   ", { id: 1 }), /表名/);
  });

  test("空 identityValues 抛错", async () => {
    const provider: Sqlite3TableDataProvider = {
      async listColumns() {
        throw new Error("not called");
      },
      async listRowPage() {
        throw new Error("not called");
      },
      async insertRow() {
        throw new Error("not called");
      },
      async updateRow() {
        throw new Error("not called");
      },
      async deleteRow() {
        throw new Error("should not be called");
      },
    };

    const useCase = new DeleteSqlite3TableRowUseCase(provider);
    await assert.rejects(() => useCase.execute(makeSqlite3Config(), "users", {}), /主键值/);
  });
});
