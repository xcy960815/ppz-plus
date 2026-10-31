import type { MssqlConnectionConfig } from "../../../domain/connections/ConnectionConfig";
import type { MssqlTableDataProvider } from "../../mssql/MssqlTableDataProvider";
import type { TableColumnMetadata } from "../../shared/TableDataTypes";

/**
 * 列出 MSSQL 表的字段元数据。
 */
export class ListMssqlTableColumnsUseCase {
  /**
   * 创建 MSSQL 表字段列表用例。
   *
   * @param mssqlTableDataProvider 用于读取 MSSQL 表结构的提供者。
   */
  public constructor(private readonly mssqlTableDataProvider: MssqlTableDataProvider) {}

  /**
   * 加载选中 MSSQL 表的字段。
   *
   * @param {MssqlConnectionConfig} connection MSSQL 连接配置。
   * @param {string} databaseName 表所属的 database。
   * @param {string} schemaName 表所属的 schema。
   * @param {string} tableName 需要加载字段的表。
   * @returns {Promise<readonly TableColumnMetadata[]>} 归一化后的字段元数据。
   */
  public async execute(
    connection: MssqlConnectionConfig,
    databaseName: string,
    schemaName: string,
    tableName: string,
  ): Promise<readonly TableColumnMetadata[]> {
    return this.mssqlTableDataProvider.listColumns(connection, databaseName, schemaName, tableName);
  }
}
