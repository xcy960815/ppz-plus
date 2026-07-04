import { randomUUID } from "node:crypto";
import * as path from "node:path";

import * as vscode from "vscode";

import type { SaveConnectionConfigUseCase } from "../../application/useCases/SaveConnectionConfigUseCase";
import type { TestConnectionUseCase } from "../../application/useCases/TestConnectionUseCase";
import type { Sqlite3ConnectionConfig } from "../../domain/connections/ConnectionConfig";
import type { ExtensionCommand } from "./ExtensionCommand";
import {
  describeConnectionEngine,
  withConnectionTestProgress,
} from "./MySqlConnectionProgressPresenter";
import { extractUserErrorMessage, showUserErrorMessage } from "./UserErrorPresenter";
import { DatabaseConnectionsTreeDataProvider } from "../explorer/DatabaseConnectionsTreeDataProvider";
import { Sqlite3ConnectionsTreeDataProvider } from "../explorer/Sqlite3ConnectionsTreeDataProvider";

/**
 * 通过 VS Code 文件选择器创建新的 SQLite3 连接配置。
 */
export class AddSqlite3ConnectionCommand implements ExtensionCommand {
  /**
   * 保存 VS Code 命令标识。
   */
  public static readonly id = "ppz-plus.addSqlite3Connection";

  /**
   * 通过命令契约暴露命令标识。
   */
  public readonly id = AddSqlite3ConnectionCommand.id;

  /**
   * 创建新增 SQLite3 连接命令。
   *
   * @param saveConnectionConfigUseCase 用于持久化新连接的用例。
   * @param testConnectionUseCase 用于测试新连接可达性的用例。
   * @param treeDataProvider 用于刷新数据库连接树。
   * @param sqlite3TreeDataProvider 用于刷新 SQLite3 连接树。
   */
  public constructor(
    private readonly saveConnectionConfigUseCase: SaveConnectionConfigUseCase,
    private readonly testConnectionUseCase: TestConnectionUseCase,
    private readonly treeDataProvider: DatabaseConnectionsTreeDataProvider,
    private readonly sqlite3TreeDataProvider: Sqlite3ConnectionsTreeDataProvider,
  ) {}

  /**
   * 向 VS Code 注册命令。
   *
   * @returns {vscode.Disposable} 命令注册的可释放句柄。
   */
  public register(): vscode.Disposable {
    return vscode.commands.registerCommand(this.id, async () => {
      await this.createConnection();
    });
  }

  /**
   * 收集 SQLite3 连接信息并保存。
   */
  private async createConnection(): Promise<void> {
    const config = await AddSqlite3ConnectionCommand.collectSqlite3Config();

    if (!config) {
      return;
    }

    try {
      await this.saveConnectionConfigUseCase.execute(config);
      this.treeDataProvider.refresh();
      this.sqlite3TreeDataProvider.refresh();

      const shouldTest = await vscode.window.showInformationMessage(
        `已保存 ${describeConnectionEngine(config)} 连接“${config.name}”。`,
        "测试连接",
      );

      if (shouldTest === "测试连接") {
        await withConnectionTestProgress(config, () => this.testConnectionUseCase.execute(config));
        await vscode.window.showInformationMessage(`已连接到 SQLite3 数据库“${config.name}”。`);
      }
    } catch (error) {
      await vscode.window.showWarningMessage(
        `保存 SQLite3 连接失败：${extractUserErrorMessage(error)}`,
      );
      await showUserErrorMessage({
        operation: "保存 SQLite3 连接",
        error,
      });
    }
  }

  /**
   * 提示用户选择 SQLite3 数据库文件和连接名称。
   *
   * @param {Sqlite3ConnectionConfig} existingConfig 编辑时已有的连接配置。
   * @returns {Promise<Sqlite3ConnectionConfig | undefined>} 最终得到的 SQLite3 连接配置。
   */
  public static async collectSqlite3Config(
    existingConfig?: Sqlite3ConnectionConfig,
  ): Promise<Sqlite3ConnectionConfig | undefined> {
    const selectedFiles = await vscode.window.showOpenDialog({
      title: "PPZ Plus: 选择 SQLite3 数据库文件",
      canSelectFiles: true,
      canSelectFolders: false,
      canSelectMany: false,
      defaultUri: existingConfig ? vscode.Uri.file(existingConfig.dbPath) : undefined,
      filters: {
        SQLite3: ["db", "sqlite", "sqlite3"],
        All: ["*"],
      },
    });
    const selectedFile = selectedFiles?.[0];

    if (!selectedFile) {
      return undefined;
    }

    const dbPath = selectedFile.fsPath;
    const name = await vscode.window.showInputBox({
      title: "PPZ Plus: SQLite3 连接名称",
      prompt: "输入连接显示名称",
      value: existingConfig?.name ?? path.basename(dbPath, path.extname(dbPath)) ?? "SQLite3 连接",
      validateInput: (value) => (value.trim().length > 0 ? undefined : "请输入连接名称。"),
    });

    if (!name) {
      return undefined;
    }

    return {
      id: existingConfig?.id ?? randomUUID(),
      engine: "sqlite3",
      mode: "file",
      name: name.trim(),
      dbPath,
    };
  }
}
