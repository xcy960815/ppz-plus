/**
 * Defines how a connection is described by the user.
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
 * Represents the MySQL connection variants supported in the MVP.
 */
export type MysqlConnectionConfig =
	| MysqlParameterConnectionConfig
	| MysqlUrlConnectionConfig;

/**
 * Represents the connection configuration union supported by the application.
 */
export type ConnectionConfig = MysqlConnectionConfig;
