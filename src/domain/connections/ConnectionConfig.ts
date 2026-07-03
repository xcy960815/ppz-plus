/**
 * 定义用户描述连接的方式。
 */
export type ConnectionInputMode = "parameters" | "url" | "file";

interface BaseConnectionConfig {
  readonly id: string;
  readonly name: string;
  readonly engine: "mysql" | "postgresql" | "sqlite3" | "mssql" | "cockroachdb" | "mariadb";
  readonly mode: ConnectionInputMode;
}

interface MysqlBaseConnectionConfig extends BaseConnectionConfig {
  readonly engine: "mysql";
}

interface PostgreSqlBaseConnectionConfig extends BaseConnectionConfig {
  readonly engine: "postgresql";
}

interface Sqlite3BaseConnectionConfig extends BaseConnectionConfig {
  readonly engine: "sqlite3";
}

interface MssqlBaseConnectionConfig extends BaseConnectionConfig {
  readonly engine: "mssql";
}

interface CockroachDbBaseConnectionConfig extends BaseConnectionConfig {
  readonly engine: "cockroachdb";
}

interface MariaDbBaseConnectionConfig extends BaseConnectionConfig {
  readonly engine: "mariadb";
}

export interface MysqlParameterConnectionConfig extends MysqlBaseConnectionConfig {
  readonly mode: "parameters";
  readonly host: string;
  readonly port: number;
  readonly username: string;
  readonly password?: string;
  readonly database?: string;
  readonly hasPassword?: boolean;
}

export interface MysqlUrlConnectionConfig extends MysqlBaseConnectionConfig {
  readonly mode: "url";
  readonly url: string;
  readonly hasPassword?: boolean;
}

/**
 * 表示 MVP 阶段支持的 MySQL 连接配置变体。
 */
export type MysqlConnectionConfig = MysqlParameterConnectionConfig | MysqlUrlConnectionConfig;

export interface PostgreSqlParameterConnectionConfig extends PostgreSqlBaseConnectionConfig {
  readonly mode: "parameters";
  readonly host: string;
  readonly port: number;
  readonly username: string;
  readonly password?: string;
  readonly database?: string;
  readonly hasPassword?: boolean;
}

export interface PostgreSqlUrlConnectionConfig extends PostgreSqlBaseConnectionConfig {
  readonly mode: "url";
  readonly url: string;
  readonly hasPassword?: boolean;
}

/**
 * 表示 PostgreSQL 连接配置变体。
 */
export type PostgreSqlConnectionConfig =
  PostgreSqlParameterConnectionConfig | PostgreSqlUrlConnectionConfig;

export interface Sqlite3ConnectionConfig extends Sqlite3BaseConnectionConfig {
  readonly mode: "file";
  readonly dbPath: string;
}

export interface MssqlParameterConnectionConfig extends MssqlBaseConnectionConfig {
  readonly mode: "parameters";
  readonly host: string;
  readonly port: number;
  readonly username: string;
  readonly password?: string;
  readonly database?: string;
  readonly encrypt: boolean;
  readonly trustServerCertificate: boolean;
  readonly hasPassword?: boolean;
}

export interface MssqlUrlConnectionConfig extends MssqlBaseConnectionConfig {
  readonly mode: "url";
  readonly url: string;
  readonly hasPassword?: boolean;
}

/**
 * 表示 MSSQL 连接配置变体。
 */
export type MssqlConnectionConfig = MssqlParameterConnectionConfig | MssqlUrlConnectionConfig;

export interface CockroachDbParameterConnectionConfig extends CockroachDbBaseConnectionConfig {
  readonly mode: "parameters";
  readonly host: string;
  readonly port: number;
  readonly username: string;
  readonly password?: string;
  readonly database?: string;
  readonly ssl: boolean;
  readonly hasPassword?: boolean;
}

export interface CockroachDbUrlConnectionConfig extends CockroachDbBaseConnectionConfig {
  readonly mode: "url";
  readonly url: string;
  readonly hasPassword?: boolean;
}

/**
 * 表示 CockroachDB 连接配置变体。
 */
export type CockroachDbConnectionConfig =
  CockroachDbParameterConnectionConfig | CockroachDbUrlConnectionConfig;

export interface MariaDbParameterConnectionConfig extends MariaDbBaseConnectionConfig {
  readonly mode: "parameters";
  readonly host: string;
  readonly port: number;
  readonly username: string;
  readonly password?: string;
  readonly database?: string;
  readonly hasPassword?: boolean;
}

export interface MariaDbUrlConnectionConfig extends MariaDbBaseConnectionConfig {
  readonly mode: "url";
  readonly url: string;
  readonly hasPassword?: boolean;
}

/**
 * 表示 MariaDB 连接配置变体。
 */
export type MariaDbConnectionConfig = MariaDbParameterConnectionConfig | MariaDbUrlConnectionConfig;

/**
 * 表示应用当前支持的连接配置联合类型。
 */
export type ConnectionConfig =
  | MysqlConnectionConfig
  | PostgreSqlConnectionConfig
  | Sqlite3ConnectionConfig
  | MssqlConnectionConfig
  | CockroachDbConnectionConfig
  | MariaDbConnectionConfig;
