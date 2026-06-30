import type * as vscode from 'vscode';

import type { ExtensionCommand } from './ExtensionCommand';

/**
 * 将表现层命令注册到扩展订阅生命周期中。
 */
export class CommandRegistry {
	/**
	 * 将命令集合注册到指定扩展上下文中。
	 *
	 * @param {readonly ExtensionCommand[]} commands 待注册的命令集合。
	 * @param {vscode.ExtensionContext} context VS Code 扩展生命周期上下文。
	 */
	public register(
		commands: readonly ExtensionCommand[],
		context: vscode.ExtensionContext
	): void {
		for (const command of commands) {
			context.subscriptions.push(command.register());
		}
	}
}
