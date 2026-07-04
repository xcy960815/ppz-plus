import type { MssqlDatabaseMetadata, MssqlMetadataProvider } from "../mssql/MssqlMetadataProvider";
import type { MssqlConnectionConfig } from "../../domain/connections/ConnectionConfig";

/**
 * 列出 MSSQL 连接下的 database。
 */
export class ListMssqlDatabasesUseCase {
  /**
   * 创建 MSSQL database 列表用例。
   *
   * @param mssqlMetadataProvider 用于读取 MSSQL database 元数据的提供者。
   */
  public constructor(private readonly mssqlMetadataProvider: MssqlMetadataProvider) {}

  /**
   * 加载选中 MSSQL 连接可见的 database。
   *
   * @param {MssqlConnectionConfig} connection MSSQL 连接配置。
   * @returns {Promise<readonly MssqlDatabaseMetadata[]>} 可见的 database 列表。
   */
  public async execute(
    connection: MssqlConnectionConfig,
  ): Promise<readonly MssqlDatabaseMetadata[]> {
    return this.mssqlMetadataProvider.listDatabases(connection);
  }
}
