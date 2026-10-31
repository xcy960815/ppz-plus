import type { MssqlConnectionConfig } from "../../../domain/connections/ConnectionConfig";
import type { SqlExportDocument, SqlExportKind } from "../../../domain/export/SqlExportDocument";
import type { MssqlExportProvider, MssqlExportSchemaTarget } from "../../mssql/MssqlExportProvider";

/**
 * 导出 MSSQL schema 级 SQL 文档的应用用例。
 */
export class ExportMssqlSchemaUseCase {
  /**
   * 创建 MSSQL schema 导出用例。
   *
   * @param postgreSqlExportProvider 用于生成 SQL 导出内容的提供者。
   */
  public constructor(private readonly postgreSqlExportProvider: MssqlExportProvider) {}

  /**
   * 导出指定 MSSQL schema 的 SQL 内容。
   *
   * @param {MssqlConnectionConfig} connection MSSQL 连接配置。
   * @param {MssqlExportSchemaTarget} target schema 级导出目标。
   * @param {SqlExportKind} kind 导出的 SQL 内容类型。
   * @returns {Promise<SqlExportDocument>} 生成后的 SQL 导出文档。
   */
  public async execute(
    connection: MssqlConnectionConfig,
    target: MssqlExportSchemaTarget,
    kind: SqlExportKind,
  ): Promise<SqlExportDocument> {
    if (target.databaseName.trim().length === 0) {
      throw new Error("导出 MSSQL schema 需要提供 database 名称。");
    }

    if (target.schemaName.trim().length === 0) {
      throw new Error("导出 MSSQL schema 需要提供 schema 名称。");
    }

    return this.postgreSqlExportProvider.exportSchema(connection, target, kind);
  }
}
