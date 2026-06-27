import type { ConnectionRepository } from '../connections/ConnectionRepository';
import type { ConnectionConfig } from '../../domain/connections/ConnectionConfig';

/**
 * Lists stored connection configurations.
 */
export class ListStoredConnectionsUseCase {
	/**
	 * Creates the list connections use case.
	 *
	 * @param connectionRepository Repository used to read stored connections.
	 */
	public constructor(
		private readonly connectionRepository: ConnectionRepository
	) {}

	/**
	 * Returns all stored connection configurations.
	 *
	 * @returns Stored connection records.
	 */
	public async execute(): Promise<readonly ConnectionConfig[]> {
		return this.connectionRepository.list();
	}
}
