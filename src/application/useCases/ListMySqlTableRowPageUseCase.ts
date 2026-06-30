import type { MysqlConnectionConfig } from "../../domain/connections/ConnectionConfig";
import type {
  MySqlTableDataProvider,
  MySqlTableQueryOptions,
  MySqlTableRowPage,
} from "../mysql/MySqlTableDataProvider";

/**
 * 列出 MySQL 表的一页行数据。
 */
export class ListMySqlTableRowPageUseCase {
  /**
   * 创建表分页行数据列表用例。
   *
   * @param mySqlTableDataProvider 用于读取 MySQL 表行数据的提供者。
   */
  public constructor(private readonly mySqlTableDataProvider: MySqlTableDataProvider) {}

  /**
   * 加载选中 MySQL 表的一页只读行数据。
   *
   * @param {MysqlConnectionConfig} connection MySQL 连接配置。
   * @param {string} schemaName 表所属的 schema。
   * @param {string} tableName 需要加载行数据的表。
   * @param {number} pageIndex 从 0 开始的页码。
   * @param {number} pageSize 每页请求的行数。
   * @param {MySqlTableQueryOptions} options 排序和过滤等查询选项。
   * @returns {Promise<MySqlTableRowPage>} 分页行数据。
   */
  public async execute(
    connection: MysqlConnectionConfig,
    schemaName: string,
    tableName: string,
    pageIndex: number,
    pageSize: number,
    options?: MySqlTableQueryOptions,
  ): Promise<MySqlTableRowPage> {
    return this.mySqlTableDataProvider.listRowPage(
      connection,
      schemaName,
      tableName,
      pageIndex,
      pageSize,
      options,
    );
  }
}
