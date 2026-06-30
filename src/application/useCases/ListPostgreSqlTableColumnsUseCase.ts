import type { PostgreSqlConnectionConfig } from "../../domain/connections/ConnectionConfig";
import type { PostgreSqlTableDataProvider } from "../postgresql/PostgreSqlTableDataProvider";
import type { TableColumnMetadata } from "../shared/TableDataTypes";

/**
 * 列出 PostgreSQL 表的字段元数据。
 */
export class ListPostgreSqlTableColumnsUseCase {
  /**
   * 创建 PostgreSQL 表字段列表用例。
   *
   * @param postgreSqlTableDataProvider 用于读取 PostgreSQL 表结构的提供者。
   */
  public constructor(private readonly postgreSqlTableDataProvider: PostgreSqlTableDataProvider) {}

  /**
   * 加载选中 PostgreSQL 表的字段。
   *
   * @param {PostgreSqlConnectionConfig} connection PostgreSQL 连接配置。
   * @param {string} databaseName 表所属的 database。
   * @param {string} schemaName 表所属的 schema。
   * @param {string} tableName 需要加载字段的表。
   * @returns {Promise<readonly TableColumnMetadata[]>} 归一化后的字段元数据。
   */
  public async execute(
    connection: PostgreSqlConnectionConfig,
    databaseName: string,
    schemaName: string,
    tableName: string,
  ): Promise<readonly TableColumnMetadata[]> {
    return this.postgreSqlTableDataProvider.listColumns(
      connection,
      databaseName,
      schemaName,
      tableName,
    );
  }
}
