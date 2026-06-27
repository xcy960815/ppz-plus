import type * as vscode from 'vscode';

/**
 * Defines a presentation component that participates in extension activation.
 */
export interface ExtensionActivationParticipant {
	/**
	 * Activates the participant for the current extension session.
	 *
	 * @param context VS Code extension lifecycle context.
	 */
	activate(context: vscode.ExtensionContext): void;
}
