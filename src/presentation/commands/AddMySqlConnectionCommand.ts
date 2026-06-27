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
 * 通过 VS Code 快速输入流程创建新的 MySQL 连接配置。
 */
export class AddMySqlConnectionCommand implements ExtensionCommand {
	/**
	 * 保存 VS Code 命令标识。
	 */
	public static readonly id = 'ppz-plus.addMySqlConnection';

	/**
	 * 通过命令契约暴露命令标识。
	 */
	public readonly id = AddMySqlConnectionCommand.id;

	/**
	 * 创建新增 MySQL 连接命令。
	 *
	 * @param saveConnectionConfigUseCase 用于持久化新连接的用例。
	 */
	public constructor(
		private readonly saveConnectionConfigUseCase: SaveConnectionConfigUseCase,
		private readonly treeDataProvider: MySqlConnectionsTreeDataProvider
	) {}

	/**
	 * 向 VS Code 注册命令。
	 *
	 * @returns 命令注册的可释放句柄。
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
	 * 提示用户填写新的连接配置。
	 *
	 * @returns 输入流程完成后得到的新连接配置。
	 */
	private async promptForConnectionConfig(): Promise<ConnectionConfig | undefined> {
		const mode = await this.promptForConnectionMode();
		if (!mode) {
			return undefined;
		}

		return this.promptForMySqlConfig(mode);
	}

	/**
	 * 提示用户选择连接输入模式。
	 *
	 * @returns 用户选择的输入模式。
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
	 * 提示用户填写 MySQL 连接详情。
	 *
	 * @param mode 用户选择的连接输入模式。
	 * @param existingConfig 编辑时已有的连接配置。
	 * @returns 最终得到的 MySQL 连接配置。
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
		 * 编辑时保留原有标识，新建时生成新的标识。
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
	 * 委托静态 MySQL 输入流程收集新连接配置。
	 *
	 * @param mode 用户选择的连接模式。
	 * @param existingConfig 编辑时已有的连接配置。
	 * @returns 收集完成的 MySQL 连接配置。
	 */
	private async promptForMySqlConfig(
		mode: ConnectionInputMode,
		existingConfig?: MysqlConnectionConfig
	): Promise<MysqlConnectionConfig | undefined> {
		return AddMySqlConnectionCommand.collectMySqlConfig(mode, existingConfig);
	}

	/**
	 * 校验 MySQL 连接 URL。
	 *
	 * @param value 原始 URL 字符串。
	 * @returns 无效时返回的校验提示。
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
	 * 解析端口输入字符串。
	 *
	 * @param value 原始端口值。
	 * @returns 有效时解析出的端口号。
	 */
	private static parsePort(value: string): number | undefined {
		const parsedPort = Number(value);
		return Number.isInteger(parsedPort) && parsedPort > 0
			? parsedPort
			: undefined;
	}
}
