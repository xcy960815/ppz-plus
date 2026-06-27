import type {
	ConnectionConfig,
	MysqlConnectionConfig,
} from '../../domain/connections/ConnectionConfig';

/**
 * Describes the network endpoint derived from a MySQL connection configuration.
 */
export interface MySqlConnectionEndpoint {
	readonly host: string;
	readonly port: number;
}

/**
 * Normalizes MySQL-specific connection details for infrastructure services.
 */
export class MySqlConnectionAdapter {
	/**
	 * Checks whether a connection configuration belongs to the MySQL MVP engine.
	 *
	 * @param config Connection configuration under inspection.
	 * @returns Whether the configuration is a MySQL connection.
	 */
	public supports(config: ConnectionConfig): config is MysqlConnectionConfig {
		return config.engine === 'mysql';
	}

	/**
	 * Resolves the TCP endpoint used to reach the MySQL server.
	 *
	 * @param config MySQL connection configuration.
	 * @returns The resolved host and port pair.
	 */
	public resolveEndpoint(config: MysqlConnectionConfig): MySqlConnectionEndpoint {
		if (config.mode === 'parameters') {
			return {
				host: config.host,
				port: config.port,
			};
		}

		/**
		 * Parses the connection URL so network infrastructure can reuse a normalized endpoint.
		 */
		const parsedUrl = new URL(config.url);
		return {
			host: parsedUrl.hostname,
			port: parsedUrl.port ? Number(parsedUrl.port) : 3306,
		};
	}
}
