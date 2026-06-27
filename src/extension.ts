import * as vscode from 'vscode';

import { createExtensionBootstrap } from './presentation/bootstrap/createExtensionBootstrap';

/**
 * Activates the extension bootstrap and registers all presentation entry points.
 *
 * @param context VS Code extension lifecycle context.
 */
export function activate(context: vscode.ExtensionContext): void {
	/**
	 * Coordinates extension startup for the current activation cycle.
	 */
	const bootstrap = createExtensionBootstrap(context);
	bootstrap.activate(context);
}

/**
 * Deactivates the extension.
 */
export function deactivate(): void {}
