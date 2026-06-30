import type { SqlExportFormatId } from "./SqlExportFormat";

/**
 * 表示 SQL 导出的内容类型。
 */
export type SqlExportKind = "ddl" | "dml" | "both";

/**
 * 描述表级 SQL 导出目标。
 */
export interface SqlExportTableTarget {
  readonly schemaName: string;
  readonly tableName: string;
}

/**
 * 描述 schema 级 SQL 导出目标。
 */
export interface SqlExportSchemaTarget {
  readonly schemaName: string;
}

/**
 * 描述 database 级 SQL 导出目标。
 */
export interface SqlExportDatabaseTarget {
  readonly databaseName: string;
}

/**
 * 描述 SQL 导出目标。
 */
export type SqlExportTarget =
  SqlExportTableTarget | SqlExportSchemaTarget | SqlExportDatabaseTarget;

/**
 * 描述一次 SQL 导出生成的文档内容。
 */
export interface SqlExportDocument {
  /**
   * 保存导出文档建议使用的文件名。
   */
  readonly title: string;

  /**
   * 保存导出文档的输出格式标识。
   */
  readonly format: SqlExportFormatId;

  /**
   * 保存导出文档包含的 SQL 内容类型。
   */
  readonly kind: SqlExportKind;

  /**
   * 保存导出文档对应的数据库目标。
   */
  readonly target: SqlExportTarget;

  /**
   * 保存导出文档正文内容。
   */
  readonly content: string;
}
