import type {
	ConnectionConfig,
	MysqlConnectionConfig,
} from '../../domain/connections/ConnectionConfig';

/**
 * 描述从 MySQL 连接配置解析出的网络端点。
 */
export interface MySqlConnectionEndpoint {
	readonly host: string;
	readonly port: number;
}

/**
 * 描述 mysql2 promise 客户端需要的运行时驱动选项。
 */
export interface MySqlDriverOptions {
	readonly uri?: string;
	readonly host?: string;
	readonly port?: number;
	readonly user?: string;
	readonly password?: string;
	readonly database?: string;
	readonly multipleStatements?: boolean;
}

/**
 * 表示 mysql2 接收的运行时连接输入。
 */
export type MySqlDriverConnectionInput = MySqlDriverOptions | string;

/**
 * 为基础设施服务归一化 MySQL 连接细节。
 */
export class MySqlConnectionAdapter {
	/**
	 * 检查连接配置是否属于 MySQL MVP 引擎。
	 *
	 * @param {ConnectionConfig} config 正在检查的连接配置。
	 * @returns {config is MysqlConnectionConfig} 该配置是否为 MySQL 连接。
	 */
	public supports(config: ConnectionConfig): config is MysqlConnectionConfig {
		return config.engine === 'mysql';
	}

	/**
	 * 解析访问 MySQL 服务使用的 TCP 端点。
	 *
	 * @param {MysqlConnectionConfig} config MySQL 连接配置。
	 * @returns {MySqlConnectionEndpoint} 解析出的 host 和 port。
	 */
	public resolveEndpoint(config: MysqlConnectionConfig): MySqlConnectionEndpoint {
		if (config.mode === 'parameters') {
			return {
				host: config.host,
				port: config.port,
			};
		}

		/**
		 * 解析连接 URL，便于网络基础设施复用归一化端点。
		 */
		const parsedUrl = new URL(config.url);
		return {
			host: parsedUrl.hostname,
			port: parsedUrl.port ? Number(parsedUrl.port) : 3306,
		};
	}

	/**
	 * 解析 MySQL 配置对应的 mysql2 运行时连接选项。
	 *
	 * @param {MysqlConnectionConfig} config MySQL 连接配置。
	 * @returns {MySqlDriverConnectionInput} 归一化后的 mysql2 运行时连接选项。
	 */
	public resolveDriverOptions(
		config: MysqlConnectionConfig
	): MySqlDriverConnectionInput {
		if (config.mode === 'parameters') {
			return {
				host: config.host,
				port: config.port,
				user: config.username,
				password: config.password,
				database: config.database,
			};
		}

		return config.url;
	}
}
