import * as assert from "assert";

import type {
  MysqlConnectionConfig,
  PostgreSqlConnectionConfig,
  Sqlite3ConnectionConfig,
} from "../../domain/connections/ConnectionConfig";
import type {
  DatabaseConnectionTreeNode,
  MySqlSchemaTreeNode,
  MySqlTableTreeNode,
  PostgreSqlDatabaseTreeNode,
  Sqlite3TableTreeNode,
} from "../../presentation/explorer/DatabaseConnectionsTreeNode";
import {
  resolveMySqlSqlTerminalInitialConnection,
  resolveMySqlSqlTerminalInitialSql,
} from "../../presentation/commands/OpenMySqlSqlTerminalCommand";

suite("Presentation — MySQL SQL 终端命令", () => {
  test("schema 节点生成 USE 语句", () => {
    const node: MySqlSchemaTreeNode = {
      kind: "schema",
      connection: makeMysqlConnection(),
      schemaName: "study_java",
    };

    assert.strictEqual(resolveMySqlSqlTerminalInitialSql(node), "USE `study_java`;\n\n");
  });

  test("table 节点生成不可直接误执行的 ALTER 模板", () => {
    const node: MySqlTableTreeNode = {
      kind: "table",
      connection: makeMysqlConnection(),
      schemaName: "study_java",
      tableName: "study_java_sys_user",
    };

    assert.strictEqual(
      resolveMySqlSqlTerminalInitialSql(node),
      [
        "USE `study_java`;",
        "",
        "ALTER TABLE `study_java_sys_user`",
        "  -- MODIFY COLUMN `<column_name>` VARCHAR(255) NULL;",
      ].join("\n"),
    );
  });

  test("schema 和 table 名称中的反引号会被转义", () => {
    const node: MySqlTableTreeNode = {
      kind: "table",
      connection: makeMysqlConnection(),
      schemaName: "a`b",
      tableName: "c`d",
    };

    assert.strictEqual(
      resolveMySqlSqlTerminalInitialSql(node),
      [
        "USE `a``b`;",
        "",
        "ALTER TABLE `c``d`",
        "  -- MODIFY COLUMN `<column_name>` VARCHAR(255) NULL;",
      ].join("\n"),
    );
  });

  test("MySQL 连接节点和空节点不生成初始 SQL", () => {
    const node: DatabaseConnectionTreeNode = {
      kind: "connection",
      connection: makeMysqlConnection(),
    };

    assert.strictEqual(resolveMySqlSqlTerminalInitialSql(node), undefined);
    assert.strictEqual(resolveMySqlSqlTerminalInitialSql(), undefined);
  });

  test("非 MySQL 节点不生成初始 SQL", () => {
    const postgreSqlNode: PostgreSqlDatabaseTreeNode = {
      kind: "postgresqlDatabase",
      connection: makePostgreSqlConnection(),
      databaseName: "postgres",
      isDefault: true,
    };
    const sqlite3Node: Sqlite3TableTreeNode = {
      kind: "sqlite3Table",
      connection: makeSqlite3Connection(),
      schemaName: "main",
      tableName: "users",
      tableType: "table",
    };

    assert.strictEqual(resolveMySqlSqlTerminalInitialSql(postgreSqlNode), undefined);
    assert.strictEqual(resolveMySqlSqlTerminalInitialSql(sqlite3Node), undefined);
  });

  test("只从 MySQL 节点解析初始连接", () => {
    const mysqlConnection = makeMysqlConnection();
    const mysqlNode: MySqlSchemaTreeNode = {
      kind: "schema",
      connection: mysqlConnection,
      schemaName: "study_java",
    };
    const postgreSqlNode: PostgreSqlDatabaseTreeNode = {
      kind: "postgresqlDatabase",
      connection: makePostgreSqlConnection(),
      databaseName: "postgres",
      isDefault: true,
    };

    assert.strictEqual(resolveMySqlSqlTerminalInitialConnection(mysqlNode), mysqlConnection);
    assert.strictEqual(resolveMySqlSqlTerminalInitialConnection(postgreSqlNode), undefined);
    assert.strictEqual(resolveMySqlSqlTerminalInitialConnection(), undefined);
  });
});

/**
 * 创建测试用 MySQL 连接。
 *
 * @returns {MysqlConnectionConfig} MySQL 参数连接配置。
 */
function makeMysqlConnection(): MysqlConnectionConfig {
  return {
    id: "mysql-1",
    name: "MySQL",
    engine: "mysql",
    mode: "parameters",
    host: "127.0.0.1",
    port: 3306,
    username: "root",
  };
}

/**
 * 创建测试用 PostgreSQL 连接。
 *
 * @returns {PostgreSqlConnectionConfig} PostgreSQL 参数连接配置。
 */
function makePostgreSqlConnection(): PostgreSqlConnectionConfig {
  return {
    id: "pg-1",
    name: "PostgreSQL",
    engine: "postgresql",
    mode: "parameters",
    host: "127.0.0.1",
    port: 5432,
    username: "postgres",
  };
}

/**
 * 创建测试用 SQLite3 连接。
 *
 * @returns {Sqlite3ConnectionConfig} SQLite3 文件连接配置。
 */
function makeSqlite3Connection(): Sqlite3ConnectionConfig {
  return {
    id: "sqlite-1",
    name: "SQLite3",
    engine: "sqlite3",
    mode: "file",
    dbPath: "/tmp/test.db",
  };
}
