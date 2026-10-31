import type { MssqlConnectionConfig } from "../../domain/connections/ConnectionConfig";
import type {
  TableColumnMetadata,
  TableQueryOptions,
  TableRowPage,
} from "../shared/TableDataTypes";

/**
 * 向应用层提供 MSSQL 表结构和只读行数据。
 */
export interface MssqlTableDataProvider {
  /**
   * 列出选中 MSSQL 表的字段。
   *
   * @param {MssqlConnectionConfig} connection MSSQL 连接配置。
   * @param {string} databaseName 表所属的 database。
   * @param {string} schemaName 表所属的 schema。
   * @param {string} tableName 需要加载字段的表。
   * @returns {Promise<readonly TableColumnMetadata[]>} 归一化后的字段元数据。
   */
  listColumns(
    connection: MssqlConnectionConfig,
    databaseName: string,
    schemaName: string,
    tableName: string,
  ): Promise<readonly TableColumnMetadata[]>;

  /**
   * 列出选中 MSSQL 表的一页只读行数据。
   *
   * @param {MssqlConnectionConfig} connection MSSQL 连接配置。
   * @param {string} databaseName 表所属的 database。
   * @param {string} schemaName 表所属的 schema。
   * @param {string} tableName 需要加载行数据的表。
   * @param {number} pageIndex 从 0 开始的页码。
   * @param {number} pageSize 每页请求的行数。
   * @param {TableQueryOptions} options 排序和过滤等查询选项。
   * @returns {Promise<TableRowPage>} 分页行数据。
   */
  listRowPage(
    connection: MssqlConnectionConfig,
    databaseName: string,
    schemaName: string,
    tableName: string,
    pageIndex: number,
    pageSize: number,
    options?: TableQueryOptions,
  ): Promise<TableRowPage>;
}
