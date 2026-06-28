import * as vscode from 'vscode';

import type { CheckSqlExportCapabilityUseCase } from '../../application/useCases/CheckSqlExportCapabilityUseCase';
import type { ExportMySqlSchemaUseCase } from '../../application/useCases/ExportMySqlSchemaUseCase';
import type { SqlExportKind } from '../../domain/export/SqlExportDocument';
import type { ExtensionCommand } from './ExtensionCommand';
import type { MySqlSchemaTreeNode } from '../explorer/MySqlConnectionsTreeNode';
import { formatSqlExportCapabilityMessage } from './SqlExportCapabilityMessage';

/**
 * 描述 MySQL schema 级 SQL 导出命令配置。
 */
export interface ExportMySqlSchemaSqlCommandConfig {
	readonly id: string;
	readonly kind: SqlExportKind;
}

/**
 * 从 MySQL schema 节点导出 SQL 文档。
 */
export class ExportMySqlSchemaSqlCommand implements ExtensionCommand {
	/**
	 * 保存导出 schema DDL 的 VS Code 命令标识。
	 */
	public static readonly exportDdlId = 'ppz-plus.exportMySqlSchemaDdl';

	/**
	 * 保存导出 schema DML 的 VS Code 命令标识。
	 */
	public static readonly exportDmlId = 'ppz-plus.exportMySqlSchemaDml';

	/**
	 * 保存同时导出 schema DDL 和 DML 的 VS Code 命令标识。
	 */
	public static readonly exportBothId = 'ppz-plus.exportMySqlSchemaBoth';

	/**
	 * 通过命令契约暴露命令标识。
	 */
	public readonly id: string;

	/**
	 * 保存当前命令导出的 SQL 内容类型。
	 */
	private readonly kind: SqlExportKind;

	/**
	 * 创建 MySQL schema 级 SQL 导出命令。
	 *
	 * @param config 命令标识和导出内容类型配置。
	 * @param checkSqlExportCapabilityUseCase 用于在命令入口判断导出能力。
	 * @param exportMySqlSchemaUseCase 用于生成 SQL 导出文档的用例。
	 */
	public constructor(
		config: ExportMySqlSchemaSqlCommandConfig,
		private readonly checkSqlExportCapabilityUseCase: CheckSqlExportCapabilityUseCase,
		private readonly exportMySqlSchemaUseCase: ExportMySqlSchemaUseCase
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
			async (schemaNode?: MySqlSchemaTreeNode) => {
				if (!schemaNode || schemaNode.kind !== 'schema') {
					await vscode.window.showInformationMessage(
						'Choose a MySQL schema node to export SQL.'
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

				await this.exportSchema(schemaNode);
			}
		);
	}

	/**
	 * 导出 schema 级 SQL 并打开临时 SQL 文档。
	 *
	 * @param schemaNode 当前选中的 schema Tree 节点。
	 */
	private async exportSchema(schemaNode: MySqlSchemaTreeNode): Promise<void> {
		try {
			const document = await this.exportMySqlSchemaUseCase.execute(
				schemaNode.connection,
				{
					schemaName: schemaNode.schemaName,
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
