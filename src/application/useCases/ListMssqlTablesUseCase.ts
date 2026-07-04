import type { MssqlMetadataProvider, MssqlTableMetadata } from "../mssql/MssqlMetadataProvider";
import type { MssqlConnectionConfig } from "../../domain/connections/ConnectionConfig";

/**
 * 列出 MSSQL schema 下的表。
 */
export class ListMssqlTablesUseCase {
  /**
   * 创建 MSSQL 表列表用例。
   *
   * @param mssqlMetadataProvider 用于读取 MSSQL 表元数据的提供者。
   */
  public constructor(private readonly mssqlMetadataProvider: MssqlMetadataProvider) {}

  /**
   * 加载指定 MSSQL schema 下的表。
   *
   * @param {MssqlConnectionConfig} connection MSSQL 连接配置。
   * @param {string} databaseName 需要连接的 database。
   * @param {string} schemaName 需要加载表的 schema。
   * @returns {Promise<readonly MssqlTableMetadata[]>} 该 schema 下可见的表。
   */
  public async execute(
    connection: MssqlConnectionConfig,
    databaseName: string,
    schemaName: string,
  ): Promise<readonly MssqlTableMetadata[]> {
    return this.mssqlMetadataProvider.listTables(connection, databaseName, schemaName);
  }
}
