import * as vscode from 'vscode';

import type { CheckSqlExportCapabilityUseCase } from '../../application/useCases/CheckSqlExportCapabilityUseCase';
import type { ExportMySqlTableUseCase } from '../../application/useCases/ExportMySqlTableUseCase';
import type { SqlExportKind } from '../../domain/export/SqlExportDocument';
import type { ExtensionCommand } from './ExtensionCommand';
import type { MySqlTableTreeNode } from '../explorer/MySqlConnectionsTreeNode';
import { formatSqlExportCapabilityMessage } from './SqlExportCapabilityMessage';

/**
 * 描述 MySQL 表级 SQL 导出命令配置。
 */
export interface ExportMySqlTableSqlCommandConfig {
	readonly id: string;
	readonly kind: SqlExportKind;
}

/**
 * 从 MySQL 表节点导出 SQL 文档。
 */
export class ExportMySqlTableSqlCommand implements ExtensionCommand {
	/**
	 * 保存导出 DDL 的 VS Code 命令标识。
	 */
	public static readonly exportDdlId = 'ppz-plus.exportMySqlTableDdl';

	/**
	 * 保存导出 DML 的 VS Code 命令标识。
	 */
	public static readonly exportDmlId = 'ppz-plus.exportMySqlTableDml';

	/**
	 * 保存同时导出 DDL 和 DML 的 VS Code 命令标识。
	 */
	public static readonly exportBothId = 'ppz-plus.exportMySqlTableBoth';

	/**
	 * 通过命令契约暴露命令标识。
	 */
	public readonly id: string;

	/**
	 * 保存当前命令导出的 SQL 内容类型。
	 */
	private readonly kind: SqlExportKind;

	/**
	 * 创建 MySQL 表级 SQL 导出命令。
	 *
	 * @param config 命令标识和导出内容类型配置。
	 * @param checkSqlExportCapabilityUseCase 用于在命令入口判断导出能力。
	 * @param exportMySqlTableUseCase 用于生成 SQL 导出文档的用例。
	 */
	public constructor(
		config: ExportMySqlTableSqlCommandConfig,
		private readonly checkSqlExportCapabilityUseCase: CheckSqlExportCapabilityUseCase,
		private readonly exportMySqlTableUseCase: ExportMySqlTableUseCase
	) {
		this.id = config.id;
		this.kind = config.kind;
	}

	/**
	 * 向 VS Code 注册命令。
	 *
	 * @returns 命令注册的可释放句柄。
	 */
	public register(): vscode.Disposable {
		return vscode.commands.registerCommand(
			this.id,
			async (tableNode?: MySqlTableTreeNode) => {
				if (!tableNode || tableNode.kind !== 'table') {
					await vscode.window.showInformationMessage(
						'Choose a MySQL table node to export SQL.'
					);
					return;
				}

				const capabilityCheck = this.checkSqlExportCapabilityUseCase.execute(
					'mysql',
					this.kind
				);

				if (!capabilityCheck.supported) {
					await vscode.window.showWarningMessage(
						formatSqlExportCapabilityMessage(capabilityCheck)
					);
					return;
				}

				await this.exportTable(tableNode);
			}
		);
	}

	/**
	 * 导出表级 SQL 并打开临时 SQL 文档。
	 *
	 * @param tableNode 当前选中的表 Tree 节点。
	 */
	private async exportTable(tableNode: MySqlTableTreeNode): Promise<void> {
		try {
			const document = await this.exportMySqlTableUseCase.execute(
				tableNode.connection,
				{
					schemaName: tableNode.schemaName,
					tableName: tableNode.tableName,
				},
				this.kind
			);
			const textDocument = await vscode.workspace.openTextDocument({
				content: document.content,
				language: 'sql',
			});

			await vscode.window.showTextDocument(textDocument, {
				preview: false,
			});
		} catch (error) {
			await vscode.window.showErrorMessage(
				error instanceof Error ? error.message : String(error)
			);
		}
	}
}
