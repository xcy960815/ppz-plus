import * as vscode from "vscode";

import type { CheckSqlExportCapabilityUseCase } from "../../application/useCases/CheckSqlExportCapabilityUseCase";
import type { ExportMySqlTableUseCase } from "../../application/useCases/ExportMySqlTableUseCase";
import type { RecordSqlExportTaskLogUseCase } from "../../application/useCases/RecordSqlExportTaskLogUseCase";
import type { SaveSqlExportDocumentUseCase } from "../../application/useCases/SaveSqlExportDocumentUseCase";
import type { SqlExportDocument, SqlExportKind } from "../../domain/export/SqlExportDocument";
import type { SqlExportFileSaveResult } from "../../domain/export/SqlExportFileSaveResult";
import type { ExtensionCommand } from "./ExtensionCommand";
import type { MySqlTableTreeNode } from "../explorer/DatabaseConnectionsTreeNode";
import { formatSqlExportCapabilityMessage } from "./SqlExportCapabilityMessage";
import { presentSqlExportFileSaveResult, promptSqlExportFilePath } from "./SqlExportFilePresenter";
import { showUserErrorMessage } from "./UserErrorPresenter";

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
  public static readonly exportDdlId = "ppz-plus.exportMySqlTableDdl";

  /**
   * 保存导出 DML 的 VS Code 命令标识。
   */
  public static readonly exportDmlId = "ppz-plus.exportMySqlTableDml";

  /**
   * 保存同时导出 DDL 和 DML 的 VS Code 命令标识。
   */
  public static readonly exportBothId = "ppz-plus.exportMySqlTableBoth";

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
   * @param {ExportMySqlTableSqlCommandConfig} config 命令标识和导出内容类型配置。
   * @param checkSqlExportCapabilityUseCase 用于在命令入口判断导出能力。
   * @param exportMySqlTableUseCase 用于生成 SQL 导出文档的用例。
   * @param saveSqlExportDocumentUseCase 用于保存 SQL 导出文档到文件。
   * @param recordSqlExportTaskLogUseCase 用于记录导出任务日志。
   */
  public constructor(
    config: ExportMySqlTableSqlCommandConfig,
    private readonly checkSqlExportCapabilityUseCase: CheckSqlExportCapabilityUseCase,
    private readonly exportMySqlTableUseCase: ExportMySqlTableUseCase,
    private readonly saveSqlExportDocumentUseCase: SaveSqlExportDocumentUseCase,
    private readonly recordSqlExportTaskLogUseCase: RecordSqlExportTaskLogUseCase,
  ) {
    this.id = config.id;
    this.kind = config.kind;
  }

  /**
   * 向 VS Code 注册命令。
   *
   * @returns {vscode.Disposable} 命令注册的可释放句柄。
   */
  public register(): vscode.Disposable {
    return vscode.commands.registerCommand(this.id, async (tableNode?: MySqlTableTreeNode) => {
      if (!tableNode || tableNode.kind !== "table") {
        await vscode.window.showInformationMessage("请选择一个 MySQL 表节点后再导出 SQL。");
        return;
      }

      const capabilityCheck = this.checkSqlExportCapabilityUseCase.execute("mysql", this.kind);

      if (!capabilityCheck.supported) {
        await vscode.window.showWarningMessage(formatSqlExportCapabilityMessage(capabilityCheck));
        return;
      }

      await this.exportTable(tableNode);
    });
  }

  /**
   * 导出表级 SQL 并保存到用户选择的文件。
   *
   * @param {MySqlTableTreeNode} tableNode 当前选中的表 Tree 节点。
   */
  private async exportTable(tableNode: MySqlTableTreeNode): Promise<void> {
    const startedAt = new Date();
    const targetName = `${tableNode.schemaName}.${tableNode.tableName}`;
    try {
      const document = await this.exportTableDocumentWithProgress(tableNode, targetName);
      const filePath = await promptSqlExportFilePath(document);
      if (!filePath) {
        await vscode.window.showInformationMessage("已取消 SQL 导出。");
        return;
      }

      const saveResult = await this.saveTableDocumentWithProgress(document, filePath, targetName);
      await presentSqlExportFileSaveResult(saveResult);
      await this.recordExportLog(
        tableNode,
        targetName,
        startedAt,
        saveResult.success ? "success" : "failure",
        saveResult.filePath,
        saveResult.success ? undefined : saveResult.errorMessage,
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await this.recordExportLog(
        tableNode,
        targetName,
        startedAt,
        "failure",
        undefined,
        errorMessage,
      );
      await showUserErrorMessage({
        operation: "导出 MySQL 表 SQL",
        error,
      });
    }
  }

  /**
   * 带 VS Code 进度提示生成表级 SQL 文档。
   *
   * @param {MySqlTableTreeNode} tableNode 当前选中的表 Tree 节点。
   * @param {string} targetName 导出目标名称。
   * @returns {Promise<SqlExportDocument>} 生成后的 SQL 导出文档。
   */
  private async exportTableDocumentWithProgress(
    tableNode: MySqlTableTreeNode,
    targetName: string,
  ): Promise<SqlExportDocument> {
    return vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `PPZ Plus: 导出 MySQL 表“${targetName}”`,
      },
      async (progress) => {
        progress.report({ message: "正在生成 SQL...", increment: 20 });

        const document = await this.exportMySqlTableUseCase.execute(
          tableNode.connection,
          {
            schemaName: tableNode.schemaName,
            tableName: tableNode.tableName,
          },
          this.kind,
        );

        progress.report({ message: "SQL 已生成。", increment: 80 });
        return document;
      },
    );
  }

  /**
   * 带 VS Code 进度提示保存表级 SQL 文档。
   *
   * @param {SqlExportDocument} document 已生成的 SQL 导出文档。
   * @param {string} filePath 用户选择的目标文件路径。
   * @param {string} targetName 导出目标名称。
   * @returns {Promise<SqlExportFileSaveResult>} SQL 文件保存结果。
   */
  private async saveTableDocumentWithProgress(
    document: SqlExportDocument,
    filePath: string,
    targetName: string,
  ): Promise<SqlExportFileSaveResult> {
    return vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `PPZ Plus: 保存 MySQL 表 SQL“${targetName}”`,
      },
      async (progress) => {
        progress.report({ message: "正在写入 SQL 文件...", increment: 20 });

        const saveResult = await this.saveSqlExportDocumentUseCase.execute(document, filePath);

        progress.report({ message: "SQL 文件已保存。", increment: 80 });
        return saveResult;
      },
    );
  }

  /**
   * 记录表级 SQL 导出任务日志。
   *
   * @param {MySqlTableTreeNode} tableNode 当前选中的表 Tree 节点。
   * @param {string} targetName 导出目标名称。
   * @param {Date} startedAt 导出任务开始时间。
   * @param {'success' | 'failure'} status 导出任务最终状态。
   * @param {string} filePath 可选的导出文件路径。
   * @param {string} errorMessage 可选的错误信息。
   */
  private async recordExportLog(
    tableNode: MySqlTableTreeNode,
    targetName: string,
    startedAt: Date,
    status: "success" | "failure",
    filePath?: string,
    errorMessage?: string,
  ): Promise<void> {
    const endedAt = new Date();
    await this.recordSqlExportTaskLogUseCase.execute({
      engine: "mysql",
      connectionName: tableNode.connection.name,
      targetType: "table",
      targetName,
      kind: this.kind,
      status,
      startedAt: startedAt.toISOString(),
      endedAt: endedAt.toISOString(),
      durationMs: endedAt.getTime() - startedAt.getTime(),
      filePath,
      errorMessage,
    });
  }
}
