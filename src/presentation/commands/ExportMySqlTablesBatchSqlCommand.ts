import * as vscode from "vscode";

import type { CheckSqlExportCapabilityUseCase } from "../../application/useCases/CheckSqlExportCapabilityUseCase";
import type { ExportMySqlTablesBatchUseCase } from "../../application/useCases/ExportMySqlTablesBatchUseCase";
import type { ListMySqlTablesUseCase } from "../../application/useCases/ListMySqlTablesUseCase";
import type { RecordSqlExportTaskLogUseCase } from "../../application/useCases/RecordSqlExportTaskLogUseCase";
import type {
  SqlExportBatchFailureItem,
  SqlExportBatchResult,
  SqlExportBatchSuccessItem,
} from "../../domain/export/SqlExportBatchResult";
import type { SqlExportKind } from "../../domain/export/SqlExportDocument";
import { isOperationCanceledError } from "../../domain/tasks/CancellationSignal";
import type { ExtensionCommand } from "./ExtensionCommand";
import type { MySqlSchemaTreeNode } from "../explorer/MySqlConnectionsTreeNode";
import { formatSqlExportCapabilityMessage } from "./SqlExportCapabilityMessage";
import {
  createVsCodeCancellationSignal,
  showTaskCanceledMessage,
} from "./TaskCancellationPresenter";
import { createVsCodeSqlExportTaskProgressReporter } from "./SqlExportProgressPresenter";
import { showUserErrorMessage } from "./UserErrorPresenter";

/**
 * 描述批量导出类型选项。
 */
interface SqlExportKindQuickPickItem extends vscode.QuickPickItem {
  /**
   * 保存选项对应的 SQL 导出类型。
   */
  readonly exportKind: SqlExportKind;
}

/**
 * 描述批量导出表选择项。
 */
interface MySqlTableQuickPickItem extends vscode.QuickPickItem {
  /**
   * 保存当前选择项对应的表名。
   */
  readonly tableName: string;
}

/**
 * 从 MySQL schema 节点批量导出多张表的 SQL 文件。
 */
export class ExportMySqlTablesBatchSqlCommand implements ExtensionCommand {
  /**
   * 保存批量导出 MySQL 表的 VS Code 命令标识。
   */
  public static readonly id = "ppz-plus.exportMySqlTablesBatch";

  /**
   * 保存命令契约暴露的命令标识。
   */
  public readonly id = ExportMySqlTablesBatchSqlCommand.id;

  /**
   * 保存批量导出类型选项。
   */
  private readonly exportKindItems: readonly SqlExportKindQuickPickItem[] = [
    {
      label: "DDL",
      description: "结构",
      exportKind: "ddl",
    },
    {
      label: "DML",
      description: "数据",
      exportKind: "dml",
    },
    {
      label: "DDL + DML",
      description: "结构和数据",
      exportKind: "both",
    },
  ];

  /**
   * 创建 MySQL 多表批量 SQL 导出命令。
   *
   * @param checkSqlExportCapabilityUseCase 用于判断当前 MySQL MVP 是否支持导出类型。
   * @param listMySqlTablesUseCase 用于读取 schema 下的表列表。
   * @param exportMySqlTablesBatchUseCase 用于执行批量 SQL 导出。
   * @param recordSqlExportTaskLogUseCase 用于记录逐表导出任务日志。
   */
  public constructor(
    private readonly checkSqlExportCapabilityUseCase: CheckSqlExportCapabilityUseCase,
    private readonly listMySqlTablesUseCase: ListMySqlTablesUseCase,
    private readonly exportMySqlTablesBatchUseCase: ExportMySqlTablesBatchUseCase,
    private readonly recordSqlExportTaskLogUseCase: RecordSqlExportTaskLogUseCase,
  ) {}

  /**
   * 向 VS Code 注册命令。
   *
   * @returns {vscode.Disposable} 命令注册的可释放句柄。
   */
  public register(): vscode.Disposable {
    return vscode.commands.registerCommand(this.id, async (schemaNode?: MySqlSchemaTreeNode) => {
      if (!schemaNode || schemaNode.kind !== "schema") {
        await vscode.window.showInformationMessage("请选择一个 MySQL schema 节点后再批量导出表。");
        return;
      }

      await this.exportTables(schemaNode);
    });
  }

  /**
   * 执行 schema 下多张表的批量 SQL 导出流程。
   *
   * @param {MySqlSchemaTreeNode} schemaNode 当前选中的 schema Tree 节点。
   */
  private async exportTables(schemaNode: MySqlSchemaTreeNode): Promise<void> {
    try {
      const selectedTables = await this.promptTables(schemaNode);
      if (!selectedTables) {
        return;
      }

      const kind = await this.promptExportKind();
      if (!kind) {
        await vscode.window.showInformationMessage("已取消 SQL 批量导出。");
        return;
      }

      const capabilityCheck = this.checkSqlExportCapabilityUseCase.execute("mysql", kind);

      if (!capabilityCheck.supported) {
        await vscode.window.showWarningMessage(formatSqlExportCapabilityMessage(capabilityCheck));
        return;
      }

      const targetDirectory = await this.promptTargetDirectory();
      if (!targetDirectory) {
        await vscode.window.showInformationMessage("已取消 SQL 批量导出。");
        return;
      }

      const result = await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: "PPZ Plus: 批量导出 MySQL 表",
          cancellable: true,
        },
        (progress, token) =>
          this.exportMySqlTablesBatchUseCase.execute(schemaNode.connection, {
            tables: selectedTables.map((tableName) => ({
              schemaName: schemaNode.schemaName,
              tableName,
            })),
            kind,
            targetDirectory,
            cancellationSignal: createVsCodeCancellationSignal(token),
            progressReporter: createVsCodeSqlExportTaskProgressReporter(progress),
          }),
      );

      await this.recordExportLogs(schemaNode, result);
      await this.presentBatchResult(result);
    } catch (error) {
      if (isOperationCanceledError(error)) {
        await showTaskCanceledMessage("MySQL 批量导出");
        return;
      }

      await showUserErrorMessage({
        operation: "批量导出 MySQL 表",
        error,
      });
    }
  }

  /**
   * 提示用户从当前 schema 下选择需要批量导出的表。
   *
   * @param {MySqlSchemaTreeNode} schemaNode 当前选中的 schema Tree 节点。
   * @returns {Promise<readonly string[] | undefined>} 选中的表名列表；取消时为空。
   */
  private async promptTables(
    schemaNode: MySqlSchemaTreeNode,
  ): Promise<readonly string[] | undefined> {
    const tables = await this.listMySqlTablesUseCase.execute(
      schemaNode.connection,
      schemaNode.schemaName,
    );

    if (tables.length === 0) {
      await vscode.window.showInformationMessage(
        `schema“${schemaNode.schemaName}”中未找到 MySQL 表。`,
      );
      return undefined;
    }

    const tableItems = tables.map<MySqlTableQuickPickItem>((table) => ({
      label: table.name,
      description: schemaNode.schemaName,
      tableName: table.name,
    }));
    const selectedItems = await vscode.window.showQuickPick(tableItems, {
      canPickMany: true,
      placeHolder: "选择要导出的 MySQL 表",
      title: "PPZ Plus: 批量导出 MySQL 表",
    });

    if (!selectedItems) {
      await vscode.window.showInformationMessage("已取消 SQL 批量导出。");
      return undefined;
    }

    if (selectedItems.length === 0) {
      await vscode.window.showInformationMessage("请至少选择一张要导出的 MySQL 表。");
      return undefined;
    }

    return selectedItems.map((item) => item.tableName);
  }

  /**
   * 提示用户选择批量 SQL 导出类型。
   *
   * @returns {Promise<SqlExportKind | undefined>} 选中的 SQL 导出类型；取消时为空。
   */
  private async promptExportKind(): Promise<SqlExportKind | undefined> {
    const selectedItem = await vscode.window.showQuickPick(this.exportKindItems, {
      placeHolder: "选择 SQL 导出类型",
      title: "PPZ Plus: 批量导出 MySQL 表",
    });

    return selectedItem?.exportKind;
  }

  /**
   * 提示用户选择批量 SQL 文件输出目录。
   *
   * @returns {Promise<string | undefined>} 选中的本地目录路径；取消时为空。
   */
  private async promptTargetDirectory(): Promise<string | undefined> {
    const defaultWorkspaceFolder = vscode.workspace.workspaceFolders?.[0];
    const selectedDirectories = await vscode.window.showOpenDialog({
      canSelectFiles: false,
      canSelectFolders: true,
      canSelectMany: false,
      defaultUri: defaultWorkspaceFolder?.uri,
      openLabel: "导出",
      title: "PPZ Plus: 选择 SQL 导出目录",
    });

    return selectedDirectories?.[0]?.fsPath;
  }

  /**
   * 记录批量导出的逐表任务日志。
   *
   * @param {MySqlSchemaTreeNode} schemaNode 当前选中的 schema Tree 节点。
   * @param {SqlExportBatchResult} result 批量导出汇总结果。
   */
  private async recordExportLogs(
    schemaNode: MySqlSchemaTreeNode,
    result: SqlExportBatchResult,
  ): Promise<void> {
    for (const item of result.successes) {
      await this.recordSuccessLog(schemaNode, result.kind, item);
    }

    for (const item of result.failures) {
      await this.recordFailureLog(schemaNode, result.kind, item);
    }
  }

  /**
   * 记录单张表批量导出成功日志。
   *
   * @param {MySqlSchemaTreeNode} schemaNode 当前选中的 schema Tree 节点。
   * @param {SqlExportKind} kind SQL 导出类型。
   * @param {SqlExportBatchSuccessItem} item 单表成功结果。
   */
  private async recordSuccessLog(
    schemaNode: MySqlSchemaTreeNode,
    kind: SqlExportKind,
    item: SqlExportBatchSuccessItem,
  ): Promise<void> {
    await this.recordSqlExportTaskLogUseCase.execute({
      engine: "mysql",
      connectionName: schemaNode.connection.name,
      targetType: "table",
      targetName: `${item.schemaName}.${item.tableName}`,
      kind,
      status: "success",
      startedAt: item.startedAt,
      endedAt: item.endedAt,
      durationMs: item.durationMs,
      filePath: item.filePath,
    });
  }

  /**
   * 记录单张表批量导出失败日志。
   *
   * @param {MySqlSchemaTreeNode} schemaNode 当前选中的 schema Tree 节点。
   * @param {SqlExportKind} kind SQL 导出类型。
   * @param {SqlExportBatchFailureItem} item 单表失败结果。
   */
  private async recordFailureLog(
    schemaNode: MySqlSchemaTreeNode,
    kind: SqlExportKind,
    item: SqlExportBatchFailureItem,
  ): Promise<void> {
    await this.recordSqlExportTaskLogUseCase.execute({
      engine: "mysql",
      connectionName: schemaNode.connection.name,
      targetType: "table",
      targetName: `${item.schemaName}.${item.tableName}`,
      kind,
      status: "failure",
      startedAt: item.startedAt,
      endedAt: item.endedAt,
      durationMs: item.durationMs,
      filePath: item.filePath,
      errorMessage: item.errorMessage,
    });
  }

  /**
   * 展示批量 SQL 导出结果。
   *
   * @param {SqlExportBatchResult} result 批量导出汇总结果。
   */
  private async presentBatchResult(result: SqlExportBatchResult): Promise<void> {
    if (result.failureCount === 0) {
      await vscode.window.showInformationMessage(
        `已批量导出 ${result.successCount}/${result.totalCount} 个 SQL 文件到“${result.targetDirectory}”。`,
      );
      return;
    }

    const failureSummary = this.formatFailureSummary(result.failures);
    const message = `SQL 批量导出完成：成功 ${result.successCount} 个，失败 ${result.failureCount} 个。${failureSummary}`;

    if (result.successCount === 0) {
      await vscode.window.showErrorMessage(message);
      return;
    }

    await vscode.window.showWarningMessage(message);
  }

  /**
   * 格式化批量导出失败摘要。
   *
   * @param {readonly SqlExportBatchFailureItem[]} failures 批量导出的失败条目。
   * @returns {string} 适合在 VS Code 提示中展示的失败摘要。
   */
  private formatFailureSummary(failures: readonly SqlExportBatchFailureItem[]): string {
    const visibleFailures = failures.slice(0, 3);
    const summary = visibleFailures
      .map((failure) => `${failure.schemaName}.${failure.tableName}: ${failure.errorMessage}`)
      .join("; ");
    const hiddenCount = failures.length - visibleFailures.length;

    if (hiddenCount <= 0) {
      return summary;
    }

    return `${summary}；另有 ${hiddenCount} 个失败。`;
  }
}
