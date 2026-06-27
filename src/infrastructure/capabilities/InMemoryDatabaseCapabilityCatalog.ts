import type { DatabaseCapabilityCatalog } from '../../application/capabilities/DatabaseCapabilityCatalog';
import type { DatabaseCapabilityDeclaration } from '../../domain/capabilities/DatabaseCapabilityDeclaration';
import type { DatabaseEngine } from '../../domain/database/DatabaseEngine';

/**
 * Stores capability declarations in memory for bootstrap-time composition.
 */
export class InMemoryDatabaseCapabilityCatalog
	implements DatabaseCapabilityCatalog
{
	/**
	 * Creates an in-memory capability catalog.
	 *
	 * @param declarations Capability declarations available to the application.
	 */
	public constructor(
		private readonly declarations: readonly DatabaseCapabilityDeclaration[]
	) {}

	/**
	 * Finds a declaration by database engine.
	 *
	 * @param engine Database engine identifier.
	 * @returns The matching declaration when present.
	 */
	public find(
		engine: DatabaseEngine
	): DatabaseCapabilityDeclaration | undefined {
		return this.declarations.find((declaration) => declaration.engine === engine);
	}

	/**
	 * Returns all declarations stored in memory.
	 *
	 * @returns An immutable declaration list.
	 */
	public list(): readonly DatabaseCapabilityDeclaration[] {
		return this.declarations;
	}
}
