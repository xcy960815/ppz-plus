import type { MssqlConnectionConfig } from "../../../domain/connections/ConnectionConfig";
import type { SqlExportDocument, SqlExportKind } from "../../../domain/export/SqlExportDocument";
import type { MssqlExportProvider, MssqlExportTableTarget } from "../../mssql/MssqlExportProvider";

/**
 * 导出 MSSQL 表级 SQL 文档的应用用例。
 */
export class ExportMssqlTableUseCase {
  /**
   * 创建 MSSQL 表导出用例。
   *
   * @param postgreSqlExportProvider 用于生成 SQL 导出内容的提供者。
   */
  public constructor(private readonly postgreSqlExportProvider: MssqlExportProvider) {}

  /**
   * 导出指定 MSSQL 表的 SQL 内容。
   *
   * @param {MssqlConnectionConfig} connection MSSQL 连接配置。
   * @param {MssqlExportTableTarget} target 表级导出目标。
   * @param {SqlExportKind} kind 导出的 SQL 内容类型。
   * @returns {Promise<SqlExportDocument>} 生成后的 SQL 导出文档。
   */
  public async execute(
    connection: MssqlConnectionConfig,
    target: MssqlExportTableTarget,
    kind: SqlExportKind,
  ): Promise<SqlExportDocument> {
    if (target.databaseName.trim().length === 0) {
      throw new Error("导出 MSSQL 表需要提供 database 名称。");
    }

    if (target.schemaName.trim().length === 0) {
      throw new Error("导出 MSSQL 表需要提供 schema 名称。");
    }

    if (target.tableName.trim().length === 0) {
      throw new Error("导出 MSSQL 表需要提供表名。");
    }

    return this.postgreSqlExportProvider.exportTable(connection, target, kind);
  }
}
