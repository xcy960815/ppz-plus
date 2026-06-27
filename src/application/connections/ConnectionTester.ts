import type { ConnectionConfig } from '../../domain/connections/ConnectionConfig';

/**
 * Tests whether a connection configuration can reach its target service.
 */
export interface ConnectionTester {
	/**
	 * Verifies a connection configuration.
	 *
	 * @param config Connection configuration to test.
	 */
	test(config: ConnectionConfig): Promise<void>;
}
