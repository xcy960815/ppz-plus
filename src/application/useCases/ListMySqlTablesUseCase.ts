import type { MysqlConnectionConfig } from "../../domain/connections/ConnectionConfig";
import type { MySqlMetadataProvider, MySqlTableMetadata } from "../mysql/MySqlMetadataProvider";

/**
 * 列出 MySQL schema 下的表。
 */
export class ListMySqlTablesUseCase {
  /**
   * 创建表列表用例。
   *
   * @param mySqlMetadataProvider 用于读取 MySQL 表元数据的提供者。
   */
  public constructor(private readonly mySqlMetadataProvider: MySqlMetadataProvider) {}

  /**
   * 加载选中 MySQL schema 下的表。
   *
   * @param {MysqlConnectionConfig} connection MySQL 连接配置。
   * @param {string} schemaName 需要加载表的 schema。
   * @returns {Promise<readonly MySqlTableMetadata[]>} 该 schema 下可见的表。
   */
  public async execute(
    connection: MysqlConnectionConfig,
    schemaName: string,
  ): Promise<readonly MySqlTableMetadata[]> {
    return this.mySqlMetadataProvider.listTables(connection, schemaName);
  }
}
