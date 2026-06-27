import type { ConnectionConfig } from '../../domain/connections/ConnectionConfig';
import type { ConnectionTester } from '../connections/ConnectionTester';

/**
 * Tests a connection configuration through the configured connection tester.
 */
export class TestConnectionUseCase {
	/**
	 * Creates the test connection use case.
	 *
	 * @param connectionTester Tester used to verify connectivity.
	 */
	public constructor(private readonly connectionTester: ConnectionTester) {}

	/**
	 * Tests a connection configuration.
	 *
	 * @param config Connection configuration to verify.
	 */
	public async execute(config: ConnectionConfig): Promise<void> {
		await this.connectionTester.test(config);
	}
}
