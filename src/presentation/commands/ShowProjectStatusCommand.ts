import * as vscode from 'vscode';

import type { GetBootstrapStatusUseCase } from '../../application/useCases/GetBootstrapStatusUseCase';
import type { ExtensionCommand } from './ExtensionCommand';

/**
 * Shows the current bootstrap status for the extension skeleton.
 */
export class ShowProjectStatusCommand implements ExtensionCommand {
	/**
	 * Stores the VS Code command identifier.
	 */
	public static readonly id = 'ppz-plus.showProjectStatus';

	/**
	 * Exposes the command identifier through the command contract.
	 */
	public readonly id = ShowProjectStatusCommand.id;

	/**
	 * Creates the status command.
	 *
	 * @param getBootstrapStatusUseCase Use case used to assemble status content.
	 */
	public constructor(
		private readonly getBootstrapStatusUseCase: GetBootstrapStatusUseCase
	) {}

	/**
	 * Registers the command and binds it to the VS Code command service.
	 *
	 * @returns A disposable registration handle.
	 */
	public register(): vscode.Disposable {
		return vscode.commands.registerCommand(this.id, async () => {
			/**
			 * Captures the latest bootstrap status before rendering a message.
			 */
			const status = this.getBootstrapStatusUseCase.execute();

			/**
			 * Builds a human-readable summary of supported MVP capabilities.
			 */
			const capabilitySummary = status.supportedCapabilities.join(', ');

			/**
			 * Builds a human-readable summary of engines planned for later phases.
			 */
			const plannedEngines = status.plannedEngines.join(', ') || 'none';

			await vscode.window.showInformationMessage(
				`ppz-plus bootstrap ready. Focus: ${status.focusEngine}. Supported MVP capabilities: ${capabilitySummary}. Planned engines: ${plannedEngines}.`
			);
		});
	}
}
