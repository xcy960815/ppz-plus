import type { MysqlConnectionConfig } from "../../domain/connections/ConnectionConfig";
import type { SqlFileImportResult } from "../../domain/import/SqlFileImportResult";

/**
 * 向应用层提供 MySQL SQL 文件导入执行能力。
 */
export interface MySqlSqlFileImportProvider {
  /**
   * 将 SQL 文件内容导入到指定 MySQL 连接。
   *
   * @param {MysqlConnectionConfig} connection MySQL 连接配置。
   * @param {string} sql SQL 文件内容。
   * @returns {Promise<SqlFileImportResult>} SQL 文件导入结果。
   */
  importSql(connection: MysqlConnectionConfig, sql: string): Promise<SqlFileImportResult>;
}
