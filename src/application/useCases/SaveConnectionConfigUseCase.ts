import type { ConnectionRepository } from '../connections/ConnectionRepository';
import type { ConnectionConfig } from '../../domain/connections/ConnectionConfig';

/**
 * Saves a connection configuration.
 */
export class SaveConnectionConfigUseCase {
	/**
	 * Creates the save connection use case.
	 *
	 * @param connectionRepository Repository used to persist stored connections.
	 */
	public constructor(
		private readonly connectionRepository: ConnectionRepository
	) {}

	/**
	 * Persists a connection configuration.
	 *
	 * @param config Connection configuration to store.
	 */
	public async execute(config: ConnectionConfig): Promise<void> {
		await this.connectionRepository.save(config);
	}
}
