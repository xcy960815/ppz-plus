import { randomUUID } from 'node:crypto';

import * as vscode from 'vscode';

import type { SaveConnectionConfigUseCase } from '../../application/useCases/SaveConnectionConfigUseCase';
import type { TestConnectionUseCase } from '../../application/useCases/TestConnectionUseCase';
import type {
	ConnectionInputMode,
	MysqlConnectionConfig,
} from '../../domain/connections/ConnectionConfig';
import type { ExtensionCommand } from './ExtensionCommand';
import { withMySqlConnectionTestProgress } from './MySqlConnectionProgressPresenter';
import {
	extractUserErrorMessage,
	showUserErrorMessage,
} from './UserErrorPresenter';
import { MySqlConnectionsTreeDataProvider } from '../explorer/MySqlConnectionsTreeDataProvider';

/**
 * 描述连接表单 Webview 发回的保存动作。
 */
interface MySqlConnectionFormSaveMessage {
	readonly type: 'save' | 'saveAndTest';
	readonly payload: MySqlConnectionFormPayload;
}

/**
 * 描述连接表单 Webview 发回的原始字段。
 */
interface MySqlConnectionFormPayload {
	readonly name: string;
	readonly mode: ConnectionInputMode;
	readonly host: string;
	readonly port: string;
	readonly username: string;
	readonly password: string;
	readonly database: string;
	readonly url: string;
}

/**
 * 描述连接表单 Webview 可发送的消息。
 */
type MySqlConnectionFormMessage = MySqlConnectionFormSaveMessage;

/**
 * 通过 VS Code Webview 表单创建新的 MySQL 连接配置。
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
	 * @param testConnectionUseCase 用于测试新连接可达性的用例。
	 * @param treeDataProvider 用于刷新 MySQL 连接树。
	 */
	public constructor(
		private readonly saveConnectionConfigUseCase: SaveConnectionConfigUseCase,
		private readonly testConnectionUseCase: TestConnectionUseCase,
		private readonly treeDataProvider: MySqlConnectionsTreeDataProvider
	) {}

	/**
	 * 向 VS Code 注册命令。
	 *
	 * @returns 命令注册的可释放句柄。
	 */
	public register(): vscode.Disposable {
		return vscode.commands.registerCommand(this.id, () => {
			this.openConnectionForm();
		});
	}

	/**
	 * 打开 MySQL 新增连接表单。
	 */
	private openConnectionForm(): void {
		const panel = vscode.window.createWebviewPanel(
			'ppzPlus.addMySqlConnection',
			'创建连接',
			vscode.ViewColumn.Active,
			{
				enableScripts: true,
			}
		);

		panel.webview.html = this.renderConnectionFormHtml();
		panel.webview.onDidReceiveMessage(
			async (message: MySqlConnectionFormMessage) => {
				await this.handleConnectionFormMessage(panel, message);
			}
		);
	}

	/**
	 * 处理连接表单提交动作。
	 *
	 * @param panel 当前连接表单面板。
	 * @param message Webview 发回的表单消息。
	 */
	private async handleConnectionFormMessage(
		panel: vscode.WebviewPanel,
		message: MySqlConnectionFormMessage
	): Promise<void> {
		const config = this.createConfigFromFormPayload(message.payload);
		if (!config.success) {
			await vscode.window.showErrorMessage(config.errorMessage);
			return;
		}

		try {
			await this.saveConnectionConfigUseCase.execute(config.value);
		} catch (error) {
			await showUserErrorMessage({
				operation: 'Save MySQL connection',
				error,
			});
			return;
		}

		this.treeDataProvider.refresh();

		if (message.type === 'saveAndTest') {
			try {
				await withMySqlConnectionTestProgress(config.value, () =>
					this.testConnectionUseCase.execute(config.value)
				);
				await vscode.window.showInformationMessage(
					`Saved and connected to MySQL connection "${config.value.name}".`
				);
				panel.dispose();
			} catch (error) {
				await vscode.window.showWarningMessage(
					`Saved "${config.value.name}", but connection test failed: ${extractUserErrorMessage(error)}`
				);
			}
			return;
		}

		await vscode.window.showInformationMessage(
			`Saved MySQL connection "${config.value.name}".`
		);
		panel.dispose();
	}

	/**
	 * 将 Webview 表单字段转换为 MySQL 连接配置。
	 *
	 * @param payload Webview 发回的原始字段。
	 * @returns 转换成功时返回连接配置，否则返回错误信息。
	 */
	private createConfigFromFormPayload(payload: MySqlConnectionFormPayload):
		| {
				readonly success: true;
				readonly value: MysqlConnectionConfig;
		  }
		| {
				readonly success: false;
				readonly errorMessage: string;
		  } {
		const name = payload.name.trim();
		if (name.length === 0) {
			return {
				success: false,
				errorMessage: 'Connection name is required.',
			};
		}

		if (payload.mode === 'url') {
			const urlValidation = AddMySqlConnectionCommand.validateMysqlUrl(
				payload.url
			);
			if (urlValidation) {
				return {
					success: false,
					errorMessage: urlValidation,
				};
			}

			return {
				success: true,
				value: {
					id: randomUUID(),
					engine: 'mysql',
					mode: 'url',
					name,
					url: payload.url.trim(),
				},
			};
		}

		const host = payload.host.trim();
		if (host.length === 0) {
			return {
				success: false,
				errorMessage: 'Host is required.',
			};
		}

		const port = AddMySqlConnectionCommand.parsePort(payload.port);
		if (port === undefined) {
			return {
				success: false,
				errorMessage: 'Port must be a positive integer.',
			};
		}

		const username = payload.username.trim();
		if (username.length === 0) {
			return {
				success: false,
				errorMessage: 'Username is required.',
			};
		}

		return {
			success: true,
			value: {
				id: randomUUID(),
				engine: 'mysql',
				mode: 'parameters',
				name,
				host,
				port,
				username,
				password: payload.password || undefined,
				database: payload.database.trim() || undefined,
			},
		};
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
	 * 创建连接表单 Webview HTML。
	 *
	 * @returns 可渲染到 Webview 的 HTML 文档。
	 */
	private renderConnectionFormHtml(): string {
		return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
	<meta charset="UTF-8" />
	<meta name="viewport" content="width=device-width, initial-scale=1.0" />
	<title>创建连接</title>
	<style>
		:root {
			color-scheme: light dark;
		}
		body {
			--border1-18: 1px solid var(--vscode-panel-border);
			--border-focus: 1px solid var(--vscode-focusBorder);
			--border-radius: .25rem;
			margin: 0;
			padding: 0;
			font-family: var(--vscode-font-family);
			background: var(--vscode-editor-background);
			color: var(--vscode-editor-foreground);
			line-height: 1;
		}
		.flex-container {
			width: 100%;
			height: 100vh;
			display: flex;
			align-items: center;
			justify-content: center;
			flex-direction: column;
		}
		.form-container {
			width: 100%;
		}
		.forms {
			width: 100%;
		}
		.form {
			max-width: 666px;
			margin: 0 auto;
		}
		.public.form {
			padding-bottom: 1.16em;
			border-bottom: var(--border1-18);
			margin-bottom: 1.36em;
		}
		.form > .label,
		.form > label {
			display: inline-flex;
			align-items: center;
			line-height: 2em;
			min-width: 22em;
			margin: .8em 1.5em;
		}
		.form > label > span:first-child,
		.form > .label > span:first-child {
			display: block;
			min-width: 5em;
			text-align: right;
		}
		input[type="text"],
		input[type="password"],
		input[type="number"],
		input[type="url"] {
			display: block;
			flex: 1;
			margin-left: 1em;
			box-sizing: border-box;
			height: 2em;
			border: 1px solid var(--vscode-input-border);
			border-radius: 2px;
			background: var(--vscode-input-background);
			color: var(--vscode-input-foreground);
			padding: 0 .6em;
			font: inherit;
			outline: none;
		}
		input:focus {
			border: 1px solid var(--vscode-focusBorder);
		}
		.ppz-radio-group {
			display: flex;
			flex: 1;
			margin-left: 1em;
			align-items: center;
			gap: .8em;
			white-space: nowrap;
		}
		.ppz-radio-group label {
			display: flex;
			align-items: center;
			gap: .28em;
		}
		.conn-type {
			position: relative;
		}
		.conn-type .ppz-radio-group + span {
			position: absolute;
			top: 5%;
			left: 80%;
			right: -100%;
			font-size: .9em;
			opacity: .9;
			line-height: 1.5;
			color: var(--vscode-descriptionForeground);
		}
		.url-field {
			display: none;
		}
		.form > .label.long-txt,
		.form > label.long-txt {
			width: 36em;
		}
		button {
			outline: none;
			border: none;
			background: var(--vscode-button-background);
			color: var(--vscode-button-foreground);
			border-radius: 1px;
			font-size: .95em;
			display: inline-block;
			height: 2em;
			min-width: 6em;
			padding: 0 1em;
			cursor: pointer;
		}
		button:not([disabled]):hover {
			background: var(--vscode-button-hoverBackground);
		}
		.form-btns {
			margin-top: 3.8em;
			text-align: center;
		}
		.form-btns button:not(:first-child) {
			margin-left: 1.2em;
		}
		.error {
			min-height: 20px;
			margin-top: 1em;
			text-align: center;
			color: var(--vscode-errorForeground);
		}
		.tttips {
			position: fixed;
			right: 1em;
			bottom: .5em;
			opacity: .9;
			font-size: .8em;
			line-height: 1.5;
			color: var(--vscode-descriptionForeground);
		}
		a {
			color: var(--vscode-textLink-foreground);
			text-decoration: none;
		}
		@media (max-width: 760px) {
			.flex-container {
				height: auto;
				min-height: 100vh;
				padding: 24px 0;
			}
			.form > .label,
			.form > label,
			.form > .label.long-txt,
			.form > label.long-txt {
				display: flex;
				width: auto;
				min-width: 0;
				margin: .8em 1em;
			}
			.conn-type .ppz-radio-group + span {
				position: static;
				margin-left: 1em;
			}
			.tttips {
				position: static;
				margin: 2em 1em 0;
				text-align: right;
			}
		}
	</style>
</head>
<body>
	<div id="vue-app" class="flex-container">
		<div class="form-container">
			<div class="forms">
				<div class="public form">
					<label>
						<span>name</span>
						<input id="name" type="text" value="未命名连接" autocomplete="off" />
					</label>
					<div class="label">
						<span>连接类型</span>
						<div class="ppz-radio-group">
							<label><input type="radio" checked /> MySQL</label>
							<label><input type="radio" disabled /> SQL Server</label>
							<label><input type="radio" disabled /> PostgreSQL</label>
							<label><input type="radio" disabled /> Sqlite3</label>
							<label><input type="radio" disabled /> CockroachDB</label>
						</div>
					</div>
					<br>
					<div class="label conn-type">
						<span>连接方式</span>
						<div class="ppz-radio-group">
							<label>
								<input name="mode" type="radio" value="parameters" checked onchange="syncMode()" />
								字段
							</label>
							<label>
								<input name="mode" type="radio" value="url" onchange="syncMode()" />
								URL
							</label>
						</div>
						<span>
							? 如果下面没有你需要的字段，可以尝试
							<a onclick="selectUrlMode()">使用 URL 连接方式</a>
						</span>
					</div>
				</div>
				<div class="private form">
					<label class="parameter-field">
						<span>host</span>
						<input id="host" type="text" value="127.0.0.1" autocomplete="off" />
					</label>
					<label class="parameter-field">
						<span>port</span>
						<input id="port" type="number" min="1" value="3306" autocomplete="off" />
					</label>
					<label class="parameter-field">
						<span>user</span>
						<input id="username" type="text" value="root" autocomplete="off" />
					</label>
					<label class="parameter-field">
						<span>password</span>
						<input id="password" type="password" autocomplete="new-password" />
					</label>
					<label class="parameter-field">
						<span>database</span>
						<input id="database" type="text" autocomplete="off" />
					</label>
					<label id="urlField" class="long-txt url-field">
						<span>URL</span>
						<input id="url" type="url" value="mysql://root:password@127.0.0.1:3306/mysql" autocomplete="off" />
					</label>
				</div>
			</div>
		</div>
		<div id="error" class="error"></div>
		<div class="form-btns">
			<button onclick="submitForm('saveAndTest')">保存并连接</button>
			<button onclick="submitForm('save')">保存</button>
		</div>
	</div>

	<div class="tttips">
		* TiDB、StoneDB、MariaDB 等 MySQL 系数据库请使用 MySQL 驱动
	</div>

	<script>
		const vscode = acquireVsCodeApi();

		function selectedMode() {
			return document.querySelector('input[name="mode"]:checked').value;
		}

		function syncMode() {
			const mode = selectedMode();
			document.querySelectorAll('.parameter-field').forEach((field) => {
				field.style.display = mode === 'parameters' ? 'inline-flex' : 'none';
			});
			document.getElementById('urlField').style.display = mode === 'url' ? 'inline-flex' : 'none';
			document.getElementById('error').textContent = '';
		}

		function selectUrlMode() {
			document.querySelector('input[name="mode"][value="url"]').checked = true;
			syncMode();
		}

		function readValue(id) {
			return document.getElementById(id).value;
		}

		function validate(payload) {
			if (!payload.name.trim()) {
				return '请输入连接名称。';
			}
			if (payload.mode === 'url') {
				if (!payload.url.trim().startsWith('mysql://')) {
					return 'URL 必须以 mysql:// 开头。';
				}
				return '';
			}
			if (!payload.host.trim()) {
				return '请输入 host。';
			}
			if (!Number.isInteger(Number(payload.port)) || Number(payload.port) <= 0) {
				return 'port 必须是正整数。';
			}
			if (!payload.username.trim()) {
				return '请输入 user。';
			}
			return '';
		}

		function submitForm(type) {
			const payload = {
				name: readValue('name'),
				mode: selectedMode(),
				host: readValue('host'),
				port: readValue('port'),
				username: readValue('username'),
				password: readValue('password'),
				database: readValue('database'),
				url: readValue('url')
			};
			const error = validate(payload);
			document.getElementById('error').textContent = error;
			if (error) {
				return;
			}
			vscode.postMessage({ type, payload });
		}

		syncMode();
	</script>
</body>
</html>`;
	}

	/**
	 * 校验 MySQL 连接 URL。
	 *
	 * @param value 原始 URL 字符串。
	 * @returns 无效时返回的校验提示。
	 */
	private static validateMysqlUrl(value: string): string | undefined {
		try {
			const parsedUrl = new URL(value.trim());
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
