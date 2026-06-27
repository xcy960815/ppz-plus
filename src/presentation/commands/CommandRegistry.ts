import type * as vscode from 'vscode';

import type { ExtensionCommand } from './ExtensionCommand';

/**
 * Registers presentation commands into the extension subscription lifecycle.
 */
export class CommandRegistry {
	/**
	 * Registers a command collection into the provided extension context.
	 *
	 * @param commands Commands to register.
	 * @param context VS Code extension lifecycle context.
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
