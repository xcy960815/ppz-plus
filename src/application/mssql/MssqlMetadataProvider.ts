import type { MssqlConnectionConfig } from "../../domain/connections/ConnectionConfig";

/**
 * 描述 MSSQL 资源树流程返回的 database 元数据。
 */
export interface MssqlDatabaseMetadata {
  readonly name: string;
}

/**
 * 描述 MSSQL 资源树流程返回的 schema 元数据。
 */
export interface MssqlSchemaMetadata {
  readonly databaseName: string;
  readonly name: string;
}

/**
 * 描述 MSSQL 资源树流程返回的表元数据。
 */
export interface MssqlTableMetadata {
  readonly databaseName: string;
  readonly schemaName: string;
  readonly name: string;
}

/**
 * 向应用层提供 MSSQL database、schema 和表元数据。
 */
export interface MssqlMetadataProvider {
  /**
   * 列出当前 MSSQL 连接可见的 database。
   *
   * @param {MssqlConnectionConfig} connection MSSQL 连接配置。
   * @returns {Promise<readonly MssqlDatabaseMetadata[]>} 可见的 database 列表。
   */
  listDatabases(connection: MssqlConnectionConfig): Promise<readonly MssqlDatabaseMetadata[]>;

  /**
   * 列出指定 MSSQL database 下的 schema。
   *
   * @param {MssqlConnectionConfig} connection MSSQL 连接配置。
   * @param {string} databaseName 需要连接并加载 schema 的 database。
   * @returns {Promise<readonly MssqlSchemaMetadata[]>} 可见的 schema 列表。
   */
  listSchemas(
    connection: MssqlConnectionConfig,
    databaseName: string,
  ): Promise<readonly MssqlSchemaMetadata[]>;

  /**
   * 列出指定 MSSQL schema 下的表。
   *
   * @param {MssqlConnectionConfig} connection MSSQL 连接配置。
   * @param {string} databaseName 需要连接的 database。
   * @param {string} schemaName 需要加载表的 schema。
   * @returns {Promise<readonly MssqlTableMetadata[]>} 该 schema 下可见的表。
   */
  listTables(
    connection: MssqlConnectionConfig,
    databaseName: string,
    schemaName: string,
  ): Promise<readonly MssqlTableMetadata[]>;
}
