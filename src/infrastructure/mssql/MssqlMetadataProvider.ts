import type {
  MssqlDatabaseMetadata,
  MssqlMetadataProvider as MssqlMetadataProviderContract,
  MssqlSchemaMetadata,
  MssqlTableMetadata,
} from "../../application/mssql/MssqlMetadataProvider";
import type { MssqlConnectionConfig } from "../../domain/connections/ConnectionConfig";
import { MssqlConnectionAdapter } from "./MssqlConnectionAdapter";
import { MssqlRuntimeLoader } from "./MssqlRuntimeLoader";
import type { MssqlDriverOptions, MssqlRuntimeConnectionPool } from "./MssqlRuntimeTypes";

/**
 * 通过 mssql 驱动读取 MSSQL database、schema 和表元数据。
 */
export class MssqlMetadataProvider implements MssqlMetadataProviderContract {
  /**
   * 创建基于 mssql 的 MSSQL 元数据提供者。
   *
   * @param mssqlConnectionAdapter 用于归一化连接选项的适配器。
   * @param mssqlRuntimeLoader 用于延迟解析 mssql 运行时的加载器。
   */
  public constructor(
    private readonly mssqlConnectionAdapter: MssqlConnectionAdapter,
    private readonly mssqlRuntimeLoader: MssqlRuntimeLoader,
  ) {}

  /**
   * 列出当前 MSSQL 连接可见的 database。
   *
   * @param {MssqlConnectionConfig} connection MSSQL 连接配置。
   * @returns {Promise<readonly MssqlDatabaseMetadata[]>} 可见的 database 列表。
   */
  public async listDatabases(
    connection: MssqlConnectionConfig,
  ): Promise<readonly MssqlDatabaseMetadata[]> {
    const rows = await this.runQuery(
      this.mssqlConnectionAdapter.resolveDriverOptions(connection),
      ["SELECT name AS name", "FROM sys.databases", "WHERE database_id > 4", "ORDER BY name"].join(
        " ",
      ),
    );

    return this.readNameRows(rows).map((name) => ({ name }));
  }

  /**
   * 列出指定 MSSQL database 下的 schema。
   *
   * @param {MssqlConnectionConfig} connection MSSQL 连接配置。
   * @param {string} databaseName 需要连接并加载 schema 的 database。
   * @returns {Promise<readonly MssqlSchemaMetadata[]>} 可见的 schema 列表。
   */
  public async listSchemas(
    connection: MssqlConnectionConfig,
    databaseName: string,
  ): Promise<readonly MssqlSchemaMetadata[]> {
    const rows = await this.runQuery(
      this.resolveDatabaseScopedOptions(connection, databaseName),
      [
        "SELECT name AS name",
        "FROM sys.schemas",
        "WHERE name NOT IN ('sys', 'INFORMATION_SCHEMA')",
        "ORDER BY name",
      ].join(" "),
    );

    return this.readNameRows(rows).map((name) => ({ databaseName, name }));
  }

  /**
   * 列出指定 MSSQL schema 下的表。
   *
   * @param {MssqlConnectionConfig} connection MSSQL 连接配置。
   * @param {string} databaseName 需要连接的 database。
   * @param {string} schemaName 需要加载表的 schema。
   * @returns {Promise<readonly MssqlTableMetadata[]>} 该 schema 下可见的表。
   */
  public async listTables(
    connection: MssqlConnectionConfig,
    databaseName: string,
    schemaName: string,
  ): Promise<readonly MssqlTableMetadata[]> {
    const rows = await this.runQuery(
      this.resolveDatabaseScopedOptions(connection, databaseName),
      [
        "SELECT t.name AS name",
        "FROM sys.tables AS t",
        "INNER JOIN sys.schemas AS s ON s.schema_id = t.schema_id",
        `WHERE s.name = ${this.quoteLiteral(schemaName)}`,
        "ORDER BY t.name",
      ].join(" "),
    );

    return this.readNameRows(rows).map((name) => ({ databaseName, schemaName, name }));
  }

  /**
   * 构建连接到目标 database 的驱动选项。
   *
   * 跨 database 浏览时通过重设连接的 database 建立连接，而不是在 SQL 中拼接
   * 不受控的 database 名称。
   *
   * @param {MssqlConnectionConfig} connection MSSQL 连接配置。
   * @param {string} databaseName 需要连接的目标 database。
   * @returns {MssqlDriverOptions} 指向目标 database 的驱动选项。
   */
  private resolveDatabaseScopedOptions(
    connection: MssqlConnectionConfig,
    databaseName: string,
  ): MssqlDriverOptions {
    const baseOptions = this.mssqlConnectionAdapter.resolveDriverOptions(connection);
    return {
      ...baseOptions,
      database: databaseName,
    };
  }

  /**
   * 打开连接池、执行查询并在完成后关闭连接池。
   *
   * @param {MssqlDriverOptions} options 驱动连接选项。
   * @param {string} sql 需要执行的查询。
   * @returns {Promise<ReadonlyArray<Record<string, unknown>>>} 查询返回的行集合。
   */
  private async runQuery(
    options: MssqlDriverOptions,
    sql: string,
  ): Promise<ReadonlyArray<Record<string, unknown>>> {
    const mssql = await this.mssqlRuntimeLoader.loadMssqlModule();
    const pool = new mssql.ConnectionPool(options);

    try {
      await pool.connect();
      const result = await pool.request().query(sql);
      return result.recordset ?? [];
    } finally {
      await this.closePool(pool);
    }
  }

  /**
   * 从查询行集合中读取 name 字段。
   *
   * @param {ReadonlyArray<Record<string, unknown>>} rows 查询返回的行集合。
   * @returns {readonly string[]} 非空 name 字符串列表。
   */
  private readNameRows(rows: ReadonlyArray<Record<string, unknown>>): readonly string[] {
    return rows
      .map((row) => row.name)
      .filter((name): name is string => typeof name === "string" && name.length > 0);
  }

  /**
   * 转义 MSSQL 字符串字面量，避免过滤值破坏查询。
   *
   * @param {string} value 需要转义的字符串。
   * @returns {string} 已加单引号并转义内部单引号的字面量。
   */
  private quoteLiteral(value: string): string {
    return `'${value.replaceAll("'", "''")}'`;
  }

  /**
   * 关闭连接池，关闭失败不覆盖主要查询结果。
   *
   * @param {MssqlRuntimeConnectionPool} pool 需要关闭的连接池。
   */
  private async closePool(pool: MssqlRuntimeConnectionPool): Promise<void> {
    try {
      await pool.close();
    } catch {
      /**
       * 查询结果优先，关闭失败不覆盖主要错误。
       */
    }
  }
}
