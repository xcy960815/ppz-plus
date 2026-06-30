/**
 * 定义用户描述连接的方式。
 */
export type ConnectionInputMode = 'parameters' | 'url' | 'file';

interface BaseConnectionConfig {
	readonly id: string;
	readonly name: string;
	readonly engine: 'mysql' | 'postgresql' | 'sqlite3';
	readonly mode: ConnectionInputMode;
}

interface MysqlBaseConnectionConfig extends BaseConnectionConfig {
	readonly engine: 'mysql';
}

interface PostgreSqlBaseConnectionConfig extends BaseConnectionConfig {
	readonly engine: 'postgresql';
}

interface Sqlite3BaseConnectionConfig extends BaseConnectionConfig {
	readonly engine: 'sqlite3';
}

export interface MysqlParameterConnectionConfig
	extends MysqlBaseConnectionConfig {
	readonly mode: 'parameters';
	readonly host: string;
	readonly port: number;
	readonly username: string;
	readonly password?: string;
	readonly database?: string;
}

export interface MysqlUrlConnectionConfig extends MysqlBaseConnectionConfig {
	readonly mode: 'url';
	readonly url: string;
}

/**
 * 表示 MVP 阶段支持的 MySQL 连接配置变体。
 */
export type MysqlConnectionConfig =
	| MysqlParameterConnectionConfig
	| MysqlUrlConnectionConfig;

export interface PostgreSqlParameterConnectionConfig
	extends PostgreSqlBaseConnectionConfig {
	readonly mode: 'parameters';
	readonly host: string;
	readonly port: number;
	readonly username: string;
	readonly password?: string;
	readonly database?: string;
}

export interface PostgreSqlUrlConnectionConfig
	extends PostgreSqlBaseConnectionConfig {
	readonly mode: 'url';
	readonly url: string;
}

/**
 * 表示 PostgreSQL 连接配置变体。
 */
export type PostgreSqlConnectionConfig =
	| PostgreSqlParameterConnectionConfig
	| PostgreSqlUrlConnectionConfig;

export interface Sqlite3ConnectionConfig extends Sqlite3BaseConnectionConfig {
	readonly mode: 'file';
	readonly dbPath: string;
}

/**
 * 表示应用当前支持的连接配置联合类型。
 */
export type ConnectionConfig =
	| MysqlConnectionConfig
	| PostgreSqlConnectionConfig
	| Sqlite3ConnectionConfig;
