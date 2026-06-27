import type { DatabaseCapabilityCatalog } from '../capabilities/DatabaseCapabilityCatalog';
import { DATABASE_CAPABILITY_KEYS } from '../../domain/capabilities/DatabaseCapabilityDeclaration';

/**
 * Describes the bootstrap information shown by the temporary status command.
 */
export interface BootstrapStatus {
	readonly focusEngine: string;
	readonly supportedCapabilities: readonly string[];
	readonly plannedEngines: readonly string[];
}

/**
 * Builds a lightweight bootstrap summary for the current extension state.
 */
export class GetBootstrapStatusUseCase {
	/**
	 * Creates a bootstrap status use case.
	 *
	 * @param capabilityCatalog Capability source used to summarize engine support.
	 */
	public constructor(
		private readonly capabilityCatalog: DatabaseCapabilityCatalog
	) {}

	/**
	 * Produces the bootstrap status payload consumed by presentation commands.
	 *
	 * @returns The current bootstrap status snapshot.
	 */
	public execute(): BootstrapStatus {
		/**
		 * Captures the MySQL capability declaration used as the MVP baseline.
		 */
		const mysqlCapabilities = this.capabilityCatalog.find('mysql');

		/**
		 * Lists the capabilities already marked as supported for the MVP engine.
		 */
		const supportedCapabilities = mysqlCapabilities
			? DATABASE_CAPABILITY_KEYS.filter(
					(key) => mysqlCapabilities.capabilities[key] === 'supported'
				)
			: [];

		/**
		 * Lists the engines reserved for later phases beyond the MySQL MVP.
		 */
		const plannedEngines = this.capabilityCatalog
			.list()
			.map((declaration) => declaration.engine)
			.filter((engine) => engine !== 'mysql');

		return {
			focusEngine: 'mysql',
			supportedCapabilities,
			plannedEngines,
		};
	}
}
