import type { MssqlMetadataProvider, MssqlSchemaMetadata } from "../mssql/MssqlMetadataProvider";
import type { MssqlConnectionConfig } from "../../domain/connections/ConnectionConfig";

/**
 * 列出 MSSQL database 下的 schema。
 */
export class ListMssqlSchemasUseCase {
  /**
   * 创建 MSSQL schema 列表用例。
   *
   * @param mssqlMetadataProvider 用于读取 MSSQL schema 元数据的提供者。
   */
  public constructor(private readonly mssqlMetadataProvider: MssqlMetadataProvider) {}

  /**
   * 加载指定 MSSQL database 下的 schema。
   *
   * @param {MssqlConnectionConfig} connection MSSQL 连接配置。
   * @param {string} databaseName 需要加载 schema 的 database。
   * @returns {Promise<readonly MssqlSchemaMetadata[]>} 可见的 schema 列表。
   */
  public async execute(
    connection: MssqlConnectionConfig,
    databaseName: string,
  ): Promise<readonly MssqlSchemaMetadata[]> {
    return this.mssqlMetadataProvider.listSchemas(connection, databaseName);
  }
}
