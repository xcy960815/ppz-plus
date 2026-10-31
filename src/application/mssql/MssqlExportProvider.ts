import type { MssqlConnectionConfig } from "../../domain/connections/ConnectionConfig";
import type {
  SqlExportDocument,
  SqlExportKind,
  SqlExportSchemaTarget,
  SqlExportTableTarget,
} from "../../domain/export/SqlExportDocument";

/**
 * 描述 MSSQL 表级 SQL 导出目标。
 */
export interface MssqlExportTableTarget extends SqlExportTableTarget {
  readonly databaseName: string;
}

/**
 * 描述 MSSQL schema 级 SQL 导出目标。
 */
export interface MssqlExportSchemaTarget extends SqlExportSchemaTarget {
  readonly databaseName: string;
}

/**
 * 描述 MSSQL database 级 SQL 导出目标。
 */
export interface MssqlExportDatabaseTarget {
  readonly databaseName: string;
}

/**
 * 向应用层提供 MSSQL SQL 导出能力。
 */
export interface MssqlExportProvider {
  /**
   * 导出指定 MSSQL 表的 SQL 文档。
   *
   * @param {MssqlConnectionConfig} connection MSSQL 连接配置。
   * @param {MssqlExportTableTarget} target 表级导出目标。
   * @param {SqlExportKind} kind 导出的 SQL 内容类型。
   * @returns {Promise<SqlExportDocument>} 生成后的 SQL 导出文档。
   */
  exportTable(
    connection: MssqlConnectionConfig,
    target: MssqlExportTableTarget,
    kind: SqlExportKind,
  ): Promise<SqlExportDocument>;

  /**
   * 导出指定 MSSQL schema 的 SQL 文档。
   *
   * @param {MssqlConnectionConfig} connection MSSQL 连接配置。
   * @param {MssqlExportSchemaTarget} target schema 级导出目标。
   * @param {SqlExportKind} kind 导出的 SQL 内容类型。
   * @returns {Promise<SqlExportDocument>} 生成后的 SQL 导出文档。
   */
  exportSchema(
    connection: MssqlConnectionConfig,
    target: MssqlExportSchemaTarget,
    kind: SqlExportKind,
  ): Promise<SqlExportDocument>;

  /**
   * 导出指定 MSSQL database 的 SQL 文档。
   *
   * @param {MssqlConnectionConfig} connection MSSQL 连接配置。
   * @param {MssqlExportDatabaseTarget} target database 级导出目标。
   * @param {SqlExportKind} kind 导出的 SQL 内容类型。
   * @returns {Promise<SqlExportDocument>} 生成后的 SQL 导出文档。
   */
  exportDatabase(
    connection: MssqlConnectionConfig,
    target: MssqlExportDatabaseTarget,
    kind: SqlExportKind,
  ): Promise<SqlExportDocument>;
}
