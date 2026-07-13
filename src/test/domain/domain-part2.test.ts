import * as assert from "assert";

import type { SqlExportDocument } from "../../domain/export/SqlExportDocument";
import { formatSqlExportFileName } from "../../domain/export/SqlExportFileName";
import type {
  SqlExportBatchResult,
  SqlExportBatchSuccessItem,
  SqlExportBatchFailureItem,
} from "../../domain/export/SqlExportBatchResult";
import type {
  SqlExportFileSaveSuccessResult,
  SqlExportFileSaveFailureResult,
} from "../../domain/export/SqlExportFileSaveResult";
import type { SqlExportTaskProgress } from "../../domain/export/SqlExportTaskProgress";
import type {
  SqlExportTaskLogEntry,
  SqlExportTaskLogInput,
} from "../../domain/export/SqlExportTaskLog";
import type {
  SqlExecutionResult,
  SqlExecutionResultSet,
} from "../../domain/query/SqlExecutionResult";
import type { ImportColumnMapping } from "../../domain/import/ImportColumnMapping";
import type { ImportErrorReportInput } from "../../domain/import/ImportErrorReport";
import type {
  ImportPreviewSuccessResult,
  ImportPreviewFailureResult,
} from "../../domain/import/ImportPreviewResult";
import type { TableImportResult } from "../../domain/import/TableImportResult";
import type { SqlFileImportResult } from "../../domain/import/SqlFileImportResult";
import type {
  SqlFileImportPreviewSuccessResult,
  SqlFileImportPreviewFailureResult,
} from "../../domain/import/SqlFileImportPreviewResult";
import type { ImportTaskProgress } from "../../domain/import/ImportTaskProgress";

// ---------------------------------------------------------------------------
// SqlExportDocument 类型验证
// ---------------------------------------------------------------------------

suite("Domain — SqlExportDocument", () => {
  test("表级导出文档类型约束", () => {
    const doc: SqlExportDocument = {
      title: "users.ddl.sql",
      format: "sql",
      kind: "ddl",
      target: { schemaName: "public", tableName: "users" },
      content: "CREATE TABLE users (id INT PRIMARY KEY);",
    };

    assert.strictEqual(doc.title, "users.ddl.sql");
    assert.strictEqual(doc.format, "sql");
    assert.strictEqual(doc.kind, "ddl");
    assert.strictEqual("schemaName" in doc.target && doc.target.schemaName, "public");
    assert.strictEqual("tableName" in doc.target && doc.target.tableName, "users");
    assert.ok(doc.content.length > 0);
  });

  test("schema 级导出文档类型约束", () => {
    const doc: SqlExportDocument = {
      title: "public.schema.ddl.sql",
      format: "sql",
      kind: "ddl",
      target: { schemaName: "public" },
      content: "CREATE TABLE users (...);",
    };

    assert.strictEqual("schemaName" in doc.target && doc.target.schemaName, "public");
    assert.strictEqual(doc.kind, "ddl");
  });

  test("database 级导出文档类型约束", () => {
    const doc: SqlExportDocument = {
      title: "mydb.database.dml.sql",
      format: "sql",
      kind: "dml",
      target: { databaseName: "mydb" },
      content: "INSERT INTO users VALUES (1);",
    };

    assert.strictEqual("databaseName" in doc.target && doc.target.databaseName, "mydb");
    assert.strictEqual(doc.kind, "dml");
  });

  test("kind 为 both 的导出文档", () => {
    const doc: SqlExportDocument = {
      title: "users.sql",
      format: "sql",
      kind: "both",
      target: { schemaName: "public", tableName: "users" },
      content: "CREATE TABLE ... ;\n\nINSERT INTO ... ;",
    };

    assert.strictEqual(doc.kind, "both");
  });

  test("SQL 导出文件名在 both 模式下省略类型后缀", () => {
    assert.strictEqual(formatSqlExportFileName(["abc"], "both"), "abc.sql");
    assert.strictEqual(formatSqlExportFileName(["abc"], "ddl"), "abc.ddl.sql");
    assert.strictEqual(formatSqlExportFileName(["abc"], "dml"), "abc.dml.sql");
    assert.strictEqual(formatSqlExportFileName(["abc", "users"], "both"), "abc.users.sql");
  });
});

// ---------------------------------------------------------------------------
// SqlExportBatchResult 类型验证
// ---------------------------------------------------------------------------

suite("Domain — SqlExportBatchResult", () => {
  test("全成功批量导出结果", () => {
    const successItem: SqlExportBatchSuccessItem = {
      schemaName: "public",
      tableName: "users",
      filePath: "/tmp/public.users.ddl.sql",
      startedAt: "2026-01-01T00:00:00Z",
      endedAt: "2026-01-01T00:00:01Z",
      durationMs: 1000,
    };

    const result: SqlExportBatchResult = {
      kind: "ddl",
      targetDirectory: "/tmp/export",
      totalCount: 1,
      successCount: 1,
      failureCount: 0,
      successes: [successItem],
      failures: [],
    };

    assert.strictEqual(result.totalCount, 1);
    assert.strictEqual(result.successCount, 1);
    assert.strictEqual(result.failureCount, 0);
    assert.strictEqual(result.successes.length, 1);
    assert.strictEqual(result.failures.length, 0);
    assert.strictEqual(result.successes[0].tableName, "users");
  });

  test("部分失败批量导出结果", () => {
    const failureItem: SqlExportBatchFailureItem = {
      schemaName: "public",
      tableName: "broken_table",
      filePath: "/tmp/public.broken_table.ddl.sql",
      errorMessage: "table does not exist",
      startedAt: "2026-01-01T00:00:00Z",
      endedAt: "2026-01-01T00:00:00Z",
      durationMs: 5,
    };

    const result: SqlExportBatchResult = {
      kind: "ddl",
      targetDirectory: "/tmp/export",
      totalCount: 1,
      successCount: 0,
      failureCount: 1,
      successes: [],
      failures: [failureItem],
    };

    assert.strictEqual(result.totalCount, 1);
    assert.strictEqual(result.successCount, 0);
    assert.strictEqual(result.failureCount, 1);
    assert.strictEqual(result.failures[0].errorMessage, "table does not exist");
  });

  test("count 字段与 success/failure 数组长度一致", () => {
    const result: SqlExportBatchResult = {
      kind: "both",
      targetDirectory: "/tmp/export",
      totalCount: 3,
      successCount: 2,
      failureCount: 1,
      successes: [
        {
          schemaName: "s",
          tableName: "a",
          filePath: "/tmp/a.sql",
          startedAt: "t0",
          endedAt: "t1",
          durationMs: 1,
        },
        {
          schemaName: "s",
          tableName: "b",
          filePath: "/tmp/b.sql",
          startedAt: "t1",
          endedAt: "t2",
          durationMs: 1,
        },
      ],
      failures: [
        {
          schemaName: "s",
          tableName: "c",
          errorMessage: "fail",
          startedAt: "t2",
          endedAt: "t2",
          durationMs: 0,
        },
      ],
    };

    assert.strictEqual(result.successes.length, result.successCount);
    assert.strictEqual(result.failures.length, result.failureCount);
    assert.strictEqual(result.successCount + result.failureCount, result.totalCount);
  });
});

// ---------------------------------------------------------------------------
// SqlExportFileSaveResult 类型验证
// ---------------------------------------------------------------------------

suite("Domain — SqlExportFileSaveResult", () => {
  test("保存成功结果", () => {
    const result: SqlExportFileSaveSuccessResult = {
      success: true,
      filePath: "/home/user/exports/users.ddl.sql",
    };

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.filePath, "/home/user/exports/users.ddl.sql");
  });

  test("保存失败结果 - 含文件路径", () => {
    const result: SqlExportFileSaveFailureResult = {
      success: false,
      filePath: "/home/user/exports/users.ddl.sql",
      errorMessage: "权限不足，无法写入文件",
    };

    assert.strictEqual(result.success, false);
    assert.strictEqual(result.filePath, "/home/user/exports/users.ddl.sql");
    assert.strictEqual(result.errorMessage, "权限不足，无法写入文件");
  });

  test("保存失败结果 - 不含文件路径", () => {
    const result: SqlExportFileSaveFailureResult = {
      success: false,
      errorMessage: "用户取消保存",
    };

    assert.strictEqual(result.success, false);
    assert.strictEqual(result.filePath, undefined);
  });
});

// ---------------------------------------------------------------------------
// SqlExportTaskLog 类型验证
// ---------------------------------------------------------------------------

suite("Domain — SqlExportTaskLog", () => {
  test("成功日志条目", () => {
    const entry: SqlExportTaskLogEntry = {
      id: "log-001",
      engine: "mysql",
      connectionName: "生产数据库",
      targetType: "table",
      targetName: "public.users",
      kind: "ddl",
      status: "success",
      startedAt: "2026-01-15T10:00:00Z",
      endedAt: "2026-01-15T10:00:05Z",
      durationMs: 5000,
      filePath: "/tmp/public.users.ddl.sql",
    };

    assert.strictEqual(entry.engine, "mysql");
    assert.strictEqual(entry.status, "success");
    assert.strictEqual(entry.targetType, "table");
    assert.strictEqual(entry.errorMessage, undefined);
  });

  test("失败日志条目", () => {
    const entry: SqlExportTaskLogEntry = {
      id: "log-002",
      engine: "postgresql",
      connectionName: "测试数据库",
      targetType: "schema",
      targetName: "public",
      kind: "dml",
      status: "failure",
      startedAt: "2026-01-15T11:00:00Z",
      endedAt: "2026-01-15T11:00:03Z",
      durationMs: 3000,
      filePath: "/tmp/public.schema.dml.sql",
      errorMessage: "连接超时",
    };

    assert.strictEqual(entry.engine, "postgresql");
    assert.strictEqual(entry.status, "failure");
    assert.strictEqual(entry.errorMessage, "连接超时");
  });

  test("database 级目标日志", () => {
    const entry: SqlExportTaskLogEntry = {
      id: "log-003",
      engine: "postgresql",
      connectionName: "PG 数据库",
      targetType: "database",
      targetName: "mydb",
      kind: "both",
      status: "success",
      startedAt: "2026-01-16T08:00:00Z",
      endedAt: "2026-01-16T08:01:00Z",
      durationMs: 60000,
    };

    assert.strictEqual(entry.targetType, "database");
    assert.strictEqual(entry.targetName, "mydb");
  });

  test("SqlExportTaskLogInput 缺少 id 字段", () => {
    const input: SqlExportTaskLogInput = {
      engine: "sqlite3",
      connectionName: "本地 SQLite",
      targetType: "table",
      targetName: "users",
      kind: "ddl",
      status: "success",
      startedAt: "2026-01-01T00:00:00Z",
      endedAt: "2026-01-01T00:00:01Z",
      durationMs: 1000,
    };

    assert.strictEqual(input.engine, "sqlite3");
    assert.strictEqual((input as Record<string, unknown>).id, undefined);
  });
});

// ---------------------------------------------------------------------------
// SqlExportTaskProgress 类型验证
// ---------------------------------------------------------------------------

suite("Domain — SqlExportTaskProgress", () => {
  test("含进度的导出进度更新", () => {
    const progress: SqlExportTaskProgress = {
      completedItems: 5,
      totalItems: 10,
      message: "正在导出 public.users (5/10)...",
      percentage: 50,
    };

    assert.strictEqual(progress.completedItems, 5);
    assert.strictEqual(progress.totalItems, 10);
    assert.strictEqual(progress.message, "正在导出 public.users (5/10)...");
    assert.strictEqual(progress.percentage, 50);
  });

  test("无法统计数量时的导出进度更新", () => {
    const progress: SqlExportTaskProgress = {
      message: "正在连接数据库...",
    };

    assert.strictEqual(progress.completedItems, undefined);
    assert.strictEqual(progress.totalItems, undefined);
    assert.strictEqual(progress.percentage, undefined);
    assert.strictEqual(progress.message, "正在连接数据库...");
  });

  test("完成时 percentage 为 100", () => {
    const progress: SqlExportTaskProgress = {
      completedItems: 3,
      totalItems: 3,
      message: "导出完成",
      percentage: 100,
    };

    assert.strictEqual(progress.percentage, 100);
  });
});

// ---------------------------------------------------------------------------
// SqlExecutionResult 类型验证
// ---------------------------------------------------------------------------

suite("Domain — SqlExecutionResult", () => {
  test("查询成功结果", () => {
    const result: SqlExecutionResult = {
      sql: "SELECT * FROM users LIMIT 1",
      success: true,
      isQuery: true,
      fields: [{ name: "id" }, { name: "name" }],
      rows: [{ id: 1, name: "Alice" }],
      affectedRows: null,
      durationMs: 42,
      resultSets: [],
    };

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.isQuery, true);
    assert.strictEqual(result.fields.length, 2);
    assert.strictEqual(result.fields[0].name, "id");
    assert.strictEqual(result.rows.length, 1);
    assert.strictEqual(result.rows[0].name, "Alice");
    assert.strictEqual(result.affectedRows, null);
  });

  test("非查询成功结果 (INSERT)", () => {
    const result: SqlExecutionResult = {
      sql: "INSERT INTO users VALUES (2, 'Bob')",
      success: true,
      isQuery: false,
      fields: [],
      rows: [],
      affectedRows: 1,
      durationMs: 15,
      resultSets: [],
    };

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.isQuery, false);
    assert.strictEqual(result.affectedRows, 1);
  });

  test("执行失败结果", () => {
    const result: SqlExecutionResult = {
      sql: "SELECT * FROM nonexistent",
      success: false,
      isQuery: false,
      fields: [],
      rows: [],
      affectedRows: null,
      durationMs: 5,
      resultSets: [],
      errorMessage: "no such table: nonexistent",
    };

    assert.strictEqual(result.success, false);
    assert.strictEqual(result.errorMessage, "no such table: nonexistent");
  });

  test("多结果集查询", () => {
    const resultSet: SqlExecutionResultSet = {
      isQuery: true,
      fields: [{ name: "count" }],
      rows: [{ count: 10 }],
      affectedRows: null,
      metadata: [],
    };

    const result: SqlExecutionResult = {
      sql: "SELECT COUNT(*) FROM users; SELECT COUNT(*) FROM orders;",
      success: true,
      isQuery: true,
      fields: [{ name: "count" }],
      rows: [{ count: 10 }],
      affectedRows: null,
      durationMs: 30,
      resultSets: [resultSet],
    };

    assert.strictEqual(result.resultSets.length, 1);
    assert.strictEqual(result.resultSets[0].rows[0].count, 10);
  });

  test("metadata 包含执行统计信息", () => {
    const result: SqlExecutionResult = {
      sql: "UPDATE users SET active = 1",
      success: true,
      isQuery: false,
      fields: [],
      rows: [],
      affectedRows: 100,
      durationMs: 200,
      resultSets: [
        {
          isQuery: false,
          fields: [],
          rows: [],
          affectedRows: 100,
          metadata: [
            { key: "rows_changed", value: 100 },
            { key: "duration_ms", value: 200 },
          ],
        },
      ],
    };

    assert.strictEqual(result.resultSets[0].metadata.length, 2);
    assert.strictEqual(result.resultSets[0].metadata[0].key, "rows_changed");
  });
});

// ---------------------------------------------------------------------------
// ImportColumnMapping 类型验证
// ---------------------------------------------------------------------------

suite("Domain — ImportColumnMapping", () => {
  test("source 映射到 target", () => {
    const mapping: ImportColumnMapping = {
      sourceName: "user_name",
      targetName: "username",
    };

    assert.strictEqual(mapping.sourceName, "user_name");
    assert.strictEqual(mapping.targetName, "username");
  });

  test("targetName 为 null 表示跳过该列", () => {
    const mapping: ImportColumnMapping = {
      sourceName: "internal_id",
      targetName: null,
    };

    assert.strictEqual(mapping.sourceName, "internal_id");
    assert.strictEqual(mapping.targetName, null);
  });
});

// ---------------------------------------------------------------------------
// ImportErrorReport 类型验证
// ---------------------------------------------------------------------------

suite("Domain — ImportErrorReport", () => {
  test("执行阶段错误报告", () => {
    const input: ImportErrorReportInput = {
      formatName: "CSV",
      fileName: "users_2026.csv",
      targetName: "public.users",
      stage: "execution",
      errorMessage: "第 42 行插入失败：唯一键冲突",
      mappings: [{ sourceName: "name", targetName: "full_name" }],
    };

    assert.strictEqual(input.formatName, "CSV");
    assert.strictEqual(input.stage, "execution");
    assert.strictEqual(input.mappings!.length, 1);
  });

  test("mapping 阶段错误报告 - 不含映射", () => {
    const input: ImportErrorReportInput = {
      formatName: "JSON",
      fileName: "data.json",
      targetName: "public.users",
      stage: "mapping",
      errorMessage: "无法读取 JSON 文件结构",
    };

    assert.strictEqual(input.stage, "mapping");
    assert.strictEqual(input.mappings, undefined);
  });
});

// ---------------------------------------------------------------------------
// ImportPreviewResult 类型验证
// ---------------------------------------------------------------------------

suite("Domain — ImportPreviewResult", () => {
  test("成功预览结果", () => {
    const result: ImportPreviewSuccessResult = {
      success: true,
      totalRows: 3,
      headers: ["name", "age"],
      rows: [
        ["Alice", 30],
        ["Bob", 25],
        ["Charlie", 35],
      ],
    };

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.totalRows, 3);
    assert.strictEqual(result.headers.length, 2);
    assert.strictEqual(result.rows.length, 3);
    assert.strictEqual(result.rows[0][0], "Alice");
  });

  test("失败预览结果", () => {
    const result: ImportPreviewFailureResult = {
      success: false,
      errorMessage: "文件格式不正确，无法解析",
    };

    assert.strictEqual(result.success, false);
    assert.strictEqual(result.errorMessage, "文件格式不正确，无法解析");
  });
});

// ---------------------------------------------------------------------------
// TableImportResult / 文件导入结果 类型验证
// ---------------------------------------------------------------------------

suite("Domain — FileImportResults", () => {
  test("TableImportResult 成功插入行", () => {
    const result: TableImportResult = {
      success: true,
      durationMs: 350,
      insertedRows: 100,
    };

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.insertedRows, 100);
    assert.strictEqual(result.errorMessage, undefined);
  });

  test("TableImportResult 插入失败", () => {
    const result: TableImportResult = {
      success: false,
      durationMs: 10,
      insertedRows: 0,
      errorMessage: "目标表不存在",
    };

    assert.strictEqual(result.success, false);
    assert.strictEqual(result.insertedRows, 0);
    assert.strictEqual(result.errorMessage, "目标表不存在");
  });

  test("SqlFileImportResult 成功", () => {
    const result: SqlFileImportResult = {
      success: true,
      durationMs: 5000,
    };

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.durationMs, 5000);
  });

  test("SqlFileImportPreviewSuccessResult", () => {
    const result: SqlFileImportPreviewSuccessResult = {
      success: true,
      totalLines: 42,
      previewText: "CREATE TABLE users (id INT);\nINSERT INTO users VALUES (1);",
    };

    assert.strictEqual(result.totalLines, 42);
    assert.ok(result.previewText.includes("CREATE TABLE"));
  });

  test("SqlFileImportPreviewFailureResult", () => {
    const result: SqlFileImportPreviewFailureResult = {
      success: false,
      errorMessage: "文件太大，无法预览",
    };

    assert.strictEqual(result.success, false);
  });
});

// ---------------------------------------------------------------------------
// ImportTaskProgress 类型验证
// ---------------------------------------------------------------------------

suite("Domain — ImportTaskProgress", () => {
  test("含进度的导入进度更新", () => {
    const progress: ImportTaskProgress = {
      completedRows: 500,
      totalRows: 1000,
      message: "正在导入第 500/1000 行...",
      percentage: 50,
    };

    assert.strictEqual(progress.completedRows, 500);
    assert.strictEqual(progress.totalRows, 1000);
    assert.strictEqual(progress.percentage, 50);
  });

  test("无法统计时的导入进度更新", () => {
    const progress: ImportTaskProgress = {
      message: "正在解析文件...",
    };

    assert.strictEqual(progress.completedRows, undefined);
    assert.strictEqual(progress.totalRows, undefined);
    assert.strictEqual(progress.percentage, undefined);
  });
});
