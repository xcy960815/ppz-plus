import type { ConnectionConfig } from '../../domain/connections/ConnectionConfig';

/**
 * Persists and retrieves stored connection configurations.
 */
export interface ConnectionRepository {
	/**
	 * Lists all stored connection configurations.
	 *
	 * @returns The stored connections in display order.
	 */
	list(): Promise<readonly ConnectionConfig[]>;

	/**
	 * Finds a stored connection by identifier.
	 *
	 * @param id Connection identifier.
	 * @returns The matching connection when present.
	 */
	find(id: string): Promise<ConnectionConfig | undefined>;

	/**
	 * Saves a connection configuration, replacing any existing record with the same identifier.
	 *
	 * @param config Connection configuration to persist.
	 */
	save(config: ConnectionConfig): Promise<void>;

	/**
	 * Deletes a stored connection configuration.
	 *
	 * @param id Connection identifier to remove.
	 */
	delete(id: string): Promise<void>;
}
