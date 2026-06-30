import * as net from 'node:net';

import type { ConnectionTester } from '../../application/connections/ConnectionTester';
import type { ConnectionConfig } from '../../domain/connections/ConnectionConfig';
import { MySqlConnectionAdapter } from '../mysql/MySqlConnectionAdapter';
import { PostgreSqlConnectionAdapter } from '../postgresql/PostgreSqlConnectionAdapter';

/**
 * 描述 TCP 连接测试使用的网络端点。
 */
interface TcpConnectionEndpoint {
	readonly host: string;
	readonly port: number;
}

/**
 * 通过打开 TCP socket 测试当前支持数据库的端点可达性。
 */
export class TcpDatabaseConnectionTester implements ConnectionTester {
	/**
	 * 定义连接测试使用的 socket 超时时间。
	 */
	private static readonly timeoutInMilliseconds = 5000;

	/**
	 * 创建通用 TCP 连接测试器。
	 *
	 * @param mySqlConnectionAdapter 用于解析 MySQL 端点的适配器。
	 * @param postgreSqlConnectionAdapter 用于解析 PostgreSQL 端点的适配器。
	 */
	public constructor(
		private readonly mySqlConnectionAdapter: MySqlConnectionAdapter,
		private readonly postgreSqlConnectionAdapter: PostgreSqlConnectionAdapter
	) {}

	/**
	 * 测试配置的数据库端点是否可通过 TCP 访问。
	 *
	 * @param {ConnectionConfig} config 待验证的连接配置。
	 */
	public async test(config: ConnectionConfig): Promise<void> {
		const endpoint = this.resolveEndpoint(config);

		await new Promise<void>((resolve, reject) => {
			const socket = new net.Socket();

			/**
			 * 在完成或拒绝探测前关闭 socket。
			 */
			const finalize = (callback: () => void): void => {
				socket.removeAllListeners();
				socket.destroy();
				callback();
			};

			socket.setTimeout(TcpDatabaseConnectionTester.timeoutInMilliseconds);
			socket.once('connect', () => finalize(resolve));
			socket.once('timeout', () =>
				finalize(() =>
					reject(
						new Error(
							`Timed out while connecting to ${endpoint.host}:${endpoint.port}.`
						)
					)
				)
			);
			socket.once('error', (error) =>
				finalize(() =>
					reject(
						new Error(
							`Could not reach ${endpoint.host}:${endpoint.port}: ${error.message}`
						)
					)
				)
			);
			socket.connect(endpoint.port, endpoint.host);
		});
	}

	/**
	 * 根据连接类型解析 TCP 端点。
	 *
	 * @param {ConnectionConfig} config 待测试连接配置。
	 * @returns {TcpConnectionEndpoint} 当前连接对应的 TCP 端点。
	 */
	private resolveEndpoint(config: ConnectionConfig): TcpConnectionEndpoint {
		if (this.mySqlConnectionAdapter.supports(config)) {
			return this.mySqlConnectionAdapter.resolveEndpoint(config);
		}

		if (this.postgreSqlConnectionAdapter.supports(config)) {
			return this.postgreSqlConnectionAdapter.resolveEndpoint(config);
		}

		throw new Error('暂不支持测试当前数据库连接。');
	}
}
