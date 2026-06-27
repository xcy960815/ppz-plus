import { randomUUID } from 'node:crypto';

import * as vscode from 'vscode';

import type { SaveConnectionConfigUseCase } from '../../application/useCases/SaveConnectionConfigUseCase';
import type {
	ConnectionConfig,
	ConnectionInputMode,
	MysqlConnectionConfig,
} from '../../domain/connections/ConnectionConfig';
import type { ExtensionCommand } from './ExtensionCommand';
import { MySqlConnectionsTreeDataProvider } from '../explorer/MySqlConnectionsTreeDataProvider';

/**
 * Creates new MySQL connection configurations through VS Code quick input prompts.
 */
export class AddMySqlConnectionCommand implements ExtensionCommand {
	/**
	 * Stores the VS Code command identifier.
	 */
	public static readonly id = 'ppz-plus.addMySqlConnection';

	/**
	 * Exposes the command identifier through the command contract.
	 */
	public readonly id = AddMySqlConnectionCommand.id;

	/**
	 * Creates the add MySQL connection command.
	 *
	 * @param saveConnectionConfigUseCase Use case used to persist new connections.
	 */
	public constructor(
		private readonly saveConnectionConfigUseCase: SaveConnectionConfigUseCase,
		private readonly treeDataProvider: MySqlConnectionsTreeDataProvider
	) {}

	/**
	 * Registers the command with VS Code.
	 *
	 * @returns A disposable command registration.
	 */
	public register(): vscode.Disposable {
		return vscode.commands.registerCommand(this.id, async () => {
			const config = await this.promptForConnectionConfig();
			if (!config) {
				return;
			}

			await this.saveConnectionConfigUseCase.execute(config);
			this.treeDataProvider.refresh();
			await vscode.window.showInformationMessage(
				`Saved MySQL connection "${config.name}".`
			);
		});
	}

	/**
	 * Prompts the user for a new connection configuration.
	 *
	 * @returns The new connection configuration when the prompt flow completes.
	 */
	private async promptForConnectionConfig(): Promise<ConnectionConfig | undefined> {
		const mode = await this.promptForConnectionMode();
		if (!mode) {
			return undefined;
		}

		return this.promptForMySqlConfig(mode);
	}

	/**
	 * Prompts the user for the connection input mode.
	 *
	 * @returns The selected input mode.
	 */
	private async promptForConnectionMode(): Promise<
		ConnectionInputMode | undefined
	> {
		const selection = await vscode.window.showQuickPick(
			[
				{
					label: 'Parameter Fields',
					description: 'Host, port, username, password, and database',
					value: 'parameters' as const,
				},
				{
					label: 'Connection URL',
					description: 'Use a mysql:// URL',
					value: 'url' as const,
				},
			],
			{
				placeHolder: 'Choose how to define the MySQL connection',
				title: 'PPZ Plus: Add MySQL Connection',
			}
		);

		return selection?.value;
	}

	/**
	 * Prompts the user for MySQL connection details.
	 *
	 * @param mode Selected connection input mode.
	 * @param existingConfig Existing configuration when editing.
	 * @returns The resulting MySQL connection configuration.
	 */
	public static async collectMySqlConfig(
		mode: ConnectionInputMode,
		existingConfig?: MysqlConnectionConfig
	): Promise<MysqlConnectionConfig | undefined> {
		const name = await vscode.window.showInputBox({
			title: 'PPZ Plus: MySQL Connection Name',
			prompt: 'Enter the display name for the connection',
			value: existingConfig?.name ?? 'MySQL Connection',
			validateInput: (value) =>
				value.trim().length > 0 ? undefined : 'Connection name is required.',
		});
		if (!name) {
			return undefined;
		}

		/**
		 * Preserves the existing identifier during edits and generates one for new connections.
		 */
		const connectionId = existingConfig?.id ?? randomUUID();

		if (mode === 'url') {
			const url = await vscode.window.showInputBox({
				title: 'PPZ Plus: MySQL Connection URL',
				prompt: 'Enter a mysql:// connection URL',
				value:
					existingConfig?.mode === 'url'
						? existingConfig.url
						: 'mysql://root:password@127.0.0.1:3306/mysql',
				validateInput: (value) => AddMySqlConnectionCommand.validateMysqlUrl(value),
			});
			if (!url) {
				return undefined;
			}

			return {
				id: connectionId,
				engine: 'mysql',
				mode: 'url',
				name: name.trim(),
				url,
			};
		}

		const host = await vscode.window.showInputBox({
			title: 'PPZ Plus: MySQL Host',
			prompt: 'Enter the MySQL server host',
			value:
				existingConfig?.mode === 'parameters'
					? existingConfig.host
					: '127.0.0.1',
			validateInput: (value) =>
				value.trim().length > 0 ? undefined : 'Host is required.',
		});
		if (!host) {
			return undefined;
		}

		const portInput = await vscode.window.showInputBox({
			title: 'PPZ Plus: MySQL Port',
			prompt: 'Enter the MySQL server port',
			value:
				existingConfig?.mode === 'parameters'
					? String(existingConfig.port)
					: '3306',
			validateInput: (value) =>
				AddMySqlConnectionCommand.parsePort(value) === undefined
					? 'Port must be a positive integer.'
					: undefined,
		});
		if (!portInput) {
			return undefined;
		}

		const username = await vscode.window.showInputBox({
			title: 'PPZ Plus: MySQL Username',
			prompt: 'Enter the MySQL username',
			value:
				existingConfig?.mode === 'parameters'
					? existingConfig.username
					: 'root',
			validateInput: (value) =>
				value.trim().length > 0 ? undefined : 'Username is required.',
		});
		if (!username) {
			return undefined;
		}

		const password = await vscode.window.showInputBox({
			title: 'PPZ Plus: MySQL Password',
			prompt: 'Enter the MySQL password (optional)',
			password: true,
			value:
				existingConfig?.mode === 'parameters'
					? existingConfig.password ?? ''
					: '',
		});
		if (password === undefined) {
			return undefined;
		}

		const database = await vscode.window.showInputBox({
			title: 'PPZ Plus: Default Database',
			prompt: 'Enter the default database (optional)',
			value:
				existingConfig?.mode === 'parameters'
					? existingConfig.database ?? ''
					: '',
		});
		if (database === undefined) {
			return undefined;
		}

		return {
			id: connectionId,
			engine: 'mysql',
			mode: 'parameters',
			name: name.trim(),
			host: host.trim(),
			port: AddMySqlConnectionCommand.parsePort(portInput) ?? 3306,
			username: username.trim(),
			password: password || undefined,
			database: database.trim() || undefined,
		};
	}

	/**
	 * Delegates to the static MySQL prompt flow for new connections.
	 *
	 * @param mode Selected connection mode.
	 * @param existingConfig Existing configuration when editing.
	 * @returns The collected MySQL connection configuration.
	 */
	private async promptForMySqlConfig(
		mode: ConnectionInputMode,
		existingConfig?: MysqlConnectionConfig
	): Promise<MysqlConnectionConfig | undefined> {
		return AddMySqlConnectionCommand.collectMySqlConfig(mode, existingConfig);
	}

	/**
	 * Validates a MySQL connection URL.
	 *
	 * @param value Raw URL string.
	 * @returns A validation message when invalid.
	 */
	private static validateMysqlUrl(value: string): string | undefined {
		try {
			const parsedUrl = new URL(value);
			return parsedUrl.protocol === 'mysql:'
				? undefined
				: 'URL must start with mysql://';
		} catch {
			return 'Enter a valid mysql:// URL.';
		}
	}

	/**
	 * Parses a port input string.
	 *
	 * @param value Raw port value.
	 * @returns The parsed port when valid.
	 */
	private static parsePort(value: string): number | undefined {
		const parsedPort = Number(value);
		return Number.isInteger(parsedPort) && parsedPort > 0
			? parsedPort
			: undefined;
	}
}
