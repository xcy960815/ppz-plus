import type * as vscode from 'vscode';

/**
 * Defines a VS Code command that can be registered during bootstrap.
 */
export interface ExtensionCommand {
	readonly id: string;

	/**
	 * Registers the command with the VS Code command service.
	 *
	 * @returns A disposable registration handle.
	 */
	register(): vscode.Disposable;
}
