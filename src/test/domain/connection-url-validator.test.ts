import * as assert from "assert";

import {
  validateConnectionUrlForEngine,
  validateMssqlUrl,
  validateMysqlUrl,
  validatePostgreSqlUrl,
} from "../../domain/connections/ConnectionUrlValidator";

suite("Domain — 连接 URL 校验", () => {
  test("MySQL URL 合法时通过", () => {
    assert.strictEqual(validateMysqlUrl("mysql://root:pw@127.0.0.1:3306/db"), undefined);
  });

  test("MySQL URL 协议不符时报错", () => {
    assert.strictEqual(
      validateMysqlUrl("postgresql://root@127.0.0.1:5432/db"),
      "URL 必须以 mysql:// 开头。",
    );
  });

  test("MySQL URL 无法解析时报错", () => {
    assert.strictEqual(validateMysqlUrl("not a url"), "请输入有效的 mysql:// URL。");
  });

  test("MSSQL URL 合法时通过", () => {
    assert.strictEqual(validateMssqlUrl("mssql://sa:pw@127.0.0.1:1433/master"), undefined);
  });

  test("MSSQL URL 协议不符时报错", () => {
    assert.strictEqual(
      validateMssqlUrl("mysql://sa@127.0.0.1:1433/master"),
      "URL 必须以 mssql:// 开头。",
    );
  });

  test("PostgreSQL URL 接受 postgresql:// 与 postgres://", () => {
    assert.strictEqual(validatePostgreSqlUrl("postgresql://p@127.0.0.1:5432/db"), undefined);
    assert.strictEqual(validatePostgreSqlUrl("postgres://p@127.0.0.1:5432/db"), undefined);
  });

  test("PostgreSQL URL 协议不符时报错", () => {
    assert.strictEqual(
      validatePostgreSqlUrl("mysql://p@127.0.0.1:5432/db"),
      "URL 必须以 postgresql:// 或 postgres:// 开头。",
    );
  });

  test("前后空白被裁剪后仍可通过", () => {
    assert.strictEqual(validateMysqlUrl("  mysql://root@127.0.0.1:3306/db  "), undefined);
  });
});

suite("Domain — 按引擎选择 URL 校验", () => {
  test("mysql / mariadb 走 MySQL 校验", () => {
    assert.strictEqual(
      validateConnectionUrlForEngine("mysql", "mysql://root@h:3306/db"),
      undefined,
    );
    assert.strictEqual(
      validateConnectionUrlForEngine("mariadb", "mysql://root@h:3306/db"),
      undefined,
    );
    assert.strictEqual(
      validateConnectionUrlForEngine("mariadb", "postgres://root@h:5432/db"),
      "URL 必须以 mysql:// 开头。",
    );
  });

  test("postgresql / cockroachdb 走 PostgreSQL 校验", () => {
    assert.strictEqual(
      validateConnectionUrlForEngine("postgresql", "postgresql://p@h:5432/db"),
      undefined,
    );
    assert.strictEqual(
      validateConnectionUrlForEngine("cockroachdb", "postgresql://root@h:26257/defaultdb"),
      undefined,
    );
    assert.strictEqual(
      validateConnectionUrlForEngine("cockroachdb", "mysql://root@h:3306/db"),
      "URL 必须以 postgresql:// 或 postgres:// 开头。",
    );
  });

  test("mssql 走 MSSQL 校验", () => {
    assert.strictEqual(
      validateConnectionUrlForEngine("mssql", "mssql://sa@h:1433/master"),
      undefined,
    );
    assert.strictEqual(
      validateConnectionUrlForEngine("mssql", "mysql://sa@h:1433/master"),
      "URL 必须以 mssql:// 开头。",
    );
  });
});
