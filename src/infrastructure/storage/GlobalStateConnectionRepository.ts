import type * as vscode from 'vscode';

import type { ConnectionRepository } from '../../application/connections/ConnectionRepository';
import type { ConnectionConfig } from '../../domain/connections/ConnectionConfig';

/**
 * Stores connection configurations in VS Code global state.
 */
export class GlobalStateConnectionRepository
	implements ConnectionRepository
{
	/**
	 * Defines the global state key used to store connection records.
	 */
	private static readonly storageKey = 'ppz-plus.connections';

	/**
	 * Creates the global-state-backed connection repository.
	 *
	 * @param globalState VS Code global state storage.
	 */
	public constructor(private readonly globalState: vscode.Memento) {}

	/**
	 * Lists all stored connection configurations.
	 *
	 * @returns Stored connection configurations.
	 */
	public async list(): Promise<readonly ConnectionConfig[]> {
		return this.readConnections();
	}

	/**
	 * Finds a stored connection by identifier.
	 *
	 * @param id Connection identifier.
	 * @returns The matching stored connection when present.
	 */
	public async find(id: string): Promise<ConnectionConfig | undefined> {
		const connections = this.readConnections();
		return connections.find((connection) => connection.id === id);
	}

	/**
	 * Saves a connection configuration, replacing any existing connection with the same identifier.
	 *
	 * @param config Connection configuration to persist.
	 */
	public async save(config: ConnectionConfig): Promise<void> {
		const connections = this.readConnections();
		const existingIndex = connections.findIndex(
			(connection) => connection.id === config.id
		);

		/**
		 * Builds the next stored connection list after the upsert operation.
		 */
		const nextConnections =
			existingIndex === -1
				? [...connections, config]
				: connections.map((connection, index) =>
						index === existingIndex ? config : connection
					);

		await this.globalState.update(
			GlobalStateConnectionRepository.storageKey,
			nextConnections
		);
	}

	/**
	 * Deletes a stored connection configuration.
	 *
	 * @param id Connection identifier to remove.
	 */
	public async delete(id: string): Promise<void> {
		const connections = this.readConnections().filter(
			(connection) => connection.id !== id
		);
		await this.globalState.update(
			GlobalStateConnectionRepository.storageKey,
			connections
		);
	}

	/**
	 * Reads the stored connection list from VS Code global state.
	 *
	 * @returns The stored connection list.
	 */
	private readConnections(): ConnectionConfig[] {
		return this.globalState.get<ConnectionConfig[]>(
			GlobalStateConnectionRepository.storageKey,
			[]
		);
	}
}
