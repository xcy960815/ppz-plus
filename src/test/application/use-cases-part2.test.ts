import * as assert from "assert";

import type {
  ConnectionConfig,
  MysqlConnectionConfig,
} from "../../domain/connections/ConnectionConfig";
import type { ImportMappingPreparationResult } from "../../domain/import/ImportColumnMapping";
import type { ImportErrorReportInput } from "../../domain/import/ImportErrorReport";
import type { CancellationSignal } from "../../domain/tasks/CancellationSignal";
import { OperationCanceledError } from "../../domain/tasks/CancellationSignal";
import type {
  MySqlTableDataProvider,
  MySqlTableColumnMetadata,
  MySqlTableInsertValues,
  MySqlTableInsertResult,
  MySqlTableRowIdentityValues,
  MySqlTableUpdateValues,
  MySqlTableUpdateResult,
  MySqlTableDeleteResult,
} from "../../application/mysql/MySqlTableDataProvider";
import type {
  MySqlTableImportProvider,
  MySqlTableImportRow,
} from "../../application/mysql/MySqlTableImportProvider";
import type { MySqlSqlFileImportProvider } from "../../application/mysql/MySqlSqlFileImportProvider";
import type { SqlFileReader } from "../../application/import/SqlFileReader";
import type { CsvFileReader } from "../../application/import/CsvFileReader";
import type { JsonFileReader } from "../../application/import/JsonFileReader";
import type { SqlExportTaskProgressReporter } from "../../domain/export/SqlExportTaskProgress";
import type { TableImportResult } from "../../domain/import/TableImportResult";
import type { SqlFileImportResult } from "../../domain/import/SqlFileImportResult";

import { CsvDocumentParser } from "../../application/import/CsvDocumentParser";
import { JsonDocumentParser } from "../../application/import/JsonDocumentParser";
import { ImportColumnMapper } from "../../application/import/ImportColumnMapper";

import { InsertMySqlTableRowUseCase } from "../../application/useCases/InsertMySqlTableRowUseCase";
import { UpdateMySqlTableRowUseCase } from "../../application/useCases/UpdateMySqlTableRowUseCase";
import { DeleteMySqlTableRowUseCase } from "../../application/useCases/DeleteMySqlTableRowUseCase";
import { ExportMySqlTablesBatchUseCase } from "../../application/useCases/ExportMySqlTablesBatchUseCase";
import { ExportMySqlTableUseCase } from "../../application/useCases/ExportMySqlTableUseCase";
import { SaveSqlExportDocumentUseCase } from "../../application/useCases/SaveSqlExportDocumentUseCase";
import type { MySqlExportProvider } from "../../application/mysql/MySqlExportProvider";
import type { SqlExportFileWriter } from "../../application/export/SqlExportFileWriter";
import { PreviewMySqlCsvFileImportUseCase } from "../../application/useCases/PreviewMySqlCsvFileImportUseCase";
import { PreviewMySqlJsonFileImportUseCase } from "../../application/useCases/PreviewMySqlJsonFileImportUseCase";
import { PreviewMySqlSqlFileImportUseCase } from "../../application/useCases/PreviewMySqlSqlFileImportUseCase";
import { ImportMySqlCsvFileUseCase } from "../../application/useCases/ImportMySqlCsvFileUseCase";
import { ImportMySqlJsonFileUseCase } from "../../application/useCases/ImportMySqlJsonFileUseCase";
import { ImportMySqlSqlFileUseCase } from "../../application/useCases/ImportMySqlSqlFileUseCase";
import { PrepareMySqlCsvImportMappingUseCase } from "../../application/useCases/PrepareMySqlCsvImportMappingUseCase";
import { PrepareMySqlJsonImportMappingUseCase } from "../../application/useCases/PrepareMySqlJsonImportMappingUseCase";
import { CreateImportErrorReportUseCase } from "../../application/useCases/CreateImportErrorReportUseCase";

// ---------------------------------------------------------------------------
// 共享 fixture
// ---------------------------------------------------------------------------

function makeMysqlConfig(overrides: Partial<MysqlConnectionConfig> = {}): MysqlConnectionConfig {
  return {
    id: "test-conn-1",
    name: "测试连接",
    engine: "mysql",
    mode: "parameters",
    host: "127.0.0.1",
    port: 3306,
    username: "root",
    ...overrides,
  } as MysqlConnectionConfig;
}

function mockTableDataProvider(): MySqlTableDataProvider {
  return {
    async listColumns(_conn, _schemaName, _tableName) {
      return [
        {
          name: "id",
          dataType: "int",
          dateTimePrecision: null,
          nullable: false,
          isPrimaryKey: true,
          extra: "auto_increment",
        },
        {
          name: "name",
          dataType: "varchar(255)",
          dateTimePrecision: null,
          nullable: true,
          isPrimaryKey: false,
          extra: "",
        },
      ];
    },
    async listRowPage() {
      throw new Error("不应调用");
    },
    async insertRow() {
      throw new Error("不应调用");
    },
    async updateRow() {
      throw new Error("不应调用");
    },
    async deleteRow() {
      throw new Error("不应调用");
    },
  };
}

// ---------------------------------------------------------------------------
// InsertMySqlTableRowUseCase
// ---------------------------------------------------------------------------

suite("Application — InsertMySqlTableRowUseCase", () => {
  test("空 schemaName 抛错", async () => {
    const provider = mockTableDataProvider();
    const useCase = new InsertMySqlTableRowUseCase(provider);

    await assert.rejects(
      () => useCase.execute(makeMysqlConfig(), "  ", "t", {}),
      /需要提供 schema 名称/,
    );
  });

  test("空 tableName 抛错", async () => {
    const provider = mockTableDataProvider();
    const useCase = new InsertMySqlTableRowUseCase(provider);

    await assert.rejects(() => useCase.execute(makeMysqlConfig(), "db", "", {}), /需要提供表名/);
  });

  test("有效参数透传到 provider", async () => {
    let lastValues: MySqlTableInsertValues | undefined;
    const provider: MySqlTableDataProvider = {
      ...mockTableDataProvider(),
      async insertRow(_conn, _schemaName, _tableName, values) {
        lastValues = values;
        return { affectedRows: 1, insertId: "42", sql: "INSERT ..." };
      },
    };
    const useCase = new InsertMySqlTableRowUseCase(provider);

    const result = await useCase.execute(makeMysqlConfig(), "db", "users", { name: "Alice" });

    assert.strictEqual(result.affectedRows, 1);
    assert.strictEqual(result.insertId, "42");
    assert.deepStrictEqual(lastValues, { name: "Alice" });
  });
});

// ---------------------------------------------------------------------------
// UpdateMySqlTableRowUseCase
// ---------------------------------------------------------------------------

suite("Application — UpdateMySqlTableRowUseCase", () => {
  test("空 schemaName 抛错", async () => {
    const provider = mockTableDataProvider();
    const useCase = new UpdateMySqlTableRowUseCase(provider);

    await assert.rejects(
      () => useCase.execute(makeMysqlConfig(), "  ", "t", { id: 1 }, { name: "X" }),
      /需要提供 schema 名称/,
    );
  });

  test("空 tableName 抛错", async () => {
    const provider = mockTableDataProvider();
    const useCase = new UpdateMySqlTableRowUseCase(provider);

    await assert.rejects(
      () => useCase.execute(makeMysqlConfig(), "db", "", { id: 1 }, { name: "X" }),
      /需要提供表名/,
    );
  });

  test("空 identityValues 抛错", async () => {
    const provider = mockTableDataProvider();
    const useCase = new UpdateMySqlTableRowUseCase(provider);

    await assert.rejects(
      () => useCase.execute(makeMysqlConfig(), "db", "t", {}, { name: "X" }),
      /需要提供主键值/,
    );
  });

  test("空 values 抛错", async () => {
    const provider = mockTableDataProvider();
    const useCase = new UpdateMySqlTableRowUseCase(provider);

    await assert.rejects(
      () => useCase.execute(makeMysqlConfig(), "db", "t", { id: 1 }, {}),
      /至少需要提供一个字段值/,
    );
  });

  test("有效参数透传到 provider", async () => {
    let lastIdentity: MySqlTableRowIdentityValues | undefined;
    const provider: MySqlTableDataProvider = {
      ...mockTableDataProvider(),
      async updateRow(_conn, _schemaName, _tableName, identityValues, values) {
        lastIdentity = identityValues;
        return { affectedRows: 1, sql: "UPDATE ..." };
      },
    };
    const useCase = new UpdateMySqlTableRowUseCase(provider);

    const result = await useCase.execute(
      makeMysqlConfig(),
      "db",
      "users",
      { id: 1 },
      { name: "Bob" },
    );

    assert.strictEqual(result.affectedRows, 1);
    assert.deepStrictEqual(lastIdentity, { id: 1 });
  });
});

// ---------------------------------------------------------------------------
// DeleteMySqlTableRowUseCase
// ---------------------------------------------------------------------------

suite("Application — DeleteMySqlTableRowUseCase", () => {
  test("空 schemaName 抛错", async () => {
    const provider = mockTableDataProvider();
    const useCase = new DeleteMySqlTableRowUseCase(provider);

    await assert.rejects(
      () => useCase.execute(makeMysqlConfig(), "  ", "t", { id: 1 }),
      /需要提供 schema 名称/,
    );
  });

  test("空 tableName 抛错", async () => {
    const provider = mockTableDataProvider();
    const useCase = new DeleteMySqlTableRowUseCase(provider);

    await assert.rejects(
      () => useCase.execute(makeMysqlConfig(), "db", "", { id: 1 }),
      /需要提供表名/,
    );
  });

  test("空 identityValues 抛错", async () => {
    const provider = mockTableDataProvider();
    const useCase = new DeleteMySqlTableRowUseCase(provider);

    await assert.rejects(() => useCase.execute(makeMysqlConfig(), "db", "t", {}), /需要提供主键值/);
  });

  test("有效参数透传到 provider", async () => {
    let called = false;
    const provider: MySqlTableDataProvider = {
      ...mockTableDataProvider(),
      async deleteRow(_conn, _schemaName, _tableName, _identityValues) {
        called = true;
        return { affectedRows: 1, sql: "DELETE ..." };
      },
    };
    const useCase = new DeleteMySqlTableRowUseCase(provider);

    const result = await useCase.execute(makeMysqlConfig(), "db", "users", { id: 1 });

    assert.strictEqual(result.affectedRows, 1);
    assert.ok(called);
  });
});

// ---------------------------------------------------------------------------
// ExportMySqlTablesBatchUseCase
// ---------------------------------------------------------------------------

suite("Application — ExportMySqlTablesBatchUseCase", () => {
  function makeExportProvider(): MySqlExportProvider {
    return {
      async exportTable(_conn, target, kind) {
        return {
          title: `${target.schemaName}.${target.tableName}.${kind}.sql`,
          format: "sql" as const,
          kind,
          target,
          content: `-- DDL for ${target.tableName}`,
        };
      },
      async exportSchema(_conn, target, kind) {
        return {
          title: `${target.schemaName}.${kind}.sql`,
          format: "sql" as const,
          kind,
          target,
          content: "-- schema export",
        };
      },
    };
  }

  function makeFileWriter(): SqlExportFileWriter {
    return {
      async writeText() {},
    };
  }

  test("空 targetDirectory 抛错", async () => {
    const useCase = new ExportMySqlTablesBatchUseCase(
      new ExportMySqlTableUseCase(makeExportProvider()),
      new SaveSqlExportDocumentUseCase(makeFileWriter()),
    );

    await assert.rejects(
      () =>
        useCase.execute(makeMysqlConfig(), {
          tables: [{ schemaName: "db", tableName: "t" }],
          kind: "ddl",
          targetDirectory: "  ",
        }),
      /需要提供目标目录/,
    );
  });

  test("空表列表抛错", async () => {
    const useCase = new ExportMySqlTablesBatchUseCase(
      new ExportMySqlTableUseCase(makeExportProvider()),
      new SaveSqlExportDocumentUseCase(makeFileWriter()),
    );

    await assert.rejects(
      () =>
        useCase.execute(makeMysqlConfig(), {
          tables: [],
          kind: "ddl",
          targetDirectory: "/tmp",
        }),
      /至少选择一张/,
    );
  });

  test("空 schemaName 在 normalize 阶段抛错", async () => {
    const useCase = new ExportMySqlTablesBatchUseCase(
      new ExportMySqlTableUseCase(makeExportProvider()),
      new SaveSqlExportDocumentUseCase(makeFileWriter()),
    );

    await assert.rejects(
      () =>
        useCase.execute(makeMysqlConfig(), {
          tables: [{ schemaName: "  ", tableName: "t" }],
          kind: "ddl",
          targetDirectory: "/tmp",
        }),
      /需要提供 schema 名称/,
    );
  });

  test("空 tableName 在 normalize 阶段抛错", async () => {
    const useCase = new ExportMySqlTablesBatchUseCase(
      new ExportMySqlTableUseCase(makeExportProvider()),
      new SaveSqlExportDocumentUseCase(makeFileWriter()),
    );

    await assert.rejects(
      () =>
        useCase.execute(makeMysqlConfig(), {
          tables: [{ schemaName: "db", tableName: "" }],
          kind: "ddl",
          targetDirectory: "/tmp",
        }),
      /需要提供表名/,
    );
  });

  test("单表批量导出成功汇总", async () => {
    const useCase = new ExportMySqlTablesBatchUseCase(
      new ExportMySqlTableUseCase(makeExportProvider()),
      new SaveSqlExportDocumentUseCase(makeFileWriter()),
    );

    const result = await useCase.execute(makeMysqlConfig(), {
      tables: [{ schemaName: "test_db", tableName: "users" }],
      kind: "ddl",
      targetDirectory: "/tmp/exports",
    });

    assert.strictEqual(result.kind, "ddl");
    assert.strictEqual(result.targetDirectory, "/tmp/exports");
    assert.strictEqual(result.totalCount, 1);
    assert.strictEqual(result.successCount, 1);
    assert.strictEqual(result.failureCount, 0);
    assert.strictEqual(result.successes.length, 1);
    assert.strictEqual(result.successes[0].schemaName, "test_db");
    assert.strictEqual(result.successes[0].tableName, "users");
    assert.ok(result.successes[0].filePath);
    assert.ok(result.successes[0].filePath.endsWith(".sql"));
  });

  test("多表批量导出进度回调被调用", async () => {
    const progressCalls: { completedItems?: number; totalItems?: number }[] = [];
    const reporter: SqlExportTaskProgressReporter = (progress) => {
      progressCalls.push({
        completedItems: progress.completedItems,
        totalItems: progress.totalItems,
      });
    };

    const useCase = new ExportMySqlTablesBatchUseCase(
      new ExportMySqlTableUseCase(makeExportProvider()),
      new SaveSqlExportDocumentUseCase(makeFileWriter()),
    );

    await useCase.execute(makeMysqlConfig(), {
      tables: [
        { schemaName: "db", tableName: "t1" },
        { schemaName: "db", tableName: "t2" },
      ],
      kind: "ddl",
      targetDirectory: "/tmp",
      progressReporter: reporter,
    });

    assert.ok(progressCalls.length >= 3);
    // 第一次：正在准备导出
    assert.strictEqual(progressCalls[0].completedItems, 0);
    assert.strictEqual(progressCalls[0].totalItems, 2);
  });

  test("取消信号在迭代中抛出", async () => {
    const useCase = new ExportMySqlTablesBatchUseCase(
      new ExportMySqlTableUseCase(makeExportProvider()),
      new SaveSqlExportDocumentUseCase(makeFileWriter()),
    );

    const cancelSignal: CancellationSignal = { isCancellationRequested: true };

    await assert.rejects(
      () =>
        useCase.execute(makeMysqlConfig(), {
          tables: [{ schemaName: "db", tableName: "t" }],
          kind: "ddl",
          targetDirectory: "/tmp",
          cancellationSignal: cancelSignal,
        }),
      OperationCanceledError,
    );
  });

  test("单表导出失败时记录到 failures", async () => {
    const failingWriter: SqlExportFileWriter = {
      async writeText() {
        throw new Error("磁盘已满");
      },
    };
    const useCase = new ExportMySqlTablesBatchUseCase(
      new ExportMySqlTableUseCase(makeExportProvider()),
      new SaveSqlExportDocumentUseCase(failingWriter),
    );

    const result = await useCase.execute(makeMysqlConfig(), {
      tables: [{ schemaName: "db", tableName: "t" }],
      kind: "ddl",
      targetDirectory: "/tmp",
    });

    assert.strictEqual(result.successCount, 0);
    assert.strictEqual(result.failureCount, 1);
    assert.strictEqual(result.failures.length, 1);
    assert.ok(result.failures[0].errorMessage.includes("磁盘已满"));
  });

  test("文件名清理逻辑：特殊字符替换为下划线", async () => {
    const useCase = new ExportMySqlTablesBatchUseCase(
      new ExportMySqlTableUseCase(makeExportProvider()),
      new SaveSqlExportDocumentUseCase(makeFileWriter()),
    );

    const result = await useCase.execute(makeMysqlConfig(), {
      tables: [{ schemaName: "test_db", tableName: "my:table" }],
      kind: "ddl",
      targetDirectory: "/tmp",
    });

    const filePath = result.successes[0].filePath;
    assert.ok(!filePath.includes(":"));
    assert.ok(filePath.includes("my_table"));
  });
});

// ---------------------------------------------------------------------------
// PreviewMySqlCsvFileImportUseCase
// ---------------------------------------------------------------------------

suite("Application — PreviewMySqlCsvFileImportUseCase", () => {
  test("空文件路径返回失败", async () => {
    const useCase = new PreviewMySqlCsvFileImportUseCase(
      {
        async readText() {
          return "";
        },
      },
      new CsvDocumentParser(),
      new ImportColumnMapper(),
      mockTableDataProvider(),
    );

    const result = await useCase.execute(
      makeMysqlConfig(),
      { schemaName: "db", tableName: "t" },
      "  ",
    );

    assert.strictEqual(result.success, false);
    assert.ok(result.errorMessage?.includes("文件路径"));
  });

  test("解析失败时返回失败", async () => {
    const useCase = new PreviewMySqlCsvFileImportUseCase(
      {
        async readText() {
          return "";
        },
      },
      new CsvDocumentParser(),
      new ImportColumnMapper(),
      mockTableDataProvider(),
    );

    const result = await useCase.execute(
      makeMysqlConfig(),
      { schemaName: "db", tableName: "t" },
      "/tmp/test.csv",
    );

    assert.strictEqual(result.success, false);
  });

  test("标准 CSV 生成预览", async () => {
    const useCase = new PreviewMySqlCsvFileImportUseCase(
      {
        async readText() {
          return "name,age\nAlice,30";
        },
      },
      new CsvDocumentParser(),
      new ImportColumnMapper(),
      mockTableDataProvider(),
    );

    const result = await useCase.execute(
      makeMysqlConfig(),
      { schemaName: "db", tableName: "t" },
      "/tmp/test.csv",
    );

    assert.strictEqual(result.success, true);
    if (result.success) {
      assert.strictEqual(result.totalRows, 1);
      assert.ok(result.headers.includes("name"));
      // 目标表字段是 id 和 name，CSV 文件中的 age=csv 字段与 id=name 没有匹配，由 importColumnMapper.mapHeaders 处理
      assert.strictEqual(result.rows.length, 1);
      assert.strictEqual(result.rows.length, 1);
    }
  });

  test("预览不超过 5 行", async () => {
    const csvContent = "name\n" + Array.from({ length: 10 }, (_, i) => `Row${i}`).join("\n");
    const useCase = new PreviewMySqlCsvFileImportUseCase(
      {
        async readText() {
          return csvContent;
        },
      },
      new CsvDocumentParser(),
      new ImportColumnMapper(),
      mockTableDataProvider(),
    );

    const result = await useCase.execute(
      makeMysqlConfig(),
      { schemaName: "db", tableName: "t" },
      "/tmp/test.csv",
    );

    assert.strictEqual(result.success, true);
    if (result.success) {
      assert.strictEqual(result.totalRows, 10);
      assert.strictEqual(result.rows.length, 5);
    }
  });
});

// ---------------------------------------------------------------------------
// PreviewMySqlJsonFileImportUseCase
// ---------------------------------------------------------------------------

suite("Application — PreviewMySqlJsonFileImportUseCase", () => {
  test("空文件路径返回失败", async () => {
    const useCase = new PreviewMySqlJsonFileImportUseCase(
      {
        async readText() {
          return "[]";
        },
      },
      new JsonDocumentParser(),
      new ImportColumnMapper(),
      mockTableDataProvider(),
    );

    const result = await useCase.execute(
      makeMysqlConfig(),
      { schemaName: "db", tableName: "t" },
      "  ",
    );

    assert.strictEqual(result.success, false);
  });

  test("标准 JSON 生成预览", async () => {
    const useCase = new PreviewMySqlJsonFileImportUseCase(
      {
        async readText() {
          return '[{"name":"Alice","age":30}]';
        },
      },
      new JsonDocumentParser(),
      new ImportColumnMapper(),
      mockTableDataProvider(),
    );

    const result = await useCase.execute(
      makeMysqlConfig(),
      { schemaName: "db", tableName: "t" },
      "/tmp/test.json",
    );

    assert.strictEqual(result.success, true);
    if (result.success) {
      assert.strictEqual(result.totalRows, 1);
      assert.strictEqual(result.rows.length, 1);
    }
  });
});

// ---------------------------------------------------------------------------
// PreviewMySqlSqlFileImportUseCase
// ---------------------------------------------------------------------------

suite("Application — PreviewMySqlSqlFileImportUseCase", () => {
  test("空文件路径返回失败", async () => {
    const useCase = new PreviewMySqlSqlFileImportUseCase({
      async readText() {
        return "SELECT 1";
      },
    });

    const result = await useCase.execute("  ");

    assert.strictEqual(result.success, false);
  });

  test("空 SQL 文件返回失败", async () => {
    const useCase = new PreviewMySqlSqlFileImportUseCase({
      async readText() {
        return "   ";
      },
    });

    const result = await useCase.execute("/tmp/test.sql");

    assert.strictEqual(result.success, false);
    assert.ok(result.errorMessage?.includes("空"));
  });

  test("正常 SQL 文件生成预览", async () => {
    const sql = "CREATE TABLE t (id INT);\nINSERT INTO t VALUES (1);";
    const useCase = new PreviewMySqlSqlFileImportUseCase({
      async readText() {
        return sql;
      },
    });

    const result = await useCase.execute("/tmp/test.sql");

    assert.strictEqual(result.success, true);
    if (result.success) {
      assert.strictEqual(result.totalLines, 2);
      assert.ok(result.previewText.includes("CREATE TABLE"));
    }
  });

  test("超过 20 行只展示前 20 行", async () => {
    const lines = Array.from({ length: 30 }, (_, i) => `-- line ${i}`);
    const useCase = new PreviewMySqlSqlFileImportUseCase({
      async readText() {
        return lines.join("\n");
      },
    });

    const result = await useCase.execute("/tmp/test.sql");

    assert.strictEqual(result.success, true);
    if (result.success) {
      assert.strictEqual(result.totalLines, 30);
      assert.strictEqual(result.previewText.split("\n").length, 20);
    }
  });

  test("reader 抛错时返回失败", async () => {
    const useCase = new PreviewMySqlSqlFileImportUseCase({
      async readText() {
        throw new Error("文件不存在");
      },
    });

    const result = await useCase.execute("/tmp/test.sql");

    assert.strictEqual(result.success, false);
    assert.ok(result.errorMessage?.includes("文件不存在"));
  });
});

// ---------------------------------------------------------------------------
// ImportMySqlCsvFileUseCase
// ---------------------------------------------------------------------------

suite("Application — ImportMySqlCsvFileUseCase", () => {
  function mockImportProvider(): MySqlTableImportProvider {
    return {
      async importRows() {
        return { success: true, durationMs: 100, insertedRows: 2 };
      },
    };
  }

  function mockReader(): CsvFileReader {
    return {
      async readText() {
        return "name,age\nAlice,30\nBob,25";
      },
    };
  }

  test("空 schemaName 返回失败", async () => {
    const useCase = new ImportMySqlCsvFileUseCase(
      mockReader(),
      new CsvDocumentParser(),
      new ImportColumnMapper(),
      mockTableDataProvider(),
      mockImportProvider(),
    );

    const result = await useCase.execute(
      makeMysqlConfig(),
      { schemaName: "  ", tableName: "t" },
      "/tmp/test.csv",
    );

    assert.strictEqual(result.success, false);
    assert.ok(result.errorMessage?.includes("schema"));
  });

  test("空 tableName 返回失败", async () => {
    const useCase = new ImportMySqlCsvFileUseCase(
      mockReader(),
      new CsvDocumentParser(),
      new ImportColumnMapper(),
      mockTableDataProvider(),
      mockImportProvider(),
    );

    const result = await useCase.execute(
      makeMysqlConfig(),
      { schemaName: "db", tableName: "" },
      "/tmp/test.csv",
    );

    assert.strictEqual(result.success, false);
    assert.ok(result.errorMessage?.includes("表名"));
  });

  test("空文件路径返回失败", async () => {
    const useCase = new ImportMySqlCsvFileUseCase(
      mockReader(),
      new CsvDocumentParser(),
      new ImportColumnMapper(),
      mockTableDataProvider(),
      mockImportProvider(),
    );

    const result = await useCase.execute(
      makeMysqlConfig(),
      { schemaName: "db", tableName: "t" },
      "  ",
    );

    assert.strictEqual(result.success, false);
  });

  test("正常导入成功", async () => {
    const useCase = new ImportMySqlCsvFileUseCase(
      mockReader(),
      new CsvDocumentParser(),
      new ImportColumnMapper(),
      mockTableDataProvider(),
      mockImportProvider(),
    );

    const result = await useCase.execute(
      makeMysqlConfig(),
      { schemaName: "db", tableName: "t" },
      "/tmp/test.csv",
    );

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.insertedRows, 2);
  });

  test("取消信号抛出时重新抛出", async () => {
    const useCase = new ImportMySqlCsvFileUseCase(
      mockReader(),
      new CsvDocumentParser(),
      new ImportColumnMapper(),
      mockTableDataProvider(),
      mockImportProvider(),
    );

    await assert.rejects(
      () =>
        useCase.execute(
          makeMysqlConfig(),
          { schemaName: "db", tableName: "t" },
          "/tmp/test.csv",
          undefined,
          undefined,
          { isCancellationRequested: true },
        ),
      OperationCanceledError,
    );
  });
});

// ---------------------------------------------------------------------------
// ImportMySqlJsonFileUseCase
// ---------------------------------------------------------------------------

suite("Application — ImportMySqlJsonFileUseCase", () => {
  function mockImportProvider(): MySqlTableImportProvider {
    return {
      async importRows() {
        return { success: true, durationMs: 50, insertedRows: 1 };
      },
    };
  }

  function mockReader(): JsonFileReader {
    return {
      async readText() {
        return '[{"name":"Alice"}]';
      },
    };
  }

  test("空 schemaName 返回失败", async () => {
    const useCase = new ImportMySqlJsonFileUseCase(
      mockReader(),
      new JsonDocumentParser(),
      new ImportColumnMapper(),
      mockTableDataProvider(),
      mockImportProvider(),
    );

    const result = await useCase.execute(
      makeMysqlConfig(),
      { schemaName: "  ", tableName: "t" },
      "/tmp/test.json",
    );

    assert.strictEqual(result.success, false);
  });

  test("正常导入成功", async () => {
    const useCase = new ImportMySqlJsonFileUseCase(
      mockReader(),
      new JsonDocumentParser(),
      new ImportColumnMapper(),
      mockTableDataProvider(),
      mockImportProvider(),
    );

    const result = await useCase.execute(
      makeMysqlConfig(),
      { schemaName: "db", tableName: "t" },
      "/tmp/test.json",
    );

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.insertedRows, 1);
  });
});

// ---------------------------------------------------------------------------
// ImportMySqlSqlFileUseCase
// ---------------------------------------------------------------------------

suite("Application — ImportMySqlSqlFileUseCase", () => {
  function mockImportProvider(): MySqlSqlFileImportProvider {
    return {
      async importSql() {
        return { success: true, durationMs: 200 };
      },
    };
  }

  test("空文件路径返回失败", async () => {
    const useCase = new ImportMySqlSqlFileUseCase(
      {
        async readText() {
          return "SELECT 1";
        },
      },
      mockImportProvider(),
    );

    const result = await useCase.execute(makeMysqlConfig(), "  ");

    assert.strictEqual(result.success, false);
    assert.ok(result.errorMessage?.includes("文件路径"));
  });

  test("空 SQL 内容返回失败", async () => {
    const useCase = new ImportMySqlSqlFileUseCase(
      {
        async readText() {
          return "  ";
        },
      },
      mockImportProvider(),
    );

    const result = await useCase.execute(makeMysqlConfig(), "/tmp/test.sql");

    assert.strictEqual(result.success, false);
    assert.ok(result.errorMessage?.includes("空"));
  });

  test("正常导入成功", async () => {
    const useCase = new ImportMySqlSqlFileUseCase(
      {
        async readText() {
          return "CREATE TABLE t (id INT);";
        },
      },
      mockImportProvider(),
    );

    const result = await useCase.execute(makeMysqlConfig(), "/tmp/test.sql");

    assert.strictEqual(result.success, true);
  });

  test("取消信号抛出", async () => {
    const useCase = new ImportMySqlSqlFileUseCase(
      {
        async readText() {
          return "SELECT 1";
        },
      },
      mockImportProvider(),
    );

    await assert.rejects(
      () =>
        useCase.execute(makeMysqlConfig(), "/tmp/test.sql", {
          isCancellationRequested: true,
        }),
      OperationCanceledError,
    );
  });
});

// ---------------------------------------------------------------------------
// PrepareMySqlCsvImportMappingUseCase
// ---------------------------------------------------------------------------

suite("Application — PrepareMySqlCsvImportMappingUseCase", () => {
  test("返回源字段、目标字段和默认映射", async () => {
    const useCase = new PrepareMySqlCsvImportMappingUseCase(
      {
        async readText() {
          return "id,name\n1,Alice";
        },
      },
      new CsvDocumentParser(),
      new ImportColumnMapper(),
      mockTableDataProvider(),
    );

    const result = await useCase.execute(
      makeMysqlConfig(),
      { schemaName: "db", tableName: "t" },
      "/tmp/test.csv",
    );

    assert.strictEqual(result.success, true);
    if (result.success) {
      assert.deepStrictEqual(result.sourceFields, ["id", "name"]);
      assert.deepStrictEqual(result.targetFields, ["id", "name"]);
      assert.strictEqual(result.defaultMappings.length, 2);
    }
  });

  test("解析失败时返回失败", async () => {
    const useCase = new PrepareMySqlCsvImportMappingUseCase(
      {
        async readText() {
          return "";
        },
      },
      new CsvDocumentParser(),
      new ImportColumnMapper(),
      mockTableDataProvider(),
    );

    const result = await useCase.execute(
      makeMysqlConfig(),
      { schemaName: "db", tableName: "t" },
      "/tmp/test.csv",
    );

    assert.strictEqual(result.success, false);
  });
});

// ---------------------------------------------------------------------------
// PrepareMySqlJsonImportMappingUseCase
// ---------------------------------------------------------------------------

suite("Application — PrepareMySqlJsonImportMappingUseCase", () => {
  test("返回源字段、目标字段和默认映射", async () => {
    const useCase = new PrepareMySqlJsonImportMappingUseCase(
      {
        async readText() {
          return '[{"id":1,"name":"Alice"}]';
        },
      },
      new JsonDocumentParser(),
      new ImportColumnMapper(),
      mockTableDataProvider(),
    );

    const result = await useCase.execute(
      makeMysqlConfig(),
      { schemaName: "db", tableName: "t" },
      "/tmp/test.json",
    );

    assert.strictEqual(result.success, true);
    if (result.success) {
      assert.deepStrictEqual(result.sourceFields, ["id", "name"]);
      assert.strictEqual(result.defaultMappings.length, 2);
    }
  });
});

// ---------------------------------------------------------------------------
// CreateImportErrorReportUseCase
// ---------------------------------------------------------------------------

suite("Application — CreateImportErrorReportUseCase", () => {
  test("生成包含错误阶段映射的 Markdown 报告", () => {
    const useCase = new CreateImportErrorReportUseCase();
    const input: ImportErrorReportInput = {
      formatName: "CSV",
      fileName: "data.csv",
      targetName: "test_db.users",
      stage: "mapping",
      errorMessage: "字段映射失败",
      mappings: [
        { sourceName: "id", targetName: "id" },
        { sourceName: "extra", targetName: null },
      ],
    };

    const doc = useCase.execute(input);

    assert.strictEqual(doc.language, "markdown");
    assert.ok(doc.content.includes("PPZ Plus 导入错误报告"));
    assert.ok(doc.content.includes("CSV"));
    assert.ok(doc.content.includes("data.csv"));
    assert.ok(doc.content.includes("test_db.users"));
    assert.ok(doc.content.includes("字段映射"));
    assert.ok(doc.content.includes("字段映射失败"));
    assert.ok(doc.content.includes("`id`"));
    assert.ok(doc.content.includes("（跳过）"));
  });

  test('阶段 execution 格式化为"执行"', () => {
    const useCase = new CreateImportErrorReportUseCase();
    const result = useCase.execute({
      formatName: "JSON",
      fileName: "data.json",
      targetName: "t",
      stage: "execution",
      errorMessage: "error",
    });

    assert.ok(result.content.includes("执行"));
  });

  test('阶段 preview 格式化为"预览"', () => {
    const useCase = new CreateImportErrorReportUseCase();
    const result = useCase.execute({
      formatName: "SQL",
      fileName: "data.sql",
      targetName: "t",
      stage: "preview",
      errorMessage: "error",
    });

    assert.ok(result.content.includes("预览"));
  });

  test("无 mappings 时显示默认提示", () => {
    const useCase = new CreateImportErrorReportUseCase();
    const result = useCase.execute({
      formatName: "CSV",
      fileName: "data.csv",
      targetName: "t",
      stage: "execution",
      errorMessage: "error",
    });

    assert.ok(result.content.includes("未提供字段映射"));
  });

  test("空 mappings 时显示默认提示", () => {
    const useCase = new CreateImportErrorReportUseCase();
    const result = useCase.execute({
      formatName: "CSV",
      fileName: "data.csv",
      targetName: "t",
      stage: "execution",
      errorMessage: "error",
      mappings: [],
    });

    assert.ok(result.content.includes("未提供字段映射"));
  });
});
