import type { ConnectionRepository } from '../connections/ConnectionRepository';

/**
 * Deletes a stored connection configuration.
 */
export class DeleteStoredConnectionUseCase {
	/**
	 * Creates the delete connection use case.
	 *
	 * @param connectionRepository Repository used to remove stored connections.
	 */
	public constructor(
		private readonly connectionRepository: ConnectionRepository
	) {}

	/**
	 * Deletes a connection by identifier.
	 *
	 * @param id Connection identifier to remove.
	 */
	public async execute(id: string): Promise<void> {
		await this.connectionRepository.delete(id);
	}
}
