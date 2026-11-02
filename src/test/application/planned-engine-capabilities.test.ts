import * as assert from "assert";

import {
  COCKROACHDB_PLANNED_CAPABILITY_DECLARATION,
  MARIADB_PLANNED_CAPABILITY_DECLARATION,
} from "../../domain/capabilities/DatabaseCapabilityDeclaration";
import type { DatabaseEngine } from "../../domain/database/DatabaseEngine";
import { InMemoryDatabaseCapabilityCatalog } from "../../infrastructure/capabilities/InMemoryDatabaseCapabilityCatalog";
import { CheckSqlExportCapabilityUseCase } from "../../application/useCases/export/CheckSqlExportCapabilityUseCase";

suite("Application — 计划中引擎导出能力", () => {
  /**
   * 构建仅包含计划中引擎声明的导出能力检查用例。
   */
  function makeUseCase(): CheckSqlExportCapabilityUseCase {
    const catalog = new InMemoryDatabaseCapabilityCatalog([
      COCKROACHDB_PLANNED_CAPABILITY_DECLARATION,
      MARIADB_PLANNED_CAPABILITY_DECLARATION,
    ]);
    return new CheckSqlExportCapabilityUseCase(catalog);
  }

  /**
   * 断言一个计划中引擎的 DDL / DML / both 导出均判定为不支持。
   * @param engine 计划中接入的数据库引擎
   */
  function assertSqlExportUnsupported(engine: DatabaseEngine): void {
    const useCase = makeUseCase();

    for (const kind of ["ddl", "dml", "both"] as const) {
      const result = useCase.execute(engine, kind);
      assert.strictEqual(result.declarationFound, true, `${engine} 应存在能力声明`);
      assert.strictEqual(result.supported, false, `${engine} 的 ${kind} 导出不得被判定为支持`);
      assert.ok(
        result.requirements.every((requirement) => requirement.support === "planned"),
        `${engine} 的 ${kind} 导出要求项应全部为 planned`,
      );
    }
  }

  test("cockroachdb 的 DDL / DML / both 导出均判定为不支持", () => {
    assertSqlExportUnsupported("cockroachdb");
  });

  test("mariadb 的 DDL / DML / both 导出均判定为不支持", () => {
    assertSqlExportUnsupported("mariadb");
  });
});
