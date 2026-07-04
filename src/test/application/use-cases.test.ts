import * as assert from "assert";

import { InMemoryDatabaseCapabilityCatalog } from "../../infrastructure/capabilities/InMemoryDatabaseCapabilityCatalog";
import {
  MYSQL_MVP_CAPABILITY_DECLARATION,
  POSTGRESQL_TREE_CAPABILITY_DECLARATION,
} from "../../domain/capabilities/DatabaseCapabilityDeclaration";
import type { ConnectionRepository } from "../../application/connections/ConnectionRepository";
import type { ConnectionSyncStore } from "../../application/connections/ConnectionSyncStore";
import type { ConnectionTester } from "../../application/connections/ConnectionTester";
import type {
  ConnectionConfig,
  MysqlConnectionConfig,
  PostgreSqlConnectionConfig,
} from "../../domain/connections/ConnectionConfig";
import { ListStoredConnectionsUseCase } from "../../application/useCases/ListStoredConnectionsUseCase";
import { DeleteStoredConnectionUseCase } from "../../application/useCases/DeleteStoredConnectionUseCase";
import { SaveConnectionConfigUseCase } from "../../application/useCases/SaveConnectionConfigUseCase";
import { TestConnectionUseCase } from "../../application/useCases/TestConnectionUseCase";
import { ClearPpzStateUseCase } from "../../application/useCases/ClearPpzStateUseCase";
import { GetBootstrapStatusUseCase } from "../../application/useCases/GetBootstrapStatusUseCase";
import { CheckSqlExportCapabilityUseCase } from "../../application/useCases/CheckSqlExportCapabilityUseCase";
import { ExecuteMySqlSqlUseCase } from "../../application/useCases/ExecuteMySqlSqlUseCase";
import type { MySqlSqlExecutor } from "../../application/mysql/MySqlSqlExecutor";
import { ExecutePostgreSqlSqlUseCase } from "../../application/useCases/ExecutePostgreSqlSqlUseCase";
import { ExportPostgreSqlDatabaseUseCase } from "../../application/useCases/ExportPostgreSqlDatabaseUseCase";
import { ExportPostgreSqlSchemaUseCase } from "../../application/useCases/ExportPostgreSqlSchemaUseCase";
import { ExportPostgreSqlTableUseCase } from "../../application/useCases/ExportPostgreSqlTableUseCase";
import type { PostgreSqlExportProvider } from "../../application/postgresql/PostgreSqlExportProvider";
import type { PostgreSqlSqlExecutor } from "../../application/postgresql/PostgreSqlSqlExecutor";
import { ExportMySqlTableUseCase } from "../../application/useCases/ExportMySqlTableUseCase";
import { ExportMySqlSchemaUseCase } from "../../application/useCases/ExportMySqlSchemaUseCase";
import type { MySqlExportProvider } from "../../application/mysql/MySqlExportProvider";
import { SaveSqlExportDocumentUseCase } from "../../application/useCases/SaveSqlExportDocumentUseCase";
import type { SqlExportFileWriter } from "../../application/export/SqlExportFileWriter";
import type {
  SqlExportDocument,
  SqlExportTableTarget,
} from "../../domain/export/SqlExportDocument";
import { RecordSqlExportTaskLogUseCase } from "../../application/useCases/RecordSqlExportTaskLogUseCase";
import { ListSqlExportTaskLogsUseCase } from "../../application/useCases/ListSqlExportTaskLogsUseCase";
import type { SqlExportTaskLogRepository } from "../../application/export/SqlExportTaskLogRepository";
import type {
  SqlExportTaskLogEntry,
  SqlExportTaskLogInput,
} from "../../domain/export/SqlExportTaskLog";

/**
 * 构建测试用的 MySQL 参数连接配置。
 */
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

/**
 * 构建测试用的 PostgreSQL 参数连接配置。
 */
function makePostgreSqlConfig(
  overrides: Partial<PostgreSqlConnectionConfig> = {},
): PostgreSqlConnectionConfig {
  return {
    id: "test-pg-conn-1",
    name: "测试 PostgreSQL 连接",
    engine: "postgresql",
    mode: "parameters",
    host: "127.0.0.1",
    port: 5432,
    username: "postgres",
    database: "postgres",
    ...overrides,
  } as PostgreSqlConnectionConfig;
}

/**
 * 构建测试用的 SQL 导出文档。
 */
function makeSqlExportDocument(overrides: Partial<SqlExportDocument> = {}): SqlExportDocument {
  return {
    title: "test_table.ddl.sql",
    format: "sql",
    kind: "ddl",
    target: { schemaName: "test_db", tableName: "test_table" },
    content: "CREATE TABLE test_table (id INT PRIMARY KEY);\n",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// ConnectionRepository / ConnectionTester mock 工厂
// ---------------------------------------------------------------------------

function createMockConnectionRepository(saved: ConnectionConfig[] = []) {
  const state = [...saved];
  const deleteCalls: string[] = [];
  const saveCalls: ConnectionConfig[] = [];

  const repo: ConnectionRepository = {
    async list() {
      return [...state];
    },
    async find(id: string) {
      return state.find((c) => c.id === id);
    },
    async save(config) {
      saveCalls.push(config);
      const idx = state.findIndex((c) => c.id === config.id);
      if (idx === -1) {
        state.push(config);
      } else {
        state[idx] = config;
      }
    },
    async saveSynced(config) {
      saveCalls.push(config);
      const idx = state.findIndex((c) => c.id === config.id);
      if (idx === -1) {
        state.push(config);
      } else {
        state[idx] = config;
      }
    },
    async delete(id) {
      deleteCalls.push(id);
      const idx = state.findIndex((c) => c.id === id);
      if (idx !== -1) {
        state.splice(idx, 1);
      }
    },
    async clear() {
      state.splice(0, state.length);
    },
  };

  return {
    repo,
    get saved() {
      return state;
    },
    get deleteCalls() {
      return deleteCalls;
    },
    get saveCalls() {
      return saveCalls;
    },
  };
}

// ---------------------------------------------------------------------------
// 用例测试
// ---------------------------------------------------------------------------

suite("Application — ListStoredConnectionsUseCase", () => {
  test("返回 mock 仓储中的连接列表", async () => {
    const config = makeMysqlConfig();
    const { repo } = createMockConnectionRepository([config]);
    const useCase = new ListStoredConnectionsUseCase(repo);

    const result = await useCase.execute();

    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].id, config.id);
  });

  test("无连接时返回空列表", async () => {
    const { repo } = createMockConnectionRepository();
    const useCase = new ListStoredConnectionsUseCase(repo);

    const result = await useCase.execute();

    assert.strictEqual(result.length, 0);
  });
});

suite("Application — DeleteStoredConnectionUseCase", () => {
  test("根据 id 删除连接", async () => {
    const config = makeMysqlConfig();
    const { repo, deleteCalls, saved } = createMockConnectionRepository([config]);
    const useCase = new DeleteStoredConnectionUseCase(repo);

    await useCase.execute(config.id);

    assert.strictEqual(deleteCalls.length, 1);
    assert.strictEqual(deleteCalls[0], config.id);
    assert.strictEqual(saved.length, 0);
  });
});

suite("Application — SaveConnectionConfigUseCase", () => {
  test("保存连接配置", async () => {
    const { repo, saveCalls } = createMockConnectionRepository();
    const useCase = new SaveConnectionConfigUseCase(repo);
    const config = makeMysqlConfig();

    await useCase.execute(config);

    assert.strictEqual(saveCalls.length, 1);
    assert.strictEqual(saveCalls[0].id, config.id);
  });

  test("更新已有连接配置", async () => {
    const configV1 = makeMysqlConfig({ name: "原始" });
    const { repo, saved } = createMockConnectionRepository([configV1]);
    const useCase = new SaveConnectionConfigUseCase(repo);

    const configV2 = makeMysqlConfig({ name: "更新后" });
    await useCase.execute(configV2);

    assert.strictEqual(saved.length, 1);
    assert.strictEqual(saved[0].name, "更新后");
  });
});

suite("Application — TestConnectionUseCase", () => {
  test("调用 ConnectionTester.test", async () => {
    let calledWith: unknown = null;
    const tester: ConnectionTester = {
      async test(config) {
        calledWith = config;
      },
    };
    const useCase = new TestConnectionUseCase(tester);
    const config = makeMysqlConfig();

    await useCase.execute(config);

    assert.strictEqual(calledWith, config);
  });

  test("ConnectionTester 抛错时向上传播", async () => {
    const tester: ConnectionTester = {
      async test(_config) {
        throw new Error("连接超时");
      },
    };
    const useCase = new TestConnectionUseCase(tester);

    await assert.rejects(() => useCase.execute(makeMysqlConfig()), /连接超时/);
  });
});

suite("Application — ClearPpzStateUseCase", () => {
  test("清空连接配置和 SQL 导出任务日志", async () => {
    const config = makeMysqlConfig();
    const { repo, saved } = createMockConnectionRepository([config]);
    const logs: SqlExportTaskLogEntry[] = [
      {
        id: "log-1",
        engine: "mysql",
        connectionName: "测试连接",
        targetType: "table",
        targetName: "test_db.users",
        kind: "ddl",
        status: "success",
        startedAt: "2026-01-01T00:00:00Z",
        endedAt: "2026-01-01T00:00:01Z",
        durationMs: 1000,
      },
    ];
    const logRepository: SqlExportTaskLogRepository = {
      async append(entry) {
        logs.push(entry);
      },
      async listRecent() {
        return [...logs];
      },
      async clear() {
        logs.splice(0, logs.length);
      },
    };
    let syncStoreCleared = false;
    const connectionSyncStore: ConnectionSyncStore = {
      async read() {
        return undefined;
      },
      async write() {
        // 清空用例无需写入同步载荷。
      },
      async clear() {
        syncStoreCleared = true;
      },
    };
    const useCase = new ClearPpzStateUseCase(repo, logRepository, connectionSyncStore);

    await useCase.execute();

    assert.strictEqual(saved.length, 0);
    assert.strictEqual(logs.length, 0);
    assert.strictEqual(syncStoreCleared, true);
  });
});

suite("Application — GetBootstrapStatusUseCase", () => {
  test("MySQL MVP 启动状态", () => {
    const catalog = new InMemoryDatabaseCapabilityCatalog([
      MYSQL_MVP_CAPABILITY_DECLARATION,
      POSTGRESQL_TREE_CAPABILITY_DECLARATION,
    ]);
    const useCase = new GetBootstrapStatusUseCase(catalog);

    const status = useCase.execute();

    assert.strictEqual(status.focusEngine, "mysql");
    assert.ok(status.supportedCapabilities.includes("connectionManagement"));
    assert.ok(status.supportedCapabilities.includes("exportDdl"));
    assert.ok(status.supportedCapabilities.includes("exportDml"));
    assert.deepStrictEqual(status.plannedEngines, ["postgresql"]);
  });

  test("无 MySQL 声明时 supportedCapabilities 为空", () => {
    const catalog = new InMemoryDatabaseCapabilityCatalog([POSTGRESQL_TREE_CAPABILITY_DECLARATION]);
    const useCase = new GetBootstrapStatusUseCase(catalog);

    const status = useCase.execute();

    assert.strictEqual(status.supportedCapabilities.length, 0);
    assert.deepStrictEqual(status.plannedEngines, ["postgresql"]);
  });
});

suite("Application — CheckSqlExportCapabilityUseCase", () => {
  function createUseCase() {
    const catalog = new InMemoryDatabaseCapabilityCatalog([
      MYSQL_MVP_CAPABILITY_DECLARATION,
      POSTGRESQL_TREE_CAPABILITY_DECLARATION,
    ]);
    return new CheckSqlExportCapabilityUseCase(catalog);
  }

  test("MySQL + ddl 为 supported", () => {
    const useCase = createUseCase();
    const result = useCase.execute("mysql", "ddl");
    assert.strictEqual(result.supported, true);
    assert.strictEqual(result.engine, "mysql");
    assert.strictEqual(result.declarationFound, true);
    assert.strictEqual(result.requirements.length, 1);
    assert.strictEqual(result.requirements[0].key, "exportDdl");
    assert.strictEqual(result.requirements[0].support, "supported");
  });

  test("MySQL + dml 为 supported", () => {
    const useCase = createUseCase();
    const result = useCase.execute("mysql", "dml");
    assert.strictEqual(result.supported, true);
  });

  test("MySQL + both 为 supported", () => {
    const useCase = createUseCase();
    const result = useCase.execute("mysql", "both");
    assert.strictEqual(result.supported, true);
    assert.strictEqual(result.requirements.length, 2);
  });

  test("PostgreSQL + ddl 为 supported", () => {
    const useCase = createUseCase();
    const result = useCase.execute("postgresql", "ddl");
    assert.strictEqual(result.supported, true);
    assert.strictEqual(result.declarationFound, true);
    assert.strictEqual(result.requirements[0].support, "supported");
  });

  test("PostgreSQL + dml 为 supported", () => {
    const useCase = createUseCase();
    const result = useCase.execute("postgresql", "dml");
    assert.strictEqual(result.supported, true);
    assert.strictEqual(result.declarationFound, true);
    assert.strictEqual(result.requirements[0].key, "exportDml");
    assert.strictEqual(result.requirements[0].support, "supported");
  });

  test("PostgreSQL + both 为 supported", () => {
    const useCase = createUseCase();
    const result = useCase.execute("postgresql", "both");
    assert.strictEqual(result.supported, true);
    assert.strictEqual(result.requirements.length, 2);
  });

  test("不存在的 engine declarationFound 为 false", () => {
    const useCase = createUseCase();
    const result = useCase.execute("mssql", "ddl");
    assert.strictEqual(result.declarationFound, false);
    assert.strictEqual(result.supported, false);
  });
});

suite("Application — ExecuteMySqlSqlUseCase", () => {
  function createMockExecutor(): MySqlSqlExecutor & { executedSqls: string[] } {
    return {
      executedSqls: [],
      async executeSql(_connection, sql) {
        this.executedSqls.push(sql);
        return {
          sql,
          success: true,
          isQuery: true,
          fields: [{ name: "id" }],
          rows: [{ id: 1 }],
          affectedRows: null,
          durationMs: 12,
          resultSets: [],
        };
      },
    };
  }

  test("空 SQL 返回错误结果，不调 executor", async () => {
    const executor = createMockExecutor();
    const useCase = new ExecuteMySqlSqlUseCase(executor);

    const result = await useCase.execute(makeMysqlConfig(), "   ");

    assert.strictEqual(result.success, false);
    assert.ok(result.errorMessage);
    assert.strictEqual(executor.executedSqls.length, 0);
  });

  test("正常 SQL 透传到 executor", async () => {
    const executor = createMockExecutor();
    const useCase = new ExecuteMySqlSqlUseCase(executor);
    const config = makeMysqlConfig();

    const result = await useCase.execute(config, "SELECT 1");

    assert.strictEqual(result.success, true);
    assert.strictEqual(executor.executedSqls.length, 1);
    assert.strictEqual(executor.executedSqls[0], "SELECT 1");
  });
});

suite("Application — ExecutePostgreSqlSqlUseCase", () => {
  function createMockExecutor(): PostgreSqlSqlExecutor & {
    executedSqls: string[];
    databaseNames: (string | undefined)[];
  } {
    return {
      executedSqls: [],
      databaseNames: [],
      async executeSql(_connection, databaseName, sql) {
        this.executedSqls.push(sql);
        this.databaseNames.push(databaseName);
        return {
          sql,
          success: true,
          isQuery: true,
          fields: [{ name: "id" }],
          rows: [{ id: 1 }],
          affectedRows: null,
          durationMs: 12,
          resultSets: [],
        };
      },
    };
  }

  test("空 SQL 返回错误结果，不调 executor", async () => {
    const executor = createMockExecutor();
    const useCase = new ExecutePostgreSqlSqlUseCase(executor);

    const result = await useCase.execute(makePostgreSqlConfig(), "postgres", "   ");

    assert.strictEqual(result.success, false);
    assert.ok(result.errorMessage);
    assert.strictEqual(executor.executedSqls.length, 0);
  });

  test("正常 SQL 透传到 executor 并归一化 database", async () => {
    const executor = createMockExecutor();
    const useCase = new ExecutePostgreSqlSqlUseCase(executor);
    const config = makePostgreSqlConfig();

    const result = await useCase.execute(config, " app_db ", "SELECT 1");

    assert.strictEqual(result.success, true);
    assert.strictEqual(executor.executedSqls.length, 1);
    assert.strictEqual(executor.executedSqls[0], "SELECT 1");
    assert.strictEqual(executor.databaseNames[0], "app_db");
  });
});

suite("Application — ExportMySqlTableUseCase", () => {
  function createMockProvider(): MySqlExportProvider {
    return {
      async exportTable(_conn, target, kind) {
        return {
          title: `${target.schemaName}.${target.tableName}.${kind}.sql`,
          format: "sql",
          kind,
          target,
          content: "-- export content",
        };
      },
      async exportSchema(_conn, target, kind) {
        return {
          title: `${target.schemaName}.${kind}.sql`,
          format: "sql",
          kind,
          target,
          content: "-- schema export",
        };
      },
    };
  }

  test("空 schemaName 抛错", async () => {
    const useCase = new ExportMySqlTableUseCase(createMockProvider());

    await assert.rejects(
      () => useCase.execute(makeMysqlConfig(), { schemaName: "  ", tableName: "t" }, "ddl"),
      /需要提供 schema 名称/,
    );
  });

  test("空 tableName 抛错", async () => {
    const useCase = new ExportMySqlTableUseCase(createMockProvider());

    await assert.rejects(
      () => useCase.execute(makeMysqlConfig(), { schemaName: "db", tableName: "" }, "ddl"),
      /需要提供表名/,
    );
  });

  test("有效参数返回导出文档", async () => {
    const useCase = new ExportMySqlTableUseCase(createMockProvider());

    const doc = await useCase.execute(
      makeMysqlConfig(),
      { schemaName: "test_db", tableName: "users" },
      "dml",
    );

    assert.strictEqual(doc.kind, "dml");
    assert.strictEqual("schemaName" in doc.target, true);
    if ("schemaName" in doc.target) {
      assert.strictEqual(doc.target.schemaName, "test_db");
    }
    if ("tableName" in doc.target) {
      assert.strictEqual((doc.target as SqlExportTableTarget).tableName, "users");
    }
  });
});

suite("Application — ExportMySqlSchemaUseCase", () => {
  function createMockProvider(): MySqlExportProvider {
    return {
      async exportTable() {
        throw new Error("不应调用");
      },
      async exportSchema(_conn, target, kind) {
        return {
          title: `${target.schemaName}.${kind}.sql`,
          format: "sql",
          kind,
          target,
          content: "-- schema export",
        };
      },
    };
  }

  test("空 schemaName 抛错", async () => {
    const useCase = new ExportMySqlSchemaUseCase(createMockProvider());

    await assert.rejects(
      () => useCase.execute(makeMysqlConfig(), { schemaName: "  " }, "ddl"),
      /需要提供 schema 名称/,
    );
  });

  test("有效参数返回导出文档", async () => {
    const useCase = new ExportMySqlSchemaUseCase(createMockProvider());

    const doc = await useCase.execute(makeMysqlConfig(), { schemaName: "test_db" }, "ddl");

    assert.strictEqual(doc.kind, "ddl");
    assert.strictEqual("schemaName" in doc.target, true);
    if ("schemaName" in doc.target) {
      assert.strictEqual(doc.target.schemaName, "test_db");
    }
  });
});

suite("Application — ExportPostgreSqlTableUseCase", () => {
  function createMockProvider(): PostgreSqlExportProvider {
    return {
      async exportTable(_conn, target, kind) {
        return {
          title: `${target.databaseName}.${target.schemaName}.${target.tableName}.${kind}.sql`,
          format: "sql",
          kind,
          target,
          content: "-- pg table dml",
        };
      },
      async exportSchema(_conn, target, kind) {
        return {
          title: `${target.databaseName}.${target.schemaName}.${kind}.sql`,
          format: "sql",
          kind,
          target,
          content: "-- pg schema dml",
        };
      },
      async exportDatabase(_conn, target, kind) {
        return {
          title: `${target.databaseName}.${kind}.sql`,
          format: "sql",
          kind,
          target,
          content: "-- pg database dml",
        };
      },
    };
  }

  test("有效参数返回 DDL 文档", async () => {
    const useCase = new ExportPostgreSqlTableUseCase(createMockProvider());

    const doc = await useCase.execute(
      makePostgreSqlConfig(),
      { databaseName: "app", schemaName: "public", tableName: "users" },
      "ddl",
    );

    assert.strictEqual(doc.kind, "ddl");
  });

  test("空 databaseName 抛错", async () => {
    const useCase = new ExportPostgreSqlTableUseCase(createMockProvider());

    await assert.rejects(
      () =>
        useCase.execute(
          makePostgreSqlConfig(),
          { databaseName: " ", schemaName: "public", tableName: "users" },
          "dml",
        ),
      /需要提供 database 名称/,
    );
  });

  test("有效参数返回 DML 文档", async () => {
    const useCase = new ExportPostgreSqlTableUseCase(createMockProvider());

    const doc = await useCase.execute(
      makePostgreSqlConfig(),
      { databaseName: "app", schemaName: "public", tableName: "users" },
      "dml",
    );

    assert.strictEqual(doc.kind, "dml");
    assert.strictEqual("schemaName" in doc.target, true);
    if ("schemaName" in doc.target) {
      assert.strictEqual(doc.target.schemaName, "public");
    }
  });
});

suite("Application — ExportPostgreSqlSchemaUseCase", () => {
  function createMockProvider(): PostgreSqlExportProvider {
    return {
      async exportTable() {
        throw new Error("不应调用");
      },
      async exportSchema(_conn, target, kind) {
        return {
          title: `${target.databaseName}.${target.schemaName}.${kind}.sql`,
          format: "sql",
          kind,
          target,
          content: "-- pg schema dml",
        };
      },
      async exportDatabase(_conn, target, kind) {
        return {
          title: `${target.databaseName}.${kind}.sql`,
          format: "sql",
          kind,
          target,
          content: "-- pg database dml",
        };
      },
    };
  }

  test("有效参数返回 DDL + DML 文档", async () => {
    const useCase = new ExportPostgreSqlSchemaUseCase(createMockProvider());

    const doc = await useCase.execute(
      makePostgreSqlConfig(),
      { databaseName: "app", schemaName: "public" },
      "both",
    );

    assert.strictEqual(doc.kind, "both");
  });

  test("空 schemaName 抛错", async () => {
    const useCase = new ExportPostgreSqlSchemaUseCase(createMockProvider());

    await assert.rejects(
      () =>
        useCase.execute(makePostgreSqlConfig(), { databaseName: "app", schemaName: " " }, "dml"),
      /需要提供 schema 名称/,
    );
  });

  test("有效参数返回 DML 文档", async () => {
    const useCase = new ExportPostgreSqlSchemaUseCase(createMockProvider());

    const doc = await useCase.execute(
      makePostgreSqlConfig(),
      { databaseName: "app", schemaName: "public" },
      "dml",
    );

    assert.strictEqual(doc.kind, "dml");
    assert.strictEqual("schemaName" in doc.target, true);
    if ("schemaName" in doc.target) {
      assert.strictEqual(doc.target.schemaName, "public");
    }
  });
});

suite("Application — ExportPostgreSqlDatabaseUseCase", () => {
  function createMockProvider(): PostgreSqlExportProvider {
    return {
      async exportTable() {
        throw new Error("不应调用");
      },
      async exportSchema() {
        throw new Error("不应调用");
      },
      async exportDatabase(_conn, target, kind) {
        return {
          title: `${target.databaseName}.${kind}.sql`,
          format: "sql",
          kind,
          target,
          content: "-- pg database dml",
        };
      },
    };
  }

  test("有效参数返回 DDL + DML 文档", async () => {
    const useCase = new ExportPostgreSqlDatabaseUseCase(createMockProvider());

    const doc = await useCase.execute(makePostgreSqlConfig(), { databaseName: "app" }, "both");

    assert.strictEqual(doc.kind, "both");
  });

  test("空 databaseName 抛错", async () => {
    const useCase = new ExportPostgreSqlDatabaseUseCase(createMockProvider());

    await assert.rejects(
      () => useCase.execute(makePostgreSqlConfig(), { databaseName: " " }, "dml"),
      /需要提供 database 名称/,
    );
  });

  test("有效参数返回 DML 文档", async () => {
    const useCase = new ExportPostgreSqlDatabaseUseCase(createMockProvider());

    const doc = await useCase.execute(makePostgreSqlConfig(), { databaseName: "app" }, "dml");

    assert.strictEqual(doc.kind, "dml");
    assert.strictEqual("databaseName" in doc.target, true);
  });
});

suite("Application — SaveSqlExportDocumentUseCase", () => {
  function createMockWriter(): SqlExportFileWriter & {
    writtenFiles: { path: string; content: string }[];
  } {
    return {
      writtenFiles: [],
      async writeText(filePath, content) {
        this.writtenFiles.push({ path: filePath, content });
      },
    };
  }

  test("空文件路径返回失败", async () => {
    const writer = createMockWriter();
    const useCase = new SaveSqlExportDocumentUseCase(writer);

    const result = await useCase.execute(makeSqlExportDocument(), "  ");

    assert.strictEqual(result.success, false);
    assert.ok(result.errorMessage?.includes("文件路径"));
  });

  test("空导出内容返回失败", async () => {
    const writer = createMockWriter();
    const useCase = new SaveSqlExportDocumentUseCase(writer);

    const result = await useCase.execute(
      makeSqlExportDocument({ content: "  " }),
      "/tmp/export.sql",
    );

    assert.strictEqual(result.success, false);
    assert.ok(result.errorMessage?.includes("空"));
  });

  test("正常文档写入成功", async () => {
    const writer = createMockWriter();
    const useCase = new SaveSqlExportDocumentUseCase(writer);

    const result = await useCase.execute(makeSqlExportDocument(), "/tmp/export.sql");

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.filePath, "/tmp/export.sql");
    assert.strictEqual(writer.writtenFiles.length, 1);
  });

  test("writer 抛错时返回失败", async () => {
    const writer: SqlExportFileWriter = {
      async writeText() {
        throw new Error("磁盘已满");
      },
    };
    const useCase = new SaveSqlExportDocumentUseCase(writer);

    const result = await useCase.execute(makeSqlExportDocument(), "/tmp/export.sql");

    assert.strictEqual(result.success, false);
    assert.ok(result.errorMessage?.includes("磁盘已满"));
  });
});

suite("Application — RecordSqlExportTaskLogUseCase", () => {
  test("记录并返回带有 UUID 的完整日志", async () => {
    const appended: SqlExportTaskLogEntry[] = [];
    const repo: SqlExportTaskLogRepository = {
      async append(entry) {
        appended.push(entry);
      },
      async listRecent() {
        return [...appended];
      },
      async clear() {
        appended.splice(0, appended.length);
      },
    };
    const useCase = new RecordSqlExportTaskLogUseCase(repo);

    const input: SqlExportTaskLogInput = {
      engine: "mysql",
      connectionName: "测试连接",
      targetType: "table",
      targetName: "test_db.users",
      kind: "ddl",
      status: "success",
      startedAt: "2026-01-01T00:00:00Z",
      endedAt: "2026-01-01T00:00:01Z",
      durationMs: 1000,
      filePath: "/tmp/users.ddl.sql",
    };

    const entry = await useCase.execute(input);

    assert.ok(entry.id);
    assert.strictEqual(typeof entry.id, "string");
    assert.ok(entry.id.length > 0);
    assert.strictEqual(entry.engine, "mysql");
    assert.strictEqual(entry.status, "success");
    assert.strictEqual(appended.length, 1);
  });
});

suite("Application — ListSqlExportTaskLogsUseCase", () => {
  test("返回仓储中的日志列表", async () => {
    const saved: SqlExportTaskLogEntry[] = [
      {
        id: "log-1",
        engine: "mysql",
        connectionName: "test",
        targetType: "table",
        targetName: "db.t1",
        kind: "ddl",
        status: "success",
        startedAt: "2026-01-01T00:00:00Z",
        endedAt: "2026-01-01T00:00:01Z",
        durationMs: 1000,
      },
    ];
    const repo: SqlExportTaskLogRepository = {
      async append() {},
      async listRecent() {
        return [...saved];
      },
      async clear() {
        saved.splice(0, saved.length);
      },
    };
    const useCase = new ListSqlExportTaskLogsUseCase(repo);

    const result = await useCase.execute();

    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].id, "log-1");
  });

  test("无日志时返回空列表", async () => {
    const repo: SqlExportTaskLogRepository = {
      async append() {},
      async listRecent() {
        return [];
      },
      async clear() {},
    };
    const useCase = new ListSqlExportTaskLogsUseCase(repo);

    const result = await useCase.execute();

    assert.strictEqual(result.length, 0);
  });
});
