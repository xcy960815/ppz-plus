import type * as vscode from 'vscode';

import { GetBootstrapStatusUseCase } from '../../application/useCases/GetBootstrapStatusUseCase';
import { DeleteStoredConnectionUseCase } from '../../application/useCases/DeleteStoredConnectionUseCase';
import { ListStoredConnectionsUseCase } from '../../application/useCases/ListStoredConnectionsUseCase';
import { SaveConnectionConfigUseCase } from '../../application/useCases/SaveConnectionConfigUseCase';
import { TestConnectionUseCase } from '../../application/useCases/TestConnectionUseCase';
import {
	MYSQL_MVP_CAPABILITY_DECLARATION,
} from '../../domain/capabilities/DatabaseCapabilityDeclaration';
import { InMemoryDatabaseCapabilityCatalog } from '../../infrastructure/capabilities/InMemoryDatabaseCapabilityCatalog';
import { MySqlConnectionAdapter } from '../../infrastructure/mysql/MySqlConnectionAdapter';
import { TcpMySqlConnectionTester } from '../../infrastructure/mysql/TcpMySqlConnectionTester';
import { GlobalStateConnectionRepository } from '../../infrastructure/storage/GlobalStateConnectionRepository';
import { AddMySqlConnectionCommand } from '../commands/AddMySqlConnectionCommand';
import { ManageMySqlConnectionsCommand } from '../commands/ManageMySqlConnectionsCommand';
import { ShowProjectStatusCommand } from '../commands/ShowProjectStatusCommand';
import { ExtensionBootstrap } from './ExtensionBootstrap';

/**
 * Composes the initial extension bootstrap graph.
 *
 * @param context VS Code extension lifecycle context.
 * @returns A bootstrap instance ready for extension activation.
 */
export function createExtensionBootstrap(
	context: vscode.ExtensionContext
): ExtensionBootstrap {
	/**
	 * Stores the capability declarations available during the bootstrap phase.
	 */
	const capabilityCatalog = new InMemoryDatabaseCapabilityCatalog([
		MYSQL_MVP_CAPABILITY_DECLARATION,
	]);

	/**
	 * Stores connection configurations in VS Code global state.
	 */
	const connectionRepository = new GlobalStateConnectionRepository(
		context.globalState
	);

	/**
	 * Normalizes MySQL-specific infrastructure concerns.
	 */
	const mySqlConnectionAdapter = new MySqlConnectionAdapter();

	/**
	 * Probes MySQL endpoints over TCP for the initial connection-test MVP.
	 */
	const connectionTester = new TcpMySqlConnectionTester(mySqlConnectionAdapter);

	/**
	 * Produces the temporary status payload exposed by the presentation layer.
	 */
	const getBootstrapStatusUseCase = new GetBootstrapStatusUseCase(
		capabilityCatalog
	);
	const listStoredConnectionsUseCase = new ListStoredConnectionsUseCase(
		connectionRepository
	);
	const saveConnectionConfigUseCase = new SaveConnectionConfigUseCase(
		connectionRepository
	);
	const deleteStoredConnectionUseCase = new DeleteStoredConnectionUseCase(
		connectionRepository
	);
	const testConnectionUseCase = new TestConnectionUseCase(connectionTester);

	return new ExtensionBootstrap([
		new AddMySqlConnectionCommand(saveConnectionConfigUseCase),
		new ManageMySqlConnectionsCommand(
			listStoredConnectionsUseCase,
			saveConnectionConfigUseCase,
			deleteStoredConnectionUseCase,
			testConnectionUseCase
		),
		new ShowProjectStatusCommand(getBootstrapStatusUseCase),
	]);
}
