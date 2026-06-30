import type { PostgreSqlConnectionConfig } from "../../domain/connections/ConnectionConfig";
import type { SqlExportDocument, SqlExportKind } from "../../domain/export/SqlExportDocument";
import type {
  PostgreSqlExportProvider,
  PostgreSqlExportSchemaTarget,
} from "../postgresql/PostgreSqlExportProvider";

/**
 * 导出 PostgreSQL schema 级 SQL 文档的应用用例。
 */
export class ExportPostgreSqlSchemaUseCase {
  /**
   * 创建 PostgreSQL schema 导出用例。
   *
   * @param postgreSqlExportProvider 用于生成 SQL 导出内容的提供者。
   */
  public constructor(private readonly postgreSqlExportProvider: PostgreSqlExportProvider) {}

  /**
   * 导出指定 PostgreSQL schema 的 SQL 内容。
   *
   * @param {PostgreSqlConnectionConfig} connection PostgreSQL 连接配置。
   * @param {PostgreSqlExportSchemaTarget} target schema 级导出目标。
   * @param {SqlExportKind} kind 导出的 SQL 内容类型。
   * @returns {Promise<SqlExportDocument>} 生成后的 SQL 导出文档。
   */
  public async execute(
    connection: PostgreSqlConnectionConfig,
    target: PostgreSqlExportSchemaTarget,
    kind: SqlExportKind,
  ): Promise<SqlExportDocument> {
    if (target.databaseName.trim().length === 0) {
      throw new Error("导出 PostgreSQL schema 需要提供 database 名称。");
    }

    if (target.schemaName.trim().length === 0) {
      throw new Error("导出 PostgreSQL schema 需要提供 schema 名称。");
    }

    return this.postgreSqlExportProvider.exportSchema(connection, target, kind);
  }
}
