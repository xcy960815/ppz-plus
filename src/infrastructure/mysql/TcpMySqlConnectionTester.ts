import * as net from 'node:net';

import type { ConnectionTester } from '../../application/connections/ConnectionTester';
import type { ConnectionConfig } from '../../domain/connections/ConnectionConfig';
import { MySqlConnectionAdapter } from './MySqlConnectionAdapter';

/**
 * Tests MySQL connection reachability by opening a TCP socket to the configured endpoint.
 */
export class TcpMySqlConnectionTester implements ConnectionTester {
	/**
	 * Defines the socket timeout used during connection testing.
	 */
	private static readonly timeoutInMilliseconds = 5000;

	/**
	 * Creates the MySQL TCP connection tester.
	 *
	 * @param mySqlConnectionAdapter Adapter used to resolve MySQL endpoints.
	 */
	public constructor(
		private readonly mySqlConnectionAdapter: MySqlConnectionAdapter
	) {}

	/**
	 * Tests whether the configured MySQL endpoint is reachable over TCP.
	 *
	 * @param config Connection configuration to verify.
	 */
	public async test(config: ConnectionConfig): Promise<void> {
		if (!this.mySqlConnectionAdapter.supports(config)) {
			throw new Error('Only MySQL connections are supported in the current MVP.');
		}

		/**
		 * Resolves the endpoint used by the TCP socket probe.
		 */
		const endpoint = this.mySqlConnectionAdapter.resolveEndpoint(config);

		await new Promise<void>((resolve, reject) => {
			/**
			 * Creates the socket used for the reachability probe.
			 */
			const socket = new net.Socket();

			/**
			 * Closes the socket before resolving or rejecting the probe.
			 */
			const finalize = (callback: () => void): void => {
				socket.removeAllListeners();
				socket.destroy();
				callback();
			};

			socket.setTimeout(TcpMySqlConnectionTester.timeoutInMilliseconds);
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
}
