import type { Sqlite3ConnectionConfig } from "../../domain/connections/ConnectionConfig";
import type {
  Sqlite3TableDataProvider,
  Sqlite3TableInsertResult,
  Sqlite3TableInsertValues,
} from "../sqlite3/Sqlite3TableDataProvider";

/**
 * 向 SQLite3 表新增单条记录的应用用例。
 */
export class InsertSqlite3TableRowUseCase {
  /**
   * 创建新增表行用例。
   *
   * @param sqlite3TableDataProvider 用于写入 SQLite3 表数据的提供者。
   */
  public constructor(private readonly sqlite3TableDataProvider: Sqlite3TableDataProvider) {}

  /**
   * 向指定 SQLite3 表新增单条记录。
   *
   * @param {Sqlite3ConnectionConfig} connection SQLite3 连接配置。
   * @param {string} tableName 需要新增记录的表。
   * @param {Sqlite3TableInsertValues} values 需要显式写入的字段值。
   * @returns {Promise<Sqlite3TableInsertResult>} 单行新增结果。
   */
  public async execute(
    connection: Sqlite3ConnectionConfig,
    tableName: string,
    values: Sqlite3TableInsertValues,
  ): Promise<Sqlite3TableInsertResult> {
    if (tableName.trim().length === 0) {
      throw new Error("新增 SQLite3 记录需要提供表名。");
    }

    return this.sqlite3TableDataProvider.insertRow(connection, tableName, values);
  }
}
