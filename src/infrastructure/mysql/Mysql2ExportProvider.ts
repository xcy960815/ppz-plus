import type { MySqlExportProvider } from "../../application/mysql/MySqlExportProvider";
import type { MysqlConnectionConfig } from "../../domain/connections/ConnectionConfig";
import type {
  SqlExportDocument,
  SqlExportKind,
  SqlExportSchemaTarget,
  SqlExportTableTarget,
} from "../../domain/export/SqlExportDocument";
import { formatSqlExportFileName } from "../../domain/export/SqlExportFileName";
import { SQL_EXPORT_FORMAT } from "../../domain/export/SqlExportFormat";
import { stringifyObjectValue } from "../shared/stringifyObjectValue";
import { MySqlConnectionAdapter } from "./MySqlConnectionAdapter";
import { MySqlRuntimeLoader } from "./MySqlRuntimeLoader";
import type {
  MySqlField,
  MySqlQueryResultFields,
  MySqlRuntimeClient,
  MySqlQueryRows,
} from "./MySqlRuntimeTypes";

/**
 * 通过 mysql2 promise 驱动生成 MySQL 表级 DDL/DML。
 */
export class Mysql2ExportProvider implements MySqlExportProvider {
  /**
   * 创建基于 mysql2 的导出提供者。
   *
   * @param mySqlConnectionAdapter 用于归一化连接选项的适配器。
   * @param mySqlRuntimeLoader 用于延迟解析 mysql2 运行时的加载器。
   */
  public constructor(
    private readonly mySqlConnectionAdapter: MySqlConnectionAdapter,
    private readonly mySqlRuntimeLoader: MySqlRuntimeLoader,
  ) {}

  /**
   * 导出指定 MySQL 表的 SQL 文档。
   *
   * @param {MysqlConnectionConfig} connection MySQL 连接配置。
   * @param {SqlExportTableTarget} target 表级导出目标。
   * @param {SqlExportKind} kind 导出的 SQL 内容类型。
   * @returns {Promise<SqlExportDocument>} 生成后的 SQL 导出文档。
   */
  public async exportTable(
    connection: MysqlConnectionConfig,
    target: SqlExportTableTarget,
    kind: SqlExportKind,
  ): Promise<SqlExportDocument> {
    const mysql = await this.mySqlRuntimeLoader.loadMySqlPromiseModule();
    const runtimeConnection = await mysql.createConnection(
      this.mySqlConnectionAdapter.resolveDriverOptions(connection),
    );

    try {
      const blocks: string[] = [
        this.renderTableHeader(connection.name, target, kind),
        this.renderDatabaseUseBlock(target.schemaName),
      ];

      if (kind === "ddl" || kind === "both") {
        blocks.push(await this.exportDdl(runtimeConnection, target));
      }

      if (kind === "dml" || kind === "both") {
        blocks.push(await this.exportDml(runtimeConnection, target));
      }

      blocks.push(this.renderFooter());

      return {
        title: formatSqlExportFileName([target.schemaName, target.tableName], kind),
        format: SQL_EXPORT_FORMAT.id,
        kind,
        target,
        content: `${blocks.join("\n\n")}\n`,
      };
    } finally {
      try {
        await runtimeConnection.end();
      } catch {
        /**
         * 导出内容生成结果优先，关闭连接失败不覆盖主要结果。
         */
      }
    }
  }

  /**
   * 导出指定 MySQL schema 的 SQL 文档。
   *
   * @param connection MySQL 连接配置。
   * @param target schema 级导出目标。
   * @param kind 导出的 SQL 内容类型。
   * @returns 生成后的 SQL 导出文档。
   */
  public async exportSchema(
    connection: MysqlConnectionConfig,
    target: SqlExportSchemaTarget,
    kind: SqlExportKind,
  ): Promise<SqlExportDocument> {
    const mysql = await this.mySqlRuntimeLoader.loadMySqlPromiseModule();
    const runtimeConnection = await mysql.createConnection(
      this.mySqlConnectionAdapter.resolveDriverOptions(connection),
    );

    try {
      const tables = await this.listSchemaTables(runtimeConnection, target);
      const blocks: string[] = [
        this.renderSchemaHeader(connection.name, target, kind),
        this.renderDatabaseUseBlock(target.schemaName),
      ];

      if (tables.length === 0) {
        blocks.push(`-- ${target.schemaName} 中未找到基础表。`);
      }

      for (const tableName of tables) {
        blocks.push(
          await this.exportTableBlock(
            runtimeConnection,
            {
              schemaName: target.schemaName,
              tableName,
            },
            kind,
          ),
        );
      }

      blocks.push(this.renderFooter());

      return {
        title: formatSqlExportFileName([target.schemaName], kind),
        format: SQL_EXPORT_FORMAT.id,
        kind,
        target,
        content: `${blocks.join("\n\n")}\n`,
      };
    } finally {
      try {
        await runtimeConnection.end();
      } catch {
        /**
         * 导出内容生成结果优先，关闭连接失败不覆盖主要结果。
         */
      }
    }
  }

  /**
   * 生成表级导出文档头部注释。
   *
   * @param connectionName 当前连接显示名。
   * @param target 表级导出目标。
   * @param kind 导出的 SQL 内容类型。
   * @returns SQL 注释头。
   */
  private renderTableHeader(
    connectionName: string,
    target: SqlExportTableTarget,
    kind: SqlExportKind,
  ): string {
    return [
      `-- PPZ Plus MySQL ${kind.toUpperCase()} export`,
      `-- Connection: ${connectionName}`,
      `-- Table: ${target.schemaName}.${target.tableName}`,
    ].join("\n");
  }

  /**
   * 生成 schema 级导出文档头部注释。
   *
   * @param {string} connectionName 当前连接显示名。
   * @param {SqlExportSchemaTarget} target schema 级导出目标。
   * @param {SqlExportKind} kind 导出的 SQL 内容类型。
   * @returns {string} SQL 注释头。
   */
  private renderSchemaHeader(
    connectionName: string,
    target: SqlExportSchemaTarget,
    kind: SqlExportKind,
  ): string {
    return [
      `-- PPZ Plus MySQL ${kind.toUpperCase()} export`,
      `-- Connection: ${connectionName}`,
      `-- Schema: ${target.schemaName}`,
    ].join("\n");
  }

  /**
   * 生成可重新导入的数据库准备语句。
   *
   * @param {string} schemaName 导出目标 schema 名称。
   * @returns {string} 数据库创建和切换 SQL。
   */
  private renderDatabaseUseBlock(schemaName: string): string {
    const schemaSql = this.escapeIdentifier(schemaName);

    return [
      "SET FOREIGN_KEY_CHECKS = 0;",
      `CREATE DATABASE IF NOT EXISTS ${schemaSql};`,
      `USE ${schemaSql};`,
    ].join("\n");
  }

  /**
   * 生成导出文件尾部控制语句。
   *
   * @returns {string} 导出文件尾部 SQL。
   */
  private renderFooter(): string {
    return ["SET FOREIGN_KEY_CHECKS = 1;", "-- PPZ Plus MySQL export completed."].join("\n");
  }

  /**
   * 导出单个表在 schema 导出文档中的 SQL 块。
   *
   * @param {MySqlRuntimeClient} runtimeConnection 当前可用的 mysql2 连接。
   * @param {SqlExportTableTarget} target 表级导出目标。
   * @param {SqlExportKind} kind 导出的 SQL 内容类型。
   * @returns {Promise<string>} 单表 SQL 文本块。
   */
  private async exportTableBlock(
    runtimeConnection: MySqlRuntimeClient,
    target: SqlExportTableTarget,
    kind: SqlExportKind,
  ): Promise<string> {
    const blocks = [`-- Table: ${target.schemaName}.${target.tableName}`];

    if (kind === "ddl" || kind === "both") {
      blocks.push(await this.exportDdl(runtimeConnection, target));
    }

    if (kind === "dml" || kind === "both") {
      blocks.push(await this.exportDml(runtimeConnection, target));
    }

    return blocks.join("\n\n");
  }

  /**
   * 列出 schema 下可导出的基础表。
   *
   * @param {MySqlRuntimeClient} runtimeConnection 当前可用的 mysql2 连接。
   * @param {SqlExportSchemaTarget} target schema 级导出目标。
   * @returns {Promise<readonly string[]>} 表名列表。
   */
  private async listSchemaTables(
    runtimeConnection: MySqlRuntimeClient,
    target: SqlExportSchemaTarget,
  ): Promise<readonly string[]> {
    const [rows] = await runtimeConnection.query(
      [
        "SELECT TABLE_NAME AS tableName",
        "FROM information_schema.tables",
        "WHERE TABLE_SCHEMA = ?",
        "AND TABLE_TYPE = 'BASE TABLE'",
        "ORDER BY TABLE_NAME",
      ].join(" "),
      [target.schemaName],
    );

    if (!Array.isArray(rows)) {
      return [];
    }

    return rows
      .map((row) => {
        if (!row || typeof row !== "object") {
          return undefined;
        }

        const tableName = (row as Record<string, unknown>).tableName;
        return typeof tableName === "string" ? tableName : undefined;
      })
      .filter((tableName): tableName is string => tableName !== undefined);
  }

  /**
   * 导出指定表的 DDL。
   *
   * @param {MySqlRuntimeClient} runtimeConnection 当前可用的 mysql2 连接。
   * @param {SqlExportTableTarget} target 表级导出目标。
   * @returns {Promise<string>} DDL SQL 文本。
   */
  private async exportDdl(
    runtimeConnection: MySqlRuntimeClient,
    target: SqlExportTableTarget,
  ): Promise<string> {
    const [rows] = await runtimeConnection.query(
      `SHOW CREATE TABLE ${this.escapeQualifiedTableName(target)}`,
    );
    const createTableSql = this.extractCreateTableSql(rows);

    if (!createTableSql) {
      throw new Error(
        `MySQL did not return CREATE TABLE SQL for ${target.schemaName}.${target.tableName}.`,
      );
    }

    return `${createTableSql};`;
  }

  /**
   * 导出指定表的 DML。
   *
   * @param {MySqlRuntimeClient} runtimeConnection 当前可用的 mysql2 连接。
   * @param {SqlExportTableTarget} target 表级导出目标。
   * @returns {Promise<string>} DML SQL 文本。
   */
  private async exportDml(
    runtimeConnection: MySqlRuntimeClient,
    target: SqlExportTableTarget,
  ): Promise<string> {
    const [rows, rawFields] = await runtimeConnection.query(
      `SELECT * FROM ${this.escapeQualifiedTableName(target)}`,
    );
    const columnNames = this.normalizeFieldNames(rawFields);

    if (columnNames.length === 0) {
      return `-- ${target.schemaName}.${target.tableName} 未找到字段。`;
    }

    if (!Array.isArray(rows) || rows.length === 0) {
      return `-- ${target.schemaName}.${target.tableName} 中未找到数据。`;
    }

    return rows
      .filter(
        (row): row is Record<string, unknown> =>
          Boolean(row) && typeof row === "object" && !Array.isArray(row),
      )
      .map((row) => this.renderInsertStatement(target, columnNames, row))
      .join("\n");
  }

  /**
   * 从 SHOW CREATE TABLE 结果中提取 CREATE TABLE SQL。
   *
   * @param {MySqlQueryRows} rows mysql2 返回的原始行集合。
   * @returns {string | undefined} CREATE TABLE SQL；无法识别时为空。
   */
  private extractCreateTableSql(rows: MySqlQueryRows): string | undefined {
    if (!Array.isArray(rows)) {
      return undefined;
    }

    const firstRow: unknown = rows[0];
    if (!firstRow || typeof firstRow !== "object" || Array.isArray(firstRow)) {
      return undefined;
    }

    const createTableEntry = Object.entries(firstRow as Record<string, unknown>).find(
      ([key]) => key.toLowerCase() === "create table",
    );
    const createTableSql = createTableEntry?.[1];

    return typeof createTableSql === "string" ? createTableSql : undefined;
  }

  /**
   * 将 mysql2 字段元数据归一化为字段名列表。
   *
   * @param {MySqlQueryResultFields | undefined} fields mysql2 返回的字段元数据。
   * @returns {readonly string[]} 字段名列表。
   */
  private normalizeFieldNames(fields: MySqlQueryResultFields | undefined): readonly string[] {
    if (!Array.isArray(fields)) {
      return [];
    }

    const fieldItems = fields as readonly (MySqlField | readonly MySqlField[] | undefined)[];

    return (
      fieldItems
        // 多语句结果中的元素可能是嵌套字段数组；导出单表 DML 时只接收单语句字段。
        .filter(
          (field): field is MySqlField =>
            Boolean(field) && !Array.isArray(field) && typeof field === "object",
        )
        .map((field) => field.name)
    );
  }

  /**
   * 渲染单行 INSERT 语句。
   *
   * @param {SqlExportTableTarget} target 表级导出目标。
   * @param {readonly string[]} columnNames 字段名列表。
   * @param {Record<string, unknown>} row mysql2 返回的原始行。
   * @returns {string} INSERT SQL 文本。
   */
  private renderInsertStatement(
    target: SqlExportTableTarget,
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
   * 将 JavaScript 值格式化为 MySQL 字面量。
   *
   * @param {unknown} value 原始字段值。
   * @returns {string} MySQL SQL 字面量。
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
      return `'${this.escapeSqlString(value.toISOString().slice(0, 19).replace("T", " "))}'`;
    }

    if (Buffer.isBuffer(value)) {
      return `X'${value.toString("hex")}'`;
    }

    if (ArrayBuffer.isView(value)) {
      return `X'${Buffer.from(value.buffer, value.byteOffset, value.byteLength).toString("hex")}'`;
    }

    if (typeof value === "object") {
      return `'${this.escapeSqlString(stringifyObjectValue(value))}'`;
    }

    return `'${this.escapeSqlString(String(value))}'`;
  }

  /**
   * 转义 MySQL 字符串字面量内容。
   *
   * @param {string} value 待转义的字符串。
   * @returns {string} 转义后的字符串字面量内容。
   */
  private escapeSqlString(value: string): string {
    return value
      .replaceAll("\\", "\\\\")
      .replaceAll("\0", "\\0")
      .replaceAll("\n", "\\n")
      .replaceAll("\r", "\\r")
      .replaceAll("\b", "\\b")
      .replaceAll("\t", "\\t")
      .replaceAll("\u001a", "\\Z")
      .replaceAll("'", "\\'");
  }

  /**
   * 转义 MySQL 标识符。
   *
   * @param {string} identifier 待转义的标识符。
   * @returns {string} 转义后的标识符。
   */
  private escapeIdentifier(identifier: string): string {
    return `\`${identifier.replaceAll("`", "``")}\``;
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
}
