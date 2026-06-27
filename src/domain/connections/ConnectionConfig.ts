/**
 * 定义用户描述连接的方式。
 */
export type ConnectionInputMode = 'parameters' | 'url';

interface BaseConnectionConfig {
	readonly id: string;
	readonly name: string;
	readonly engine: 'mysql';
	readonly mode: ConnectionInputMode;
}

export interface MysqlParameterConnectionConfig extends BaseConnectionConfig {
	readonly mode: 'parameters';
	readonly host: string;
	readonly port: number;
	readonly username: string;
	readonly password?: string;
	readonly database?: string;
}

export interface MysqlUrlConnectionConfig extends BaseConnectionConfig {
	readonly mode: 'url';
	readonly url: string;
}

/**
 * 表示 MVP 阶段支持的 MySQL 连接配置变体。
 */
export type MysqlConnectionConfig =
	| MysqlParameterConnectionConfig
	| MysqlUrlConnectionConfig;

/**
 * 表示应用当前支持的连接配置联合类型。
 */
export type ConnectionConfig = MysqlConnectionConfig;
