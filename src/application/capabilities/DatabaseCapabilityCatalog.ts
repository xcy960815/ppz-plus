import type { DatabaseCapabilityDeclaration } from '../../domain/capabilities/DatabaseCapabilityDeclaration';
import type { DatabaseEngine } from '../../domain/database/DatabaseEngine';

/**
 * Provides read access to database capability declarations.
 */
export interface DatabaseCapabilityCatalog {
	/**
	 * Finds a capability declaration by engine identifier.
	 *
	 * @param engine Database engine identifier.
	 * @returns The matching capability declaration when present.
	 */
	find(engine: DatabaseEngine): DatabaseCapabilityDeclaration | undefined;

	/**
	 * Lists all capability declarations available in the catalog.
	 *
	 * @returns An immutable list of capability declarations.
	 */
	list(): readonly DatabaseCapabilityDeclaration[];
}
