import type {
  ConnectionConfig,
  MssqlConnectionConfig,
} from "../../domain/connections/ConnectionConfig";
import { validateMssqlUrl } from "../../domain/connections/ConnectionUrlValidator";
import type { MssqlDriverOptions } from "./MssqlRuntimeTypes";

/**
 * 描述从 MSSQL 连接配置解析出的网络端点。
 */
export interface MssqlConnectionEndpoint {
  readonly host: string;
  readonly port: number;
}

/**
 * 为基础设施服务归一化 MSSQL 连接细节。
 */
export class MssqlConnectionAdapter {
  /**
   * 保存 MSSQL 默认端口。
   */
  private static readonly defaultPort = 1433;

  /**
   * 检查连接配置是否属于 MSSQL 引擎。
   *
   * @param {ConnectionConfig} config 正在检查的连接配置。
   * @returns {config is MssqlConnectionConfig} 该配置是否为 MSSQL 连接。
   */
  public supports(config: ConnectionConfig): config is MssqlConnectionConfig {
    return config.engine === "mssql";
  }

  /**
   * 解析访问 MSSQL 服务使用的 TCP 端点。
   *
   * @param {MssqlConnectionConfig} config MSSQL 连接配置。
   * @returns {MssqlConnectionEndpoint} 解析出的 host 和 port。
   */
  public resolveEndpoint(config: MssqlConnectionConfig): MssqlConnectionEndpoint {
    if (config.mode === "parameters") {
      return {
        host: config.host,
        port: config.port,
      };
    }

    const parsedUrl = this.parseConnectionUrl(config.url);
    return {
      host: parsedUrl.hostname,
      port: this.readPort(parsedUrl),
    };
  }

  /**
   * 解析 MSSQL 配置对应的 mssql/tedious 运行时连接选项。
   *
   * @param {MssqlConnectionConfig} config MSSQL 连接配置。
   * @returns {MssqlDriverOptions} 归一化后的 mssql 运行时连接选项。
   */
  public resolveDriverOptions(config: MssqlConnectionConfig): MssqlDriverOptions {
    if (config.mode === "parameters") {
      return {
        server: config.host,
        port: config.port,
        user: config.username,
        password: config.password,
        database: config.database,
        options: {
          encrypt: config.encrypt,
          trustServerCertificate: config.trustServerCertificate,
        },
      };
    }

    const parsedUrl = this.parseConnectionUrl(config.url);
    const databaseName = this.readDatabaseName(parsedUrl);

    return {
      server: parsedUrl.hostname,
      port: this.readPort(parsedUrl),
      user: this.decodeOptionalUrlComponent(parsedUrl.username),
      password: this.decodeOptionalUrlComponent(parsedUrl.password),
      database: databaseName,
      options: {
        encrypt: this.readBooleanSearchParam(parsedUrl.searchParams, "encrypt", true),
        trustServerCertificate: this.readBooleanSearchParam(
          parsedUrl.searchParams,
          "trustServerCertificate",
          false,
        ),
      },
    };
  }

  /**
   * 校验并解析 MSSQL 连接 URL。
   *
   * @param {string} connectionUrl 原始 MSSQL URL。
   * @returns {URL} 解析后的 URL。
   */
  private parseConnectionUrl(connectionUrl: string): URL {
    const validationError = validateMssqlUrl(connectionUrl);

    if (validationError) {
      throw new Error(validationError);
    }

    return new URL(connectionUrl.trim());
  }

  /**
   * 从 URL 中读取端口，缺失时使用 MSSQL 默认端口。
   *
   * @param {URL} parsedUrl 已解析的 MSSQL URL。
   * @returns {number} 端口号。
   */
  private readPort(parsedUrl: URL): number {
    return parsedUrl.port ? Number(parsedUrl.port) : MssqlConnectionAdapter.defaultPort;
  }

  /**
   * 从 URL path 中读取 database 名称。
   *
   * @param {URL} parsedUrl 已解析的 MSSQL URL。
   * @returns {string | undefined} database 名称；未提供时为空。
   */
  private readDatabaseName(parsedUrl: URL): string | undefined {
    const databaseName = parsedUrl.pathname.replace(/^\//, "");
    return databaseName.length > 0 ? decodeURIComponent(databaseName) : undefined;
  }

  /**
   * 读取 URL 中可选的认证字段。
   *
   * @param {string} value URL 用户名或密码字段。
   * @returns {string | undefined} 解码后的字段值；未提供时为空。
   */
  private decodeOptionalUrlComponent(value: string): string | undefined {
    return value.length > 0 ? decodeURIComponent(value) : undefined;
  }

  /**
   * 从 URL query 中读取布尔连接选项。
   *
   * @param {URLSearchParams} searchParams URL query 参数集合。
   * @param {string} key 需要读取的参数名。
   * @param {boolean} defaultValue 未提供参数时使用的默认值。
   * @returns {boolean} 解析后的布尔值。
   */
  private readBooleanSearchParam(
    searchParams: URLSearchParams,
    key: string,
    defaultValue: boolean,
  ): boolean {
    const value = searchParams.get(key);

    if (value === null) {
      return defaultValue;
    }

    if (value === "true") {
      return true;
    }

    if (value === "false") {
      return false;
    }

    throw new Error(`MSSQL URL 参数 ${key} 仅支持 true 或 false。`);
  }
}
