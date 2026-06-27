import type * as vscode from 'vscode';

import type { ExtensionCommand } from '../commands/ExtensionCommand';
import { CommandRegistry } from '../commands/CommandRegistry';
import type { ExtensionActivationParticipant } from './ExtensionActivationParticipant';

/**
 * Coordinates extension startup from the presentation layer.
 */
export class ExtensionBootstrap {
	/**
	 * Registers commands against the VS Code extension context.
	 */
	private readonly commandRegistry: CommandRegistry;

	/**
	 * Creates an extension bootstrap instance.
	 *
	 * @param commands Commands registered during activation.
	 * @param activationParticipants Presentation participants activated with the extension.
	 */
	public constructor(
		private readonly commands: readonly ExtensionCommand[],
		private readonly activationParticipants: readonly ExtensionActivationParticipant[]
	) {
		this.commandRegistry = new CommandRegistry();
	}

	/**
	 * Activates the presentation bootstrap for the current extension session.
	 *
	 * @param context VS Code extension lifecycle context.
	 */
	public activate(context: vscode.ExtensionContext): void {
		this.commandRegistry.register(this.commands, context);
		for (const activationParticipant of this.activationParticipants) {
			activationParticipant.activate(context);
		}
	}
}
