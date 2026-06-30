import type { Sqlite3ConnectionConfig } from "../../domain/connections/ConnectionConfig";
import type {
  Sqlite3TableColumnMetadata,
  Sqlite3TableDataProvider,
} from "../sqlite3/Sqlite3TableDataProvider";

/**
 * 列出 SQLite3 表的字段元数据。
 */
export class ListSqlite3TableColumnsUseCase {
  /**
   * 创建 SQLite3 表字段列表用例。
   *
   * @param sqlite3TableDataProvider 用于读取 SQLite3 表结构的提供者。
   */
  public constructor(private readonly sqlite3TableDataProvider: Sqlite3TableDataProvider) {}

  /**
   * 加载选中 SQLite3 表的字段。
   *
   * @param {Sqlite3ConnectionConfig} connection SQLite3 连接配置。
   * @param {string} tableName 需要加载字段的表。
   * @returns {Promise<readonly Sqlite3TableColumnMetadata[]>} 归一化后的字段元数据。
   */
  public async execute(
    connection: Sqlite3ConnectionConfig,
    tableName: string,
  ): Promise<readonly Sqlite3TableColumnMetadata[]> {
    return this.sqlite3TableDataProvider.listColumns(connection, tableName);
  }
}
