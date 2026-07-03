import * as assert from "assert";

import {
  COCKROACHDB_PLANNED_CAPABILITY_DECLARATION,
  DATABASE_CAPABILITY_KEYS,
  MARIADB_PLANNED_CAPABILITY_DECLARATION,
  MSSQL_PLANNED_CAPABILITY_DECLARATION,
} from "../../domain/capabilities/DatabaseCapabilityDeclaration";
import type { DatabaseCapabilityDeclaration } from "../../domain/capabilities/DatabaseCapabilityDeclaration";
import type {
  CockroachDbConnectionConfig,
  MariaDbConnectionConfig,
  MssqlConnectionConfig,
} from "../../domain/connections/ConnectionConfig";
import { DATABASE_ENGINES } from "../../domain/database/DatabaseEngine";

suite("Domain — 计划中数据库引擎", () => {
  test("DATABASE_ENGINES 覆盖三种新增引擎", () => {
    assert.ok(DATABASE_ENGINES.includes("mssql"));
    assert.ok(DATABASE_ENGINES.includes("cockroachdb"));
    assert.ok(DATABASE_ENGINES.includes("mariadb"));
  });

  test("MSSQL 参数配置携带 encrypt / trustServerCertificate", () => {
    const config: MssqlConnectionConfig = {
      id: "mssql-1",
      name: "MSSQL 连接",
      engine: "mssql",
      mode: "parameters",
      host: "127.0.0.1",
      port: 1433,
      username: "sa",
      encrypt: true,
      trustServerCertificate: false,
    };

    assert.strictEqual(config.engine, "mssql");
    assert.strictEqual(config.encrypt, true);
    assert.strictEqual(config.trustServerCertificate, false);
  });

  test("CockroachDB 参数配置携带 ssl", () => {
    const config: CockroachDbConnectionConfig = {
      id: "crdb-1",
      name: "CockroachDB 连接",
      engine: "cockroachdb",
      mode: "parameters",
      host: "127.0.0.1",
      port: 26257,
      username: "root",
      ssl: true,
    };

    assert.strictEqual(config.engine, "cockroachdb");
    assert.strictEqual(config.ssl, true);
  });

  test("MariaDB URL 配置约束", () => {
    const config: MariaDbConnectionConfig = {
      id: "maria-1",
      name: "MariaDB 连接",
      engine: "mariadb",
      mode: "url",
      url: "mysql://root@127.0.0.1:3306/mysql",
    };

    assert.strictEqual(config.engine, "mariadb");
    assert.strictEqual(config.mode, "url");
  });
});

suite("Domain — 计划中能力声明", () => {
  /**
   * 收集本阶段需要保持 planned 的能力声明。
   */
  const plannedDeclarations: readonly DatabaseCapabilityDeclaration[] = [
    MSSQL_PLANNED_CAPABILITY_DECLARATION,
    COCKROACHDB_PLANNED_CAPABILITY_DECLARATION,
    MARIADB_PLANNED_CAPABILITY_DECLARATION,
  ];

  for (const declaration of plannedDeclarations) {
    test(`${declaration.engine} 所有能力均为 planned，不得误开放为 supported`, () => {
      for (const key of DATABASE_CAPABILITY_KEYS) {
        assert.strictEqual(
          declaration.capabilities[key],
          "planned",
          `${declaration.engine}.${key} 期望为 planned，实际为 ${declaration.capabilities[key]}`,
        );
      }
    });

    test(`${declaration.engine} 能力矩阵键完整`, () => {
      assert.strictEqual(
        Object.keys(declaration.capabilities).length,
        DATABASE_CAPABILITY_KEYS.length,
      );
    });
  }
});
