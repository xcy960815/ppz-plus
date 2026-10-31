import type {
  MssqlExportDatabaseTarget,
  MssqlExportProvider as MssqlExportProviderContract,
  MssqlExportSchemaTarget,
  MssqlExportTableTarget,
} from "../../application/mssql/MssqlExportProvider";
import type { MssqlConnectionConfig } from "../../domain/connections/ConnectionConfig";
import type {
  SqlExportDocument,
  SqlExportKind,
  SqlExportTableTarget,
} from "../../domain/export/SqlExportDocument";
import { formatSqlExportFileName } from "../../domain/export/SqlExportFileName";
import { SQL_EXPORT_FORMAT } from "../../domain/export/SqlExportFormat";
import { stringifyObjectValue } from "../shared/stringifyObjectValue";
import { MssqlConnectionAdapter } from "./MssqlConnectionAdapter";
import { MssqlRuntimeLoader } from "./MssqlRuntimeLoader";
import type { MssqlDriverOptions, MssqlRuntimeConnectionPool } from "./MssqlRuntimeTypes";

/**
 * 描述 MSSQL 字段 DDL 元数据。
 */
interface MssqlColumnDdlDefinition {
  readonly columnName: string;
  readonly dataType: string;
  readonly maxLength: number | null;
  readonly precision: number | null;
  readonly scale: number | null;
  readonly isNullable: boolean;
  readonly defaultExpression: string | null;
  readonly isIdentity: boolean;
  readonly identitySeed: number | null;
  readonly identityIncrement: number | null;
  readonly computedDefinition: string | null;
}

/**
 * 描述 MSSQL 主键约束 DDL 元数据。
 */
interface MssqlPrimaryKeyDefinition {
  readonly constraintName: string;
  readonly columns: readonly { readonly name: string; readonly isDescending: boolean }[];
}

/**
 * 描述 MSSQL 索引 DDL 元数据。
 */
interface MssqlIndexDefinition {
  readonly indexName: string;
  readonly isUnique: boolean;
  readonly indexKind: string;
  readonly columns: readonly { readonly name: string; readonly isDescending: boolean }[];
}

/**
 * 描述 MSSQL 外键约束 DDL 元数据。
 */
interface MssqlForeignKeyDefinition {
  readonly fkName: string;
  readonly columns: readonly string[];
  readonly refSchemaName: string;
  readonly refTableName: string;
  readonly refColumns: readonly string[];
}

/**
 * 通过 mssql 驱动生成 MSSQL DDL/DML。
 */
export class MssqlExportProvider implements MssqlExportProviderContract {
  /**
   * 创建基于 mssql 的导出提供者。
   *
   * @param mssqlConnectionAdapter 用于归一化连接选项的适配器。
   * @param mssqlRuntimeLoader 用于延迟解析 mssql 运行时的加载器。
   */
  public constructor(
    private readonly mssqlConnectionAdapter: MssqlConnectionAdapter,
    private readonly mssqlRuntimeLoader: MssqlRuntimeLoader,
  ) {}

  /**
   * 导出指定 MSSQL 表的 SQL 文档。
   *
   * @param {MssqlConnectionConfig} connection MSSQL 连接配置。
   * @param {MssqlExportTableTarget} target 表级导出目标。
   * @param {SqlExportKind} kind 导出的 SQL 内容类型。
   * @returns {Promise<SqlExportDocument>} 生成后的 SQL 导出文档。
   */
  public async exportTable(
    connection: MssqlConnectionConfig,
    target: MssqlExportTableTarget,
    kind: SqlExportKind,
  ): Promise<SqlExportDocument> {
    const pool = await this.openPool(connection, target.databaseName);

    try {
      const blocks: string[] = [this.renderTableHeader(connection.name, target, kind)];

      if (kind === "ddl" || kind === "both") {
        blocks.push(this.renderCreateSchemaStatement(target.schemaName));
        blocks.push(await this.exportDdl(pool, target, { includeForeignKeys: true }));
      }

      if (kind === "dml" || kind === "both") {
        blocks.push(await this.exportDml(pool, target));
      }

      blocks.push(this.renderFooter());

      return {
        title: formatSqlExportFileName(
          [target.databaseName, target.schemaName, target.tableName],
          kind,
        ),
        format: SQL_EXPORT_FORMAT.id,
        kind,
        target,
        content: `${blocks.join("\n\n")}\n`,
      };
    } finally {
      await this.closePool(pool);
    }
  }

  /**
   * 导出指定 MSSQL schema 的 SQL 文档。
   *
   * @param {MssqlConnectionConfig} connection MSSQL 连接配置。
   * @param {MssqlExportSchemaTarget} target schema 级导出目标。
   * @param {SqlExportKind} kind 导出的 SQL 内容类型。
   * @returns {Promise<SqlExportDocument>} 生成后的 SQL 导出文档。
   */
  public async exportSchema(
    connection: MssqlConnectionConfig,
    target: MssqlExportSchemaTarget,
    kind: SqlExportKind,
  ): Promise<SqlExportDocument> {
    const pool = await this.openPool(connection, target.databaseName);

    try {
      const tableTargets = (await this.listSchemaTables(pool, target.schemaName)).map(
        (tableName) => ({
          databaseName: target.databaseName,
          schemaName: target.schemaName,
          tableName,
        }),
      );
      const blocks: string[] = [this.renderSchemaHeader(connection.name, target, kind)];

      if (kind === "ddl" || kind === "both") {
        blocks.push(this.renderCreateSchemaStatement(target.schemaName));
      }

      if (tableTargets.length === 0) {
        blocks.push(`-- ${target.databaseName}.${target.schemaName} 中未找到基础表。`);
      }

      for (const tableTarget of tableTargets) {
        blocks.push(
          await this.exportTableBlock(pool, tableTarget, kind, { includeForeignKeys: false }),
        );
      }

      if ((kind === "ddl" || kind === "both") && tableTargets.length > 0) {
        const foreignKeyBlock = await this.exportForeignKeysBlock(pool, tableTargets);
        if (foreignKeyBlock.length > 0) {
          blocks.push(foreignKeyBlock);
        }
      }

      blocks.push(this.renderFooter());

      return {
        title: formatSqlExportFileName([target.databaseName, target.schemaName], kind),
        format: SQL_EXPORT_FORMAT.id,
        kind,
        target,
        content: `${blocks.join("\n\n")}\n`,
      };
    } finally {
      await this.closePool(pool);
    }
  }

  /**
   * 导出指定 MSSQL database 的 SQL 文档。
   *
   * @param {MssqlConnectionConfig} connection MSSQL 连接配置。
   * @param {MssqlExportDatabaseTarget} target database 级导出目标。
   * @param {SqlExportKind} kind 导出的 SQL 内容类型。
   * @returns {Promise<SqlExportDocument>} 生成后的 SQL 导出文档。
   */
  public async exportDatabase(
    connection: MssqlConnectionConfig,
    target: MssqlExportDatabaseTarget,
    kind: SqlExportKind,
  ): Promise<SqlExportDocument> {
    const pool = await this.openPool(connection, target.databaseName);

    try {
      const tableTargets = await this.listDatabaseTables(pool, target.databaseName);
      const blocks: string[] = [this.renderDatabaseHeader(connection.name, target, kind)];

      if (kind === "ddl" || kind === "both") {
        const schemaNames = await this.listDatabaseSchemas(pool);
        if (schemaNames.length === 0) {
          blocks.push(`-- ${target.databaseName} 中未找到可导出的 schema。`);
        }

        blocks.push(
          ...schemaNames.map((schemaName) => this.renderCreateSchemaStatement(schemaName)),
        );
      }

      if (tableTargets.length === 0) {
        blocks.push(`-- ${target.databaseName} 中未找到基础表。`);
      }

      for (const tableTarget of tableTargets) {
        blocks.push(
          await this.exportTableBlock(pool, tableTarget, kind, { includeForeignKeys: false }),
        );
      }

      if ((kind === "ddl" || kind === "both") && tableTargets.length > 0) {
        const foreignKeyBlock = await this.exportForeignKeysBlock(pool, tableTargets);
        if (foreignKeyBlock.length > 0) {
          blocks.push(foreignKeyBlock);
        }
      }

      blocks.push(this.renderFooter());

      return {
        title: formatSqlExportFileName([target.databaseName], kind),
        format: SQL_EXPORT_FORMAT.id,
        kind,
        target,
        content: `${blocks.join("\n\n")}\n`,
      };
    } finally {
      await this.closePool(pool);
    }
  }

  /**
   * 打开指向目标 database 的连接池。
   *
   * @param {MssqlConnectionConfig} connection MSSQL 连接配置。
   * @param {string} databaseName 需要连接的目标 database。
   * @returns {Promise<MssqlRuntimeConnectionPool>} 已连接的连接池。
   */
  private async openPool(
    connection: MssqlConnectionConfig,
    databaseName: string,
  ): Promise<MssqlRuntimeConnectionPool> {
    const baseOptions = this.mssqlConnectionAdapter.resolveDriverOptions(connection);
    const options: MssqlDriverOptions = { ...baseOptions, database: databaseName };
    const mssql = await this.mssqlRuntimeLoader.loadMssqlModule();
    const pool = new mssql.ConnectionPool(options);
    await pool.connect();
    return pool;
  }

  /**
   * 关闭连接池，关闭失败不覆盖主要导出结果。
   *
   * @param {MssqlRuntimeConnectionPool} pool 需要关闭的连接池。
   */
  private async closePool(pool: MssqlRuntimeConnectionPool): Promise<void> {
    try {
      await pool.close();
    } catch {
      /**
       * 导出内容生成结果优先，关闭失败不覆盖主要结果。
       */
    }
  }

  /**
   * 通过命名参数在连接池上执行查询。
   *
   * @param {MssqlRuntimeConnectionPool} pool 当前可用的连接池。
   * @param {string} sql 含 @p1..@pN 占位符的查询。
   * @param {readonly unknown[]} values 与占位符对应的参数值。
   * @returns {Promise<ReadonlyArray<Record<string, unknown>>>} 查询返回的行集合。
   */
  private async runPoolQuery(
    pool: MssqlRuntimeConnectionPool,
    sql: string,
    values: readonly unknown[],
  ): Promise<ReadonlyArray<Record<string, unknown>>> {
    const request = pool.request();
    values.forEach((value, index) => {
      request.input(`p${index + 1}`, value);
    });
    const result = await request.query(sql);
    return result.recordset ?? [];
  }

  /**
   * 生成表级导出文档头部注释。
   *
   * @param {string} connectionName 当前连接显示名。
   * @param {MssqlExportTableTarget} target 表级导出目标。
   * @param {SqlExportKind} kind 导出的 SQL 内容类型。
   * @returns {string} SQL 注释头。
   */
  private renderTableHeader(
    connectionName: string,
    target: MssqlExportTableTarget,
    kind: SqlExportKind,
  ): string {
    return [
      `-- PPZ Plus MSSQL ${kind.toUpperCase()} export`,
      `-- Connection: ${connectionName}`,
      `-- Database: ${target.databaseName}`,
      `-- Table: ${this.renderQualifiedTableLabel(target)}`,
    ].join("\n");
  }

  /**
   * 生成 schema 级导出文档头部注释。
   *
   * @param {string} connectionName 当前连接显示名。
   * @param {MssqlExportSchemaTarget} target schema 级导出目标。
   * @param {SqlExportKind} kind 导出的 SQL 内容类型。
   * @returns {string} SQL 注释头。
   */
  private renderSchemaHeader(
    connectionName: string,
    target: MssqlExportSchemaTarget,
    kind: SqlExportKind,
  ): string {
    return [
      `-- PPZ Plus MSSQL ${kind.toUpperCase()} export`,
      `-- Connection: ${connectionName}`,
      `-- Database: ${target.databaseName}`,
      `-- Schema: ${target.schemaName}`,
    ].join("\n");
  }

  /**
   * 生成 database 级导出文档头部注释。
   *
   * @param {string} connectionName 当前连接显示名。
   * @param {MssqlExportDatabaseTarget} target database 级导出目标。
   * @param {SqlExportKind} kind 导出的 SQL 内容类型。
   * @returns {string} SQL 注释头。
   */
  private renderDatabaseHeader(
    connectionName: string,
    target: MssqlExportDatabaseTarget,
    kind: SqlExportKind,
  ): string {
    return [
      `-- PPZ Plus MSSQL ${kind.toUpperCase()} export`,
      `-- Connection: ${connectionName}`,
      `-- Database: ${target.databaseName}`,
    ].join("\n");
  }

  /**
   * 生成导出文件尾部注释。
   *
   * @returns {string} 导出文件尾部 SQL。
   */
  private renderFooter(): string {
    return "-- PPZ Plus MSSQL export completed.";
  }

  /**
   * 生成 MSSQL schema 创建语句。
   *
   * CREATE SCHEMA 必须位于批次首位，因此通过 EXEC 包裹保证可执行性。
   *
   * @param {string} schemaName schema 名称。
   * @returns {string} 条件创建 schema 的 SQL。
   */
  private renderCreateSchemaStatement(schemaName: string): string {
    const literal = schemaName.replaceAll("'", "''");
    return `IF SCHEMA_ID(N'${literal}') IS NULL EXEC(N'CREATE SCHEMA ${this.escapeIdentifier(schemaName)};');`;
  }

  /**
   * 生成单表导出 SQL 块。
   *
   * @param {MssqlRuntimeConnectionPool} pool 当前可用的连接池。
   * @param {MssqlExportTableTarget} target 表级导出目标。
   * @param {SqlExportKind} kind 导出的 SQL 内容类型。
   * @param {{ readonly includeForeignKeys: boolean }} options DDL 块组织选项。
   * @returns {Promise<string>} 单表 SQL 文本块。
   */
  private async exportTableBlock(
    pool: MssqlRuntimeConnectionPool,
    target: MssqlExportTableTarget,
    kind: SqlExportKind,
    options: { readonly includeForeignKeys: boolean },
  ): Promise<string> {
    const blocks = [`-- Table: ${this.renderQualifiedTableLabel(target)}`];

    if (kind === "ddl" || kind === "both") {
      blocks.push(await this.exportDdl(pool, target, options));
    }

    if (kind === "dml" || kind === "both") {
      blocks.push(await this.exportDml(pool, target));
    }

    return blocks.join("\n\n");
  }

  /**
   * 列出 schema 下可导出的基础表。
   *
   * @param {MssqlRuntimeConnectionPool} pool 当前可用的连接池。
   * @param {string} schemaName schema 名称。
   * @returns {Promise<readonly string[]>} 表名列表。
   */
  private async listSchemaTables(
    pool: MssqlRuntimeConnectionPool,
    schemaName: string,
  ): Promise<readonly string[]> {
    const rows = await this.runPoolQuery(
      pool,
      [
        "SELECT t.name AS name",
        "FROM sys.tables AS t",
        "INNER JOIN sys.schemas AS s ON s.schema_id = t.schema_id",
        "WHERE s.name = @p1",
        "ORDER BY t.name",
      ].join(" "),
      [schemaName],
    );

    return rows.map((row) => row.name).filter((name): name is string => typeof name === "string");
  }

  /**
   * 列出 database 下所有可导出的用户 schema。
   *
   * @param {MssqlRuntimeConnectionPool} pool 当前可用的连接池。
   * @returns {Promise<readonly string[]>} 按名称排序的 schema 名称列表。
   */
  private async listDatabaseSchemas(pool: MssqlRuntimeConnectionPool): Promise<readonly string[]> {
    const rows = await this.runPoolQuery(
      pool,
      [
        "SELECT name AS name",
        "FROM sys.schemas",
        "WHERE name NOT IN ('sys', 'INFORMATION_SCHEMA', 'guest')",
        "AND name NOT LIKE 'db[_]%'",
        "ORDER BY name",
      ].join(" "),
      [],
    );

    return rows.map((row) => row.name).filter((name): name is string => typeof name === "string");
  }

  /**
   * 列出 database 下所有可导出的基础表。
   *
   * @param {MssqlRuntimeConnectionPool} pool 当前可用的连接池。
   * @returns {Promise<readonly SqlExportTableTarget[]>} 按 schema/table 排序的表目标列表。
   */
  private async listDatabaseTables(
    pool: MssqlRuntimeConnectionPool,
    databaseName: string,
  ): Promise<readonly MssqlExportTableTarget[]> {
    const rows = await this.runPoolQuery(
      pool,
      [
        "SELECT s.name AS schemaName, t.name AS tableName",
        "FROM sys.tables AS t",
        "INNER JOIN sys.schemas AS s ON s.schema_id = t.schema_id",
        "WHERE s.name NOT IN ('sys', 'INFORMATION_SCHEMA', 'guest')",
        "AND s.name NOT LIKE 'db[_]%'",
        "ORDER BY s.name, t.name",
      ].join(" "),
      [],
    );

    return rows
      .map((row) => {
        const schemaName = row.schemaName;
        const tableName = row.tableName;

        return typeof schemaName === "string" && typeof tableName === "string"
          ? { databaseName, schemaName, tableName }
          : undefined;
      })
      .filter((table): table is MssqlExportTableTarget => table !== undefined);
  }

  /**
   * 导出指定表的 DDL。
   *
   * @param {MssqlRuntimeConnectionPool} pool 当前可用的连接池。
   * @param {MssqlExportTableTarget} target 表级导出目标。
   * @param {{ readonly includeForeignKeys: boolean }} options DDL 块组织选项。
   * @returns {Promise<string>} DDL SQL 文本。
   */
  private async exportDdl(
    pool: MssqlRuntimeConnectionPool,
    target: MssqlExportTableTarget,
    options: { readonly includeForeignKeys: boolean },
  ): Promise<string> {
    const columns = await this.listColumns(pool, target);
    const primaryKey = await this.listPrimaryKey(pool, target);
    const indexes = await this.listIndexes(pool, target);
    const blocks = [this.renderCreateTableStatement(target, columns, primaryKey)];

    if (indexes.length > 0) {
      blocks.push(indexes.map((index) => this.renderIndexStatement(target, index)).join("\n"));
    }

    if (options.includeForeignKeys) {
      const foreignKeys = await this.listForeignKeys(pool, target);
      if (foreignKeys.length > 0) {
        blocks.push(foreignKeyStatements(target, foreignKeys));
      }
    }

    return blocks.join("\n\n");
  }

  /**
   * 读取 MSSQL 表字段 DDL 元数据。
   *
   * @param {MssqlRuntimeConnectionPool} pool 当前可用的连接池。
   * @param {MssqlExportTableTarget} target 表级导出目标。
   * @returns {Promise<readonly MssqlColumnDdlDefinition[]>} 字段定义列表。
   */
  private async listColumns(
    pool: MssqlRuntimeConnectionPool,
    target: MssqlExportTableTarget,
  ): Promise<readonly MssqlColumnDdlDefinition[]> {
    const rows = await this.runPoolQuery(
      pool,
      [
        "SELECT c.name AS columnName,",
        "ty.name AS dataType,",
        "c.max_length AS maxLength,",
        "c.precision AS precision,",
        "c.scale AS scale,",
        "c.is_nullable AS isNullable,",
        "dc.definition AS defaultExpression,",
        "ic.seed_value AS seedValue,",
        "ic.increment_value AS incrementValue,",
        "cc.definition AS computedDefinition,",
        "COLUMNPROPERTY(c.object_id, c.name, 'IsIdentity') AS isIdentity",
        "FROM sys.columns AS c",
        "INNER JOIN sys.types AS ty ON ty.user_type_id = c.user_type_id",
        "LEFT JOIN sys.default_constraints AS dc",
        "ON dc.parent_object_id = c.object_id AND dc.parent_column_id = c.column_id",
        "LEFT JOIN sys.identity_columns AS ic",
        "ON ic.object_id = c.object_id AND ic.column_id = c.column_id",
        "LEFT JOIN sys.computed_columns AS cc",
        "ON cc.object_id = c.object_id AND cc.column_id = c.column_id",
        "WHERE c.object_id = OBJECT_ID(@p1)",
        "ORDER BY c.column_id",
      ].join(" "),
      [this.renderQualifiedObjectLiteral(target)],
    );

    return rows
      .map(normalizeColumnRow)
      .filter((column): column is MssqlColumnDdlDefinition => column !== undefined);
  }

  /**
   * 读取 MSSQL 表主键约束。
   *
   * @param {MssqlRuntimeConnectionPool} pool 当前可用的连接池。
   * @param {MssqlExportTableTarget} target 表级导出目标。
   * @returns {Promise<MssqlPrimaryKeyDefinition | undefined>} 主键约束定义；无主键时为空。
   */
  private async listPrimaryKey(
    pool: MssqlRuntimeConnectionPool,
    target: MssqlExportTableTarget,
  ): Promise<MssqlPrimaryKeyDefinition | undefined> {
    const rows = await this.runPoolQuery(
      pool,
      [
        "SELECT kc.name AS constraintName,",
        "col.name AS columnName,",
        "ic.is_descending_key AS isDescendingKey",
        "FROM sys.key_constraints AS kc",
        "INNER JOIN sys.index_columns AS ic",
        "ON ic.object_id = kc.parent_object_id AND ic.index_id = kc.unique_index_id",
        "INNER JOIN sys.columns AS col",
        "ON col.object_id = ic.object_id AND col.column_id = ic.column_id",
        "WHERE kc.type = 'PK' AND kc.parent_object_id = OBJECT_ID(@p1)",
        "ORDER BY ic.key_ordinal",
      ].join(" "),
      [this.renderQualifiedObjectLiteral(target)],
    );

    const constraintName = rows[0]?.constraintName;
    if (typeof constraintName !== "string") {
      return undefined;
    }

    return {
      constraintName,
      columns: rows
        .map((row) => {
          const columnName = row.columnName;
          if (typeof columnName !== "string") {
            return undefined;
          }
          return { name: columnName, isDescending: row.isDescendingKey === true };
        })
        .filter(
          (column): column is { readonly name: string; readonly isDescending: boolean } =>
            column !== undefined,
        ),
    };
  }

  /**
   * 读取 MSSQL 表普通索引（排除主键与唯一约束索引）。
   *
   * @param {MssqlRuntimeConnectionPool} pool 当前可用的连接池。
   * @param {MssqlExportTableTarget} target 表级导出目标。
   * @returns {Promise<readonly MssqlIndexDefinition[]>} 索引定义列表。
   */
  private async listIndexes(
    pool: MssqlRuntimeConnectionPool,
    target: MssqlExportTableTarget,
  ): Promise<readonly MssqlIndexDefinition[]> {
    const rows = await this.runPoolQuery(
      pool,
      [
        "SELECT i.name AS indexName,",
        "i.is_unique AS isUnique,",
        "i.type_desc AS indexKind,",
        "col.name AS columnName,",
        "ic.is_descending_key AS isDescendingKey",
        "FROM sys.indexes AS i",
        "INNER JOIN sys.index_columns AS ic",
        "ON ic.object_id = i.object_id AND ic.index_id = i.index_id AND ic.key_ordinal > 0",
        "INNER JOIN sys.columns AS col",
        "ON col.object_id = ic.object_id AND col.column_id = ic.column_id",
        "WHERE i.object_id = OBJECT_ID(@p1)",
        "AND i.is_primary_key = 0 AND i.is_unique_constraint = 0 AND i.is_disabled = 0",
        "AND i.type IN (1, 2)",
        "ORDER BY i.name, ic.key_ordinal",
      ].join(" "),
      [this.renderQualifiedObjectLiteral(target)],
    );

    return groupIndexRows(rows);
  }

  /**
   * 读取 MSSQL 表外键约束。
   *
   * @param {MssqlRuntimeConnectionPool} pool 当前可用的连接池。
   * @param {MssqlExportTableTarget} target 表级导出目标。
   * @returns {Promise<readonly MssqlForeignKeyDefinition[]>} 外键约束定义列表。
   */
  private async listForeignKeys(
    pool: MssqlRuntimeConnectionPool,
    target: MssqlExportTableTarget,
  ): Promise<readonly MssqlForeignKeyDefinition[]> {
    const rows = await this.runPoolQuery(
      pool,
      [
        "SELECT fk.name AS fkName,",
        "col.name AS columnName,",
        "rs.name AS refSchemaName,",
        "rt.name AS refTableName,",
        "rcol.name AS refColumnName,",
        "fkc.constraint_column_id AS columnOrdinal",
        "FROM sys.foreign_keys AS fk",
        "INNER JOIN sys.foreign_key_columns AS fkc ON fkc.constraint_object_id = fk.object_id",
        "INNER JOIN sys.tables AS rt ON rt.object_id = fk.referenced_object_id",
        "INNER JOIN sys.schemas AS rs ON rs.schema_id = rt.schema_id",
        "INNER JOIN sys.columns AS col",
        "ON col.object_id = fkc.parent_object_id AND col.column_id = fkc.parent_column_id",
        "INNER JOIN sys.columns AS rcol",
        "ON rcol.object_id = fkc.referenced_object_id AND rcol.column_id = fkc.referenced_column_id",
        "WHERE fk.parent_object_id = OBJECT_ID(@p1)",
        "ORDER BY fk.name, fkc.constraint_column_id",
      ].join(" "),
      [this.renderQualifiedObjectLiteral(target)],
    );

    return groupForeignKeyRows(rows);
  }

  /**
   * 生成聚合导出中所有表的外键块。
   *
   * @param {MssqlRuntimeConnectionPool} pool 当前可用的连接池。
   * @param {readonly MssqlExportTableTarget[]} tableTargets 本次导出的表目标列表。
   * @returns {Promise<string>} 外键 SQL 文本块；无外键时为空字符串。
   */
  private async exportForeignKeysBlock(
    pool: MssqlRuntimeConnectionPool,
    tableTargets: readonly MssqlExportTableTarget[],
  ): Promise<string> {
    const seenFkNames = new Set<string>();
    const statements: string[] = [];

    for (const target of tableTargets) {
      const foreignKeys = await this.listForeignKeys(pool, target);
      for (const foreignKey of foreignKeys) {
        if (seenFkNames.has(foreignKey.fkName)) {
          continue;
        }
        seenFkNames.add(foreignKey.fkName);
        statements.push(foreignKeyStatement(target, foreignKey));
      }
    }

    return statements.join("\n");
  }

  /**
   * 生成 MSSQL 建表语句。
   *
   * @param {MssqlExportTableTarget} target 表级导出目标。
   * @param {readonly MssqlColumnDdlDefinition[]} columns 字段定义列表。
   * @param {MssqlPrimaryKeyDefinition | undefined} primaryKey 主键约束定义。
   * @returns {string} CREATE TABLE SQL 文本。
   */
  private renderCreateTableStatement(
    target: MssqlExportTableTarget,
    columns: readonly MssqlColumnDdlDefinition[],
    primaryKey: MssqlPrimaryKeyDefinition | undefined,
  ): string {
    if (columns.length === 0) {
      throw new Error(
        `MSSQL 未返回 ${target.databaseName}.${this.renderQualifiedTableLabel(target)} 的字段定义。`,
      );
    }

    const tableElements = [
      ...columns.map((column) => this.renderColumnDdlDefinition(column)),
      ...(primaryKey ? [renderPrimaryKeyConstraint(primaryKey)] : []),
    ];
    const qualifiedTable = this.escapeQualifiedTableName(target);

    return [
      `IF OBJECT_ID(N'${this.renderQualifiedObjectLiteral(target)}', N'U') IS NULL`,
      "BEGIN",
      `CREATE TABLE ${qualifiedTable} (`,
      `${tableElements.map((element) => `\t${element}`).join(",\n")}`,
      ");",
      "END;",
    ].join("\n");
  }

  /**
   * 生成单个字段 DDL 定义。
   *
   * @param {MssqlColumnDdlDefinition} column 字段 DDL 元数据。
   * @returns {string} 字段定义 SQL 片段。
   */
  private renderColumnDdlDefinition(column: MssqlColumnDdlDefinition): string {
    const name = this.escapeIdentifier(column.columnName);

    if (column.computedDefinition !== null) {
      return `${name} AS ${column.computedDefinition}`;
    }

    const fragments = [name, this.renderDdlType(column)];

    if (column.isIdentity) {
      const seed = column.identitySeed ?? 1;
      const increment = column.identityIncrement ?? 1;
      fragments.push(`IDENTITY(${seed}, ${increment})`);
    }

    fragments.push(column.isNullable ? "NULL" : "NOT NULL");

    if (!column.isIdentity && column.defaultExpression !== null) {
      fragments.push(`DEFAULT ${column.defaultExpression}`);
    }

    return fragments.join(" ");
  }

  /**
   * 生成字段 DDL 使用的完整类型文本。
   *
   * @param {MssqlColumnDdlDefinition} column 字段 DDL 元数据。
   * @returns {string} 可写回 CREATE TABLE 的类型文本。
   */
  private renderDdlType(column: MssqlColumnDdlDefinition): string {
    const { dataType, maxLength, precision, scale } = column;

    if (dataType === "nvarchar" || dataType === "nchar") {
      return `${dataType}(${maxLength === null || maxLength < 0 ? "MAX" : maxLength / 2})`;
    }
    if (dataType === "varchar" || dataType === "char" || dataType === "varbinary") {
      return `${dataType}(${maxLength === null || maxLength < 0 ? "MAX" : maxLength})`;
    }
    if (dataType === "decimal" || dataType === "numeric") {
      return `${dataType}(${precision ?? 18}, ${scale ?? 0})`;
    }
    if (dataType === "datetime2" || dataType === "datetimeoffset" || dataType === "time") {
      return `${dataType}(${scale ?? 7})`;
    }
    if (dataType === "float") {
      return "FLOAT";
    }
    return dataType.toUpperCase();
  }

  /**
   * 生成索引创建语句。
   *
   * @param {MssqlExportTableTarget} target 表级导出目标。
   * @param {MssqlIndexDefinition} index 索引 DDL 元数据。
   * @returns {string} 条件创建索引的 SQL。
   */
  private renderIndexStatement(
    target: MssqlExportTableTarget,
    index: MssqlIndexDefinition,
  ): string {
    const uniqueness = index.isUnique ? "UNIQUE " : "";
    const kind = index.indexKind === "CLUSTERED" ? "CLUSTERED" : "NONCLUSTERED";
    const columns = index.columns
      .map(
        (column) => `${this.escapeIdentifier(column.name)} ${column.isDescending ? "DESC" : "ASC"}`,
      )
      .join(", ");
    return [
      `IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = N'${index.indexName.replaceAll("'", "''")}'`,
      `AND object_id = OBJECT_ID(N'${this.renderQualifiedObjectLiteral(target)}'))`,
      `CREATE ${uniqueness}${kind} INDEX ${this.escapeIdentifier(index.indexName)}`,
      `ON ${this.escapeQualifiedTableName(target)} (${columns});`,
    ].join(" ");
  }

  /**
   * 导出指定表的 DML。
   *
   * @param {MssqlRuntimeConnectionPool} pool 当前可用的连接池。
   * @param {MssqlExportTableTarget} target 表级导出目标。
   * @returns {Promise<string>} DML SQL 文本。
   */
  private async exportDml(
    pool: MssqlRuntimeConnectionPool,
    target: MssqlExportTableTarget,
  ): Promise<string> {
    const rows = await this.runPoolQuery(
      pool,
      `SELECT * FROM ${this.escapeQualifiedTableName(target)}`,
      [],
    );

    if (rows.length === 0) {
      return `-- ${this.renderQualifiedTableLabel(target)} 中未找到数据。`;
    }

    const columnNames = Object.keys(rows[0]);
    const inserts = rows
      .map((row) => this.renderInsertStatement(target, columnNames, row))
      .join("\n");

    if (!(await this.checkIdentityColumns(pool, target, columnNames))) {
      return inserts;
    }

    const qualifiedTable = this.escapeQualifiedTableName(target);
    return [
      `SET IDENTITY_INSERT ${qualifiedTable} ON;`,
      inserts,
      `SET IDENTITY_INSERT ${qualifiedTable} OFF;`,
    ].join("\n");
  }

  /**
   * 查询表是否包含 identity 字段。
   *
   * @param {MssqlRuntimeConnectionPool} pool 当前可用的连接池。
   * @param {MssqlExportTableTarget} target 表级导出目标。
   * @param {readonly string[]} columnNames 表字段名列表。
   * @returns {boolean} 包含 identity 字段时返回 true。
   */
  private async checkIdentityColumns(
    pool: MssqlRuntimeConnectionPool,
    target: MssqlExportTableTarget,
    columnNames: readonly string[],
  ): Promise<boolean> {
    if (columnNames.length === 0) {
      return false;
    }

    const conditions = columnNames.map((_, index) => `name = @p${index + 2}`).join(" OR ");
    const rows = await this.runPoolQuery(
      pool,
      [
        "SELECT COUNT(*) AS identityCount",
        "FROM sys.identity_columns",
        "WHERE object_id = OBJECT_ID(@p1)",
        `AND (${conditions})`,
      ].join(" "),
      [this.renderQualifiedObjectLiteral(target), ...columnNames],
    );

    return readCount(rows);
  }

  /**
   * 渲染单行 INSERT 语句。
   *
   * @param {MssqlExportTableTarget} target 表级导出目标。
   * @param {readonly string[]} columnNames 字段名列表。
   * @param {Record<string, unknown>} row 驱动返回的原始行。
   * @returns {string} INSERT SQL 文本。
   */
  private renderInsertStatement(
    target: MssqlExportTableTarget,
    columnNames: readonly string[],
    row: Record<string, unknown>,
  ): string {
    const columnsSql = columnNames
      .map((columnName) => this.escapeIdentifier(columnName))
      .join(", ");
    const valuesSql = columnNames
      .map((columnName) => this.formatSqlValue(row[columnName]))
      .join(", ");

    return `INSERT INTO ${this.escapeQualifiedTableName(target)} (${columnsSql}) VALUES (${valuesSql});`;
  }

  /**
   * 将 JavaScript 值格式化为 MSSQL 字面量。
   *
   * @param {unknown} value 原始字段值。
   * @returns {string} MSSQL SQL 字面量。
   */
  private formatSqlValue(value: unknown): string {
    if (value === null || value === undefined) {
      return "NULL";
    }

    if (typeof value === "number") {
      return Number.isFinite(value) ? String(value) : "NULL";
    }

    if (typeof value === "bigint") {
      return value.toString();
    }

    if (typeof value === "boolean") {
      return value ? "1" : "0";
    }

    if (value instanceof Date) {
      return `'${formatDateLiteral(value)}'`;
    }

    if (Buffer.isBuffer(value)) {
      return `0x${value.toString("hex")}`;
    }

    if (typeof value === "string") {
      return `N'${value.replaceAll("'", "''")}'`;
    }

    if (typeof value === "object") {
      return `N'${stringifyObjectValue(value).replaceAll("'", "''")}'`;
    }

    return `N'${String(value).replaceAll("'", "''")}'`;
  }

  /**
   * 转义 MSSQL 标识符。
   *
   * @param {string} identifier 待转义的标识符。
   * @returns {string} 转义后的括号标识符。
   */
  private escapeIdentifier(identifier: string): string {
    return `[${identifier.replaceAll("]", "]]")}]`;
  }

  /**
   * 转义完整 schema.table 引用。
   *
   * @param {SqlExportTableTarget} target 表级导出目标。
   * @returns {string} 转义后的完整表名。
   */
  private escapeQualifiedTableName(target: SqlExportTableTarget): string {
    return `${this.escapeIdentifier(target.schemaName)}.${this.escapeIdentifier(target.tableName)}`;
  }

  /**
   * 渲染 OBJECT_ID / 日志使用的 schema.table 字面量。
   *
   * @param {SqlExportTableTarget} target 表级导出目标。
   * @returns {string} 未转义引号的 schema.table 文本。
   */
  private renderQualifiedObjectLiteral(target: SqlExportTableTarget): string {
    return `${target.schemaName}.${target.tableName}`;
  }

  /**
   * 渲染日志和注释中使用的完整表名。
   *
   * @param {SqlExportTableTarget} target 表级导出目标。
   * @returns {string} 可读的 schema.table 标签。
   */
  private renderQualifiedTableLabel(target: SqlExportTableTarget): string {
    return `${target.schemaName}.${target.tableName}`;
  }
}

/**
 * 生成外键 ALTER TABLE 语句。
 *
 * @param {SqlExportTableTarget} target 外键所在的表目标。
 * @param {MssqlForeignKeyDefinition} foreignKey 外键约束定义。
 * @returns {string} ALTER TABLE ADD CONSTRAINT SQL。
 */
function foreignKeyStatement(
  target: SqlExportTableTarget,
  foreignKey: MssqlForeignKeyDefinition,
): string {
  const bracket = (value: string): string => `[${value.replaceAll("]", "]]")}]`;
  return [
    `ALTER TABLE ${bracket(target.schemaName)}.${bracket(target.tableName)}`,
    `ADD CONSTRAINT ${bracket(foreignKey.fkName)}`,
    `FOREIGN KEY (${foreignKey.columns.map(bracket).join(", ")})`,
    `REFERENCES ${bracket(foreignKey.refSchemaName)}.${bracket(foreignKey.refTableName)} (${foreignKey.refColumns.map(bracket).join(", ")});`,
  ].join(" ");
}

/**
 * 将外键查询行按约束名分组。
 *
 * @param {readonly Record<string, unknown>[]} rows 外键查询原始行。
 * @returns {readonly MssqlForeignKeyDefinition[]} 分组后的外键定义列表。
 */
function groupForeignKeyRows(
  rows: readonly Record<string, unknown>[],
): readonly MssqlForeignKeyDefinition[] {
  const grouped = new Map<
    string,
    {
      columns: string[];
      refSchemaName: string;
      refTableName: string;
      refColumns: string[];
      maxOrdinal: number;
    }
  >();

  for (const row of rows) {
    const fkName = row.fkName;
    const columnName = row.columnName;
    const refSchemaName = row.refSchemaName;
    const refTableName = row.refTableName;
    const refColumnName = row.refColumnName;
    const columnOrdinal = row.columnOrdinal;

    if (
      typeof fkName !== "string" ||
      typeof columnName !== "string" ||
      typeof refSchemaName !== "string" ||
      typeof refTableName !== "string" ||
      typeof refColumnName !== "string" ||
      typeof columnOrdinal !== "number"
    ) {
      continue;
    }

    const entry = grouped.get(fkName) ?? {
      columns: [],
      refSchemaName,
      refTableName,
      refColumns: [],
      maxOrdinal: 0,
    };
    entry.columns.push(columnName);
    entry.refColumns.push(refColumnName);
    entry.maxOrdinal = Math.max(entry.maxOrdinal, columnOrdinal);
    grouped.set(fkName, entry);
  }

  return Array.from(grouped.entries()).map(([fkName, entry]) => ({
    fkName,
    columns: entry.columns,
    refSchemaName: entry.refSchemaName,
    refTableName: entry.refTableName,
    refColumns: entry.refColumns,
  }));
}

/**
 * 将索引查询行按索引名分组。
 *
 * @param {readonly Record<string, unknown>[]} rows 索引查询原始行。
 * @returns {readonly MssqlIndexDefinition[]} 分组后的索引定义列表。
 */
function groupIndexRows(rows: readonly Record<string, unknown>[]): readonly MssqlIndexDefinition[] {
  const grouped = new Map<
    string,
    {
      isUnique: boolean;
      indexKind: string;
      columns: { name: string; isDescending: boolean }[];
    }
  >();

  for (const row of rows) {
    const indexName = row.indexName;
    const columnName = row.columnName;

    if (typeof indexName !== "string" || typeof columnName !== "string") {
      continue;
    }

    const entry = grouped.get(indexName) ?? {
      isUnique: row.isUnique === true,
      indexKind: typeof row.indexKind === "string" ? row.indexKind : "NONCLUSTERED",
      columns: [],
    };
    entry.columns.push({ name: columnName, isDescending: row.isDescendingKey === true });
    grouped.set(indexName, entry);
  }

  return Array.from(grouped.entries()).map(([indexName, entry]) => ({
    indexName,
    isUnique: entry.isUnique,
    indexKind: entry.indexKind,
    columns: entry.columns,
  }));
}

/**
 * 生成主键表内约束。
 *
 * @param {MssqlPrimaryKeyDefinition} primaryKey 主键约束定义。
 * @returns {string} 表内 PRIMARY KEY 约束 SQL 片段。
 */
function renderPrimaryKeyConstraint(primaryKey: MssqlPrimaryKeyDefinition): string {
  const bracket = (value: string): string => `[${value.replaceAll("]", "]]")}]`;
  const columns = primaryKey.columns
    .map((column) => `${bracket(column.name)} ${column.isDescending ? "DESC" : "ASC"}`)
    .join(", ");
  return `CONSTRAINT ${bracket(primaryKey.constraintName)} PRIMARY KEY CLUSTERED (${columns})`;
}

/**
 * 生成外键 ALTER TABLE 语句（供类内引用的独立函数版本）。
 *
 * @param {SqlExportTableTarget} target 外键所在的表目标。
 * @param {readonly MssqlForeignKeyDefinition} foreignKeys 外键约束列表。
 * @returns {string} 多条 ALTER TABLE SQL。
 */
function foreignKeyStatements(
  target: SqlExportTableTarget,
  foreignKeys: readonly MssqlForeignKeyDefinition[],
): string {
  return foreignKeys.map((foreignKey) => foreignKeyStatement(target, foreignKey)).join("\n");
}

/**
 * 格式化日期字面量为 SQL Server 可解析的本地时间文本。
 *
 * @param {Date} value 原始 Date 值。
 * @returns {string} `YYYY-MM-DD HH:MM:SS.mmm` 文本。
 */
function formatDateLiteral(value: Date): string {
  const pad = (part: number, width: number): string => part.toString().padStart(width, "0");
  return [
    pad(value.getFullYear(), 4),
    "-",
    pad(value.getMonth() + 1, 2),
    "-",
    pad(value.getDate(), 2),
    " ",
    pad(value.getHours(), 2),
    ":",
    pad(value.getMinutes(), 2),
    ":",
    pad(value.getSeconds(), 2),
    ".",
    pad(value.getMilliseconds(), 3),
  ].join("");
}

/**
 * 将字段 DDL 查询行归一化为字段定义。
 *
 * @param {Record<string, unknown>} row 驱动查询返回的原始行。
 * @returns {MssqlColumnDdlDefinition | undefined} 字段定义；无法识别时为空。
 */
function normalizeColumnRow(row: Record<string, unknown>): MssqlColumnDdlDefinition | undefined {
  const columnName = row.columnName;
  const dataType = row.dataType;

  if (typeof columnName !== "string" || typeof dataType !== "string") {
    return undefined;
  }

  return {
    columnName,
    dataType,
    maxLength: readNumberOrNull(row.maxLength),
    precision: readNumberOrNull(row.precision),
    scale: readNumberOrNull(row.scale),
    isNullable: row.isNullable === true || row.isNullable === 1,
    defaultExpression: typeof row.defaultExpression === "string" ? row.defaultExpression : null,
    isIdentity: row.isIdentity === true || row.isIdentity === 1,
    identitySeed: readNumberOrNull(row.seedValue),
    identityIncrement: readNumberOrNull(row.incrementValue),
    computedDefinition: typeof row.computedDefinition === "string" ? row.computedDefinition : null,
  };
}

/**
 * 从原始行中读取数值字段。
 *
 * @param {unknown} value 原始字段值。
 * @returns {number | null} 数值；缺失时为空。
 */
function readNumberOrNull(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/**
 * 从 COUNT 查询行读取计数。
 *
 * @param {readonly Record<string, unknown>[]} rows COUNT 查询行。
 * @returns {boolean} 计数大于 0 时返回 true。
 */
function readCount(rows: readonly Record<string, unknown>[]): boolean {
  const value = rows[0]?.identityCount;
  return (typeof value === "number" && value > 0) || (typeof value === "bigint" && value > 0n);
}
