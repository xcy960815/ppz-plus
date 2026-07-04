/**
 * 描述 mssql/tedious 驱动使用的 TLS 选项。
 */
export interface MssqlDriverSecurityOptions {
  readonly encrypt: boolean;
  readonly trustServerCertificate: boolean;
}

/**
 * 描述 mssql 连接池需要的最小运行时配置。
 */
export interface MssqlDriverOptions {
  readonly server: string;
  readonly port?: number;
  readonly user?: string;
  readonly password?: string;
  readonly database?: string;
  readonly options: MssqlDriverSecurityOptions;
}

/**
 * 描述 mssql 查询返回的结果集结构。
 */
export interface MssqlRuntimeQueryResult {
  readonly recordset?: ReadonlyArray<Record<string, unknown>>;
}

/**
 * 描述 mssql 请求对象的最小查询能力。
 */
export interface MssqlRuntimeRequest {
  query(sql: string): Promise<MssqlRuntimeQueryResult>;
}

/**
 * 描述 mssql 连接池的最小生命周期能力。
 */
export interface MssqlRuntimeConnectionPool {
  connect(): Promise<MssqlRuntimeConnectionPool>;
  close(): Promise<void>;
  request(): MssqlRuntimeRequest;
}

/**
 * 描述 mssql 连接池构造器。
 */
export interface MssqlRuntimeConnectionPoolConstructor {
  new (config: MssqlDriverOptions): MssqlRuntimeConnectionPool;
}

/**
 * 描述动态加载到的 mssql 运行时模块。
 */
export interface MssqlRuntimeModule {
  readonly ConnectionPool: MssqlRuntimeConnectionPoolConstructor;
}
