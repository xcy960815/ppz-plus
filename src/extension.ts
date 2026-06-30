import * as vscode from 'vscode';

import { createExtensionBootstrap } from './presentation/bootstrap/createExtensionBootstrap';

/**
 * 激活扩展启动流程并注册所有表现层入口。
 *
 * @param {vscode.ExtensionContext} context VS Code 扩展生命周期上下文。
 */
export function activate(context: vscode.ExtensionContext): void {
	/**
	 * 协调当前激活周期的扩展启动。
	 */
	const bootstrap = createExtensionBootstrap(context);
	bootstrap.activate(context);
}

/**
 * 停用扩展。
 */
export function deactivate(): void {}
