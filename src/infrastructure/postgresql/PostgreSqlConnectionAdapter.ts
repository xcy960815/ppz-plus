import type {
  ConnectionConfig,
  PostgreSqlConnectionConfig,
} from "../../domain/connections/ConnectionConfig";

/**
 * 描述从 PostgreSQL 连接配置解析出的网络端点。
 */
export interface PostgreSqlConnectionEndpoint {
  readonly host: string;
  readonly port: number;
}

/**
 * 描述 pg 客户端需要的运行时驱动选项。
 */
export interface PostgreSqlDriverOptions {
  readonly connectionString?: string;
  readonly host?: string;
  readonly port?: number;
  readonly user?: string;
  readonly password?: string;
  readonly database?: string;
}

/**
 * 为基础设施服务归一化 PostgreSQL 连接细节。
 */
export class PostgreSqlConnectionAdapter {
  /**
   * 检查连接配置是否属于 PostgreSQL 引擎。
   *
   * @param {ConnectionConfig} config 正在检查的连接配置。
   * @returns {config is PostgreSqlConnectionConfig} 该配置是否为 PostgreSQL 连接。
   */
  public supports(config: ConnectionConfig): config is PostgreSqlConnectionConfig {
    return config.engine === "postgresql";
  }

  /**
   * 解析访问 PostgreSQL 服务使用的 TCP 端点。
   *
   * @param {PostgreSqlConnectionConfig} config PostgreSQL 连接配置。
   * @returns {PostgreSqlConnectionEndpoint} 解析出的 host 和 port。
   */
  public resolveEndpoint(config: PostgreSqlConnectionConfig): PostgreSqlConnectionEndpoint {
    if (config.mode === "parameters") {
      return {
        host: config.host,
        port: config.port,
      };
    }

    const parsedUrl = new URL(config.url);
    return {
      host: parsedUrl.hostname,
      port: parsedUrl.port ? Number(parsedUrl.port) : 5432,
    };
  }

  /**
   * 解析 PostgreSQL 配置对应的 pg 运行时连接选项。
   *
   * @param {PostgreSqlConnectionConfig} config PostgreSQL 连接配置。
   * @param {string} databaseName 需要覆盖连接目标时使用的 database。
   * @returns {PostgreSqlDriverOptions} 归一化后的 pg 运行时连接选项。
   */
  public resolveDriverOptions(
    config: PostgreSqlConnectionConfig,
    databaseName?: string,
  ): PostgreSqlDriverOptions {
    if (config.mode === "parameters") {
      return {
        host: config.host,
        port: config.port,
        user: config.username,
        password: config.password,
        database: databaseName ?? config.database,
      };
    }

    return {
      connectionString: databaseName
        ? this.replaceDatabaseName(config.url, databaseName)
        : config.url,
    };
  }

  /**
   * 将 PostgreSQL URL 的 path database 替换成指定 database。
   *
   * @param {string} connectionUrl 用户保存的 PostgreSQL 连接 URL。
   * @param {string} databaseName 需要连接的 database。
   * @returns {string} 替换 database 后的连接 URL。
   */
  private replaceDatabaseName(connectionUrl: string, databaseName: string): string {
    const parsedUrl = new URL(connectionUrl);
    parsedUrl.pathname = `/${encodeURIComponent(databaseName)}`;
    return parsedUrl.href;
  }
}
