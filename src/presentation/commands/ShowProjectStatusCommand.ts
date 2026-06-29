import * as vscode from 'vscode';

import type { GetBootstrapStatusUseCase } from '../../application/useCases/GetBootstrapStatusUseCase';
import type { ExtensionCommand } from './ExtensionCommand';

/**
 * 展示当前扩展骨架的启动状态。
 */
export class ShowProjectStatusCommand implements ExtensionCommand {
	/**
	 * 保存 VS Code 命令标识。
	 */
	public static readonly id = 'ppz-plus.showProjectStatus';

	/**
	 * 通过命令契约暴露命令标识。
	 */
	public readonly id = ShowProjectStatusCommand.id;

	/**
	 * 创建状态展示命令。
	 *
	 * @param getBootstrapStatusUseCase 用于组装状态内容的用例。
	 */
	public constructor(
		private readonly getBootstrapStatusUseCase: GetBootstrapStatusUseCase
	) {}

	/**
	 * 注册命令并绑定到 VS Code 命令服务。
	 *
	 * @returns 注册产生的可释放句柄。
	 */
	public register(): vscode.Disposable {
		return vscode.commands.registerCommand(this.id, async () => {
			/**
			 * 在渲染提示前获取最新启动状态。
			 */
			const status = this.getBootstrapStatusUseCase.execute();

			/**
			 * 构建已支持 MVP 能力的可读摘要。
			 */
			const capabilitySummary = status.supportedCapabilities.join(', ');

			/**
			 * 构建后续阶段计划支持数据库引擎的可读摘要。
			 */
			const plannedEngines = status.plannedEngines.join(', ') || '无';

			await vscode.window.showInformationMessage(
				`ppz-plus 启动骨架已就绪。当前重点：${status.focusEngine}。已支持 MVP 能力：${capabilitySummary}。计划支持的数据库：${plannedEngines}。`
			);
		});
	}
}
