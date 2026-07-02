import * as path from "path";

import * as vscode from "vscode";

import type { ListMySqlSchemasUseCase } from "../../application/useCases/ListMySqlSchemasUseCase";
import type { ListMySqlTablesUseCase } from "../../application/useCases/ListMySqlTablesUseCase";
import type { ListStoredConnectionsUseCase } from "../../application/useCases/ListStoredConnectionsUseCase";
import type { CreateImportErrorReportUseCase } from "../../application/useCases/CreateImportErrorReportUseCase";
import type { ImportMySqlCsvFileUseCase } from "../../application/useCases/ImportMySqlCsvFileUseCase";
import type { PrepareMySqlCsvImportMappingUseCase } from "../../application/useCases/PrepareMySqlCsvImportMappingUseCase";
import type { PreviewMySqlCsvFileImportUseCase } from "../../application/useCases/PreviewMySqlCsvFileImportUseCase";
import type { MysqlConnectionConfig } from "../../domain/connections/ConnectionConfig";
import type {
  CsvFileImportResult,
  CsvTableImportTarget,
} from "../../domain/import/CsvFileImportResult";
import type { ImportColumnMapping } from "../../domain/import/ImportColumnMapping";
import { isOperationCanceledError } from "../../domain/tasks/CancellationSignal";
import type { ExtensionCommand } from "./ExtensionCommand";
import { describeConnectionTarget } from "./ConnectionDisplayFormatter";
import { promptImportColumnMapping } from "./ImportColumnMappingPrompt";
import { confirmImportPreview } from "./ImportPreviewConfirmation";
import { showImportErrorReport } from "./ImportErrorReportPresenter";
import { createVsCodeImportTaskProgressReporter } from "./ImportTaskProgressPresenter";
import type { StoredConnectionPasswordPrompt } from "./StoredConnectionPasswordPrompt";
import {
  createVsCodeCancellationSignal,
  showTaskCanceledMessage,
} from "./TaskCancellationPresenter";
import { showUserErrorMessage } from "./UserErrorPresenter";
import type { DatabaseConnectionsTreeNode } from "../explorer/DatabaseConnectionsTreeNode";

/**
 * 从 VS Code 入口导入 MySQL CSV 文件。
 */
export class ImportMySqlCsvFileCommand implements ExtensionCommand {
  /**
   * 保存 VS Code 命令标识。
   */
  public static readonly id = "ppz-plus.importMySqlCsvFile";

  /**
   * 通过命令契约暴露命令标识。
   */
  public readonly id = ImportMySqlCsvFileCommand.id;

  /**
   * 创建 MySQL CSV 文件导入命令。
   *
   * @param listStoredConnectionsUseCase 用于读取已保存 MySQL 连接的用例。
   * @param listMySqlSchemasUseCase 用于选择目标 schema 的用例。
   * @param listMySqlTablesUseCase 用于选择目标表的用例。
   * @param createImportErrorReportUseCase 用于生成导入错误报告。
   * @param prepareMySqlCsvImportMappingUseCase 用于准备 CSV 字段映射配置。
   * @param previewMySqlCsvFileImportUseCase 用于生成 CSV 导入预览的用例。
   * @param importMySqlCsvFileUseCase 用于执行 CSV 文件导入的用例。
   * @param storedConnectionPasswordPrompt 用于补录已保存连接缺失的本机密码。
   */
  public constructor(
    private readonly listStoredConnectionsUseCase: ListStoredConnectionsUseCase,
    private readonly listMySqlSchemasUseCase: ListMySqlSchemasUseCase,
    private readonly listMySqlTablesUseCase: ListMySqlTablesUseCase,
    private readonly createImportErrorReportUseCase: CreateImportErrorReportUseCase,
    private readonly prepareMySqlCsvImportMappingUseCase: PrepareMySqlCsvImportMappingUseCase,
    private readonly previewMySqlCsvFileImportUseCase: PreviewMySqlCsvFileImportUseCase,
    private readonly importMySqlCsvFileUseCase: ImportMySqlCsvFileUseCase,
    private readonly storedConnectionPasswordPrompt: StoredConnectionPasswordPrompt,
  ) {}

  /**
   * 向 VS Code 注册命令。
   *
   * @returns {vscode.Disposable} 命令注册的可释放句柄。
   */
  public register(): vscode.Disposable {
    return vscode.commands.registerCommand(this.id, async (node?: DatabaseConnectionsTreeNode) => {
      const selection = await this.resolveImportSelection(node);
      if (!selection) {
        return;
      }

      const filePath = await this.pickCsvFilePath();
      if (!filePath) {
        await vscode.window.showInformationMessage("未选择 CSV 文件。");
        return;
      }

      const fileName = path.basename(filePath);
      const targetName = `${selection.target.schemaName}.${selection.target.tableName}`;
      const mappings = await promptImportColumnMapping(
        this.createImportErrorReportUseCase,
        "CSV",
        fileName,
        targetName,
        await this.prepareMySqlCsvImportMappingUseCase.execute(
          selection.connection,
          selection.target,
          filePath,
        ),
      );
      if (!mappings) {
        return;
      }

      const confirmed = await confirmImportPreview(
        this.createImportErrorReportUseCase,
        "CSV",
        fileName,
        targetName,
        await this.previewMySqlCsvFileImportUseCase.execute(
          selection.connection,
          selection.target,
          filePath,
          mappings,
        ),
        mappings,
      );
      if (!confirmed) {
        return;
      }

      await this.importCsvFile(selection.connection, selection.target, filePath, mappings);
    });
  }

  /**
   * 解析或提示用户选择 CSV 导入目标。
   *
   * @param {DatabaseConnectionsTreeNode} node 可选的 MySQL Tree 节点。
   * @returns 完整 CSV 导入选择。
   */
  private async resolveImportSelection(node?: DatabaseConnectionsTreeNode): Promise<
    | {
        readonly connection: MysqlConnectionConfig;
        readonly target: CsvTableImportTarget;
      }
    | undefined
  > {
    const connection =
      node?.connection.engine === "mysql" ? node.connection : await this.pickConnection();
    if (!connection) {
      return undefined;
    }

    const readyConnection =
      await this.storedConnectionPasswordPrompt.ensureConnectionReady(connection);
    if (!readyConnection) {
      return undefined;
    }

    const schemaName =
      node?.kind === "schema" || node?.kind === "table"
        ? node.schemaName
        : await this.pickSchema(readyConnection);
    if (!schemaName) {
      return undefined;
    }

    const tableName =
      node?.kind === "table" ? node.tableName : await this.pickTable(readyConnection, schemaName);
    if (!tableName) {
      return undefined;
    }

    return {
      connection: readyConnection,
      target: {
        schemaName,
        tableName,
      },
    };
  }

  /**
   * 提示用户选择一个已保存的 MySQL 连接。
   *
   * @returns {Promise<MysqlConnectionConfig | undefined>} 用户选择的 MySQL 连接；未选择时为空。
   */
  private async pickConnection(): Promise<MysqlConnectionConfig | undefined> {
    const connections = (await this.listStoredConnectionsUseCase.execute()).filter(
      (connection): connection is MysqlConnectionConfig => connection.engine === "mysql",
    );
    if (connections.length === 0) {
      await vscode.window.showInformationMessage(
        "暂无已保存的 MySQL 连接，请先使用“PPZ Plus: 新增 MySQL 连接”创建连接。",
      );
      return undefined;
    }

    const selectedConnection = await vscode.window.showQuickPick(
      connections.map((connection) => ({
        label: connection.name,
        description: describeConnectionTarget(connection),
        connection,
      })),
      {
        title: "PPZ Plus: 导入 MySQL CSV 文件",
        placeHolder: "选择要导入到的已保存 MySQL 连接",
      },
    );

    if (!selectedConnection) {
      await vscode.window.showInformationMessage("未选择 MySQL 连接。");
      return undefined;
    }

    return selectedConnection.connection;
  }

  /**
   * 提示用户选择目标 schema。
   *
   * @param {MysqlConnectionConfig} connection MySQL 连接配置。
   * @returns {Promise<string | undefined>} 用户选择的 schema 名称；未选择时为空。
   */
  private async pickSchema(connection: MysqlConnectionConfig): Promise<string | undefined> {
    try {
      const schemas = await this.listMySqlSchemasUseCase.execute(connection);
      if (schemas.length === 0) {
        await vscode.window.showInformationMessage(`连接“${connection.name}”下未找到 schema。`);
        return undefined;
      }

      const selectedSchema = await vscode.window.showQuickPick(
        schemas.map((schema) => ({
          label: schema.name,
          schemaName: schema.name,
        })),
        {
          title: "PPZ Plus: 选择 MySQL Schema",
          placeHolder: "选择 CSV 导入目标 schema",
        },
      );

      if (!selectedSchema) {
        await vscode.window.showInformationMessage("未选择 MySQL schema。");
        return undefined;
      }

      return selectedSchema.schemaName;
    } catch (error) {
      await showUserErrorMessage({
        operation: "加载 CSV 导入的 MySQL schema",
        error,
      });
      return undefined;
    }
  }

  /**
   * 提示用户选择目标表。
   *
   * @param {MysqlConnectionConfig} connection MySQL 连接配置。
   * @param {string} schemaName 已选择的 schema 名称。
   * @returns {Promise<string | undefined>} 用户选择的表名；未选择时为空。
   */
  private async pickTable(
    connection: MysqlConnectionConfig,
    schemaName: string,
  ): Promise<string | undefined> {
    try {
      const tables = await this.listMySqlTablesUseCase.execute(connection, schemaName);
      if (tables.length === 0) {
        await vscode.window.showInformationMessage(`schema“${schemaName}”中未找到表。`);
        return undefined;
      }

      const selectedTable = await vscode.window.showQuickPick(
        tables.map((table) => ({
          label: table.name,
          tableName: table.name,
        })),
        {
          title: "PPZ Plus: 选择 MySQL 表",
          placeHolder: "选择 CSV 导入目标表",
        },
      );

      if (!selectedTable) {
        await vscode.window.showInformationMessage("未选择 MySQL 表。");
        return undefined;
      }

      return selectedTable.tableName;
    } catch (error) {
      await showUserErrorMessage({
        operation: "加载 CSV 导入的 MySQL 表",
        error,
      });
      return undefined;
    }
  }

  /**
   * 提示用户选择一个 CSV 文件。
   *
   * @returns {Promise<string | undefined>} 用户选择的 CSV 文件路径；未选择时为空。
   */
  private async pickCsvFilePath(): Promise<string | undefined> {
    const selectedFiles = await vscode.window.showOpenDialog({
      canSelectFiles: true,
      canSelectFolders: false,
      canSelectMany: false,
      filters: {
        CSV文件: ["csv"],
      },
      title: "PPZ Plus: 选择要导入的 CSV 文件",
    });

    return selectedFiles?.[0]?.fsPath;
  }

  /**
   * 执行 CSV 文件导入并展示用户可见结果。
   *
   * @param {MysqlConnectionConfig} connection MySQL 连接配置。
   * @param {CsvTableImportTarget} target CSV 导入目标表。
   * @param {string} filePath CSV 文件路径。
   * @param {readonly ImportColumnMapping[]} mappings 字段映射配置。
   */
  private async importCsvFile(
    connection: MysqlConnectionConfig,
    target: CsvTableImportTarget,
    filePath: string,
    mappings: readonly ImportColumnMapping[],
  ): Promise<void> {
    const fileName = path.basename(filePath);
    const targetName = `${target.schemaName}.${target.tableName}`;
    let result: CsvFileImportResult | undefined;
    try {
      result = await vscode.window.withProgress(
        {
          cancellable: true,
          location: vscode.ProgressLocation.Notification,
          title: `正在导入 CSV“${fileName}”到“${targetName}”`,
        },
        async (progress, token) => {
          progress.report({ message: "正在准备导入..." });

          return this.importMySqlCsvFileUseCase.execute(
            connection,
            target,
            filePath,
            mappings,
            createVsCodeImportTaskProgressReporter(progress),
            createVsCodeCancellationSignal(token),
          );
        },
      );
    } catch (error) {
      if (isOperationCanceledError(error)) {
        await showTaskCanceledMessage("CSV 导入");
        return;
      }

      await showUserErrorMessage({
        operation: "导入 CSV 文件",
        error,
      });
      return;
    }

    if (!result) {
      return;
    }

    if (result.success) {
      await vscode.window.showInformationMessage(
        `已从“${fileName}”导入 ${result.insertedRows} 行到“${targetName}”，耗时 ${result.durationMs} ms。`,
      );
      return;
    }

    await showImportErrorReport(this.createImportErrorReportUseCase, {
      formatName: "CSV",
      fileName,
      targetName,
      stage: "execution",
      errorMessage: result.errorMessage ?? "未知错误。",
      mappings,
    });
  }
}
