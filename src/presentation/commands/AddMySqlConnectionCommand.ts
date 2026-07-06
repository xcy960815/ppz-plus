import { randomUUID } from "node:crypto";
import * as path from "node:path";

import * as vscode from "vscode";

import type { SaveConnectionConfigUseCase } from "../../application/useCases/SaveConnectionConfigUseCase";
import type { TestConnectionUseCase } from "../../application/useCases/TestConnectionUseCase";
import type {
  ConnectionInputMode,
  ConnectionConfig,
  CockroachDbConnectionConfig,
  MariaDbConnectionConfig,
  MssqlConnectionConfig,
  MysqlConnectionConfig,
  PostgreSqlConnectionConfig,
  Sqlite3ConnectionConfig,
} from "../../domain/connections/ConnectionConfig";
import {
  validateConnectionUrlForEngine,
  validateMysqlUrl,
  validatePostgreSqlUrl,
} from "../../domain/connections/ConnectionUrlValidator";
import type { ExtensionCommand } from "./ExtensionCommand";
import {
  describeConnectionEngine,
  withConnectionTestProgress,
} from "./MySqlConnectionProgressPresenter";
import { extractUserErrorMessage, showUserErrorMessage } from "./UserErrorPresenter";
import { DatabaseConnectionsTreeDataProvider } from "../explorer/DatabaseConnectionsTreeDataProvider";
import {
  buildWebviewCspMeta,
  createWebviewNonce,
  serializeScriptValue,
} from "../shared/WebviewHtml";
import { Sqlite3ConnectionsTreeDataProvider } from "../explorer/Sqlite3ConnectionsTreeDataProvider";

/**
 * 描述连接表单 Webview 发回的保存动作。
 */
interface MySqlConnectionFormSaveMessage {
  readonly type: "save" | "saveAndTest";
  readonly payload: MySqlConnectionFormPayload;
}

/**
 * 描述连接表单请求选择 SQLite3 文件的消息。
 */
interface MySqlConnectionFormSelectSqlite3FileMessage {
  readonly type: "selectSqlite3File";
}

/**
 * 描述连接表单 Webview 发回的原始字段。
 */
interface MySqlConnectionFormPayload {
  readonly engine: ConnectionConfig["engine"];
  readonly name: string;
  readonly mode: Extract<ConnectionInputMode, "parameters" | "url">;
  readonly host: string;
  readonly port: string;
  readonly username: string;
  readonly password: string;
  readonly database: string;
  readonly url: string;
  readonly dbPath: string;
  readonly encrypt: boolean;
  readonly trustServerCertificate: boolean;
  readonly ssl: boolean;
}

/**
 * 描述连接表单 Webview 可发送的消息。
 */
type MySqlConnectionFormMessage =
  MySqlConnectionFormSaveMessage | MySqlConnectionFormSelectSqlite3FileMessage;

/**
 * 描述连接表单的打开模式。
 */
type MySqlConnectionFormMode = "create" | "edit" | "details";

/**
 * 描述连接表单打开时的上下文。
 */
interface MySqlConnectionFormContext {
  readonly mode: MySqlConnectionFormMode;
  readonly initialConnection?: ConnectionConfig;
}

/**
 * 通过 VS Code Webview 表单创建新的 MySQL 连接配置。
 */
export class AddMySqlConnectionCommand implements ExtensionCommand {
  /**
   * 保存 VS Code 命令标识。
   */
  public static readonly id = "ppz-plus.addMySqlConnection";

  /**
   * 通过命令契约暴露命令标识。
   */
  public readonly id = AddMySqlConnectionCommand.id;

  /**
   * 创建新增 MySQL 连接命令。
   *
   * @param saveConnectionConfigUseCase 用于持久化新连接的用例。
   * @param testConnectionUseCase 用于测试新连接可达性的用例。
   * @param treeDataProvider 用于刷新混合数据库连接树。
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
    return vscode.commands.registerCommand(
      this.id,
      (initialConnection?: ConnectionConfig, formMode?: MySqlConnectionFormMode) => {
        const mode: MySqlConnectionFormMode = initialConnection ? (formMode ?? "edit") : "create";

        this.openConnectionForm({
          mode,
          initialConnection,
        });
      },
    );
  }

  /**
   * 打开数据库连接表单。
   *
   * @param {MySqlConnectionFormContext} context 连接表单打开时的上下文。
   */
  private openConnectionForm(context: MySqlConnectionFormContext): void {
    const panelTitle =
      context.mode === "details"
        ? `连接详情：${context.initialConnection?.name ?? ""}`
        : context.mode === "edit"
          ? `编辑连接：${context.initialConnection?.name ?? ""}`
          : "创建连接";
    const panel = vscode.window.createWebviewPanel(
      "ppzPlus.addMySqlConnection",
      panelTitle,
      vscode.ViewColumn.Active,
      {
        enableScripts: true,
      },
    );

    panel.webview.html = this.renderConnectionFormHtml(panel.webview.cspSource, context);
    panel.webview.onDidReceiveMessage(async (message: MySqlConnectionFormMessage) => {
      await this.handleConnectionFormMessage(panel, message, context);
    });
  }

  /**
   * 处理连接表单提交动作。
   *
   * @param {vscode.WebviewPanel} panel 当前连接表单面板。
   * @param {MySqlConnectionFormMessage} message Webview 发回的表单消息。
   * @param {MySqlConnectionFormContext} context 连接表单打开时的上下文。
   */
  private async handleConnectionFormMessage(
    panel: vscode.WebviewPanel,
    message: MySqlConnectionFormMessage,
    context: MySqlConnectionFormContext,
  ): Promise<void> {
    if (context.mode === "details") {
      return;
    }

    if (message.type === "selectSqlite3File") {
      await this.handleSqlite3FileSelection(panel);
      return;
    }

    const config = this.createConfigFromFormPayload(message.payload, context.initialConnection);
    if (!config.success) {
      await vscode.window.showErrorMessage(config.errorMessage);
      return;
    }

    try {
      await this.saveConnectionConfigUseCase.execute(config.value);
    } catch (error) {
      await showUserErrorMessage({
        operation: `保存 ${describeConnectionEngine(config.value)} 连接`,
        error,
      });
      return;
    }

    this.treeDataProvider.refresh();
    this.sqlite3TreeDataProvider.refresh();

    if (message.type === "saveAndTest") {
      try {
        await withConnectionTestProgress(config.value, () =>
          this.testConnectionUseCase.execute(config.value),
        );
        await vscode.window.showInformationMessage(
          context.mode === "edit"
            ? `已更新并连接到 ${describeConnectionEngine(config.value)} 连接“${config.value.name}”。`
            : `已保存并连接到 ${describeConnectionEngine(config.value)} 连接“${config.value.name}”。`,
        );
        panel.dispose();
      } catch (error) {
        await vscode.window.showWarningMessage(
          context.mode === "edit"
            ? `已更新“${config.value.name}”，但连接测试失败：${extractUserErrorMessage(error)}`
            : `已保存“${config.value.name}”，但连接测试失败：${extractUserErrorMessage(error)}`,
        );
      }
      return;
    }

    await vscode.window.showInformationMessage(
      context.mode === "edit"
        ? `已更新 ${describeConnectionEngine(config.value)} 连接“${config.value.name}”。`
        : `已保存 ${describeConnectionEngine(config.value)} 连接“${config.value.name}”。`,
    );
    panel.dispose();
  }

  /**
   * 打开 SQLite3 数据库文件选择器，并把结果回填到 Webview。
   *
   * @param {vscode.WebviewPanel} panel 当前连接表单面板。
   */
  private async handleSqlite3FileSelection(panel: vscode.WebviewPanel): Promise<void> {
    const selectedFiles = await vscode.window.showOpenDialog({
      title: "PPZ Plus: 选择 SQLite3 数据库文件",
      canSelectFiles: true,
      canSelectFolders: false,
      canSelectMany: false,
      filters: {
        SQLite3: ["db", "sqlite", "sqlite3"],
        All: ["*"],
      },
    });
    const selectedFile = selectedFiles?.[0];

    if (!selectedFile) {
      return;
    }

    const dbPath = selectedFile.fsPath;
    await panel.webview.postMessage({
      type: "sqlite3FileSelected",
      dbPath,
      suggestedName: path.basename(dbPath, path.extname(dbPath)),
    });
  }

  /**
   * 将 Webview 表单字段转换为连接配置。
   *
   * @param {MySqlConnectionFormPayload} payload Webview 发回的原始字段。
   * @param {ConnectionConfig} existingConnection 编辑时已有的连接配置。
   * @returns 转换成功时返回连接配置，否则返回错误信息。
   */
  private createConfigFromFormPayload(
    payload: MySqlConnectionFormPayload,
    existingConnection?: ConnectionConfig,
  ):
    | {
        readonly success: true;
        readonly value: ConnectionConfig;
      }
    | {
        readonly success: false;
        readonly errorMessage: string;
      } {
    const name = payload.name.trim();
    if (name.length === 0) {
      return {
        success: false,
        errorMessage: "请输入连接名称。",
      };
    }

    const connectionId = existingConnection?.id ?? randomUUID();

    if (payload.engine === "sqlite3") {
      const dbPath = payload.dbPath.trim();
      if (dbPath.length === 0) {
        return {
          success: false,
          errorMessage: "请选择 SQLite3 数据库文件。",
        };
      }

      return {
        success: true,
        value: {
          id: connectionId,
          engine: "sqlite3",
          mode: "file",
          name,
          dbPath,
        } satisfies Sqlite3ConnectionConfig,
      };
    }

    if (payload.mode === "url") {
      const urlValidation = validateConnectionUrlForEngine(payload.engine, payload.url);
      if (urlValidation) {
        return {
          success: false,
          errorMessage: urlValidation,
        };
      }

      if (payload.engine === "postgresql") {
        return {
          success: true,
          value: {
            id: connectionId,
            engine: "postgresql",
            mode: "url",
            name,
            url: payload.url.trim(),
          },
        };
      }

      if (payload.engine === "mssql") {
        return {
          success: true,
          value: {
            id: connectionId,
            engine: "mssql",
            mode: "url",
            name,
            url: payload.url.trim(),
          } satisfies MssqlConnectionConfig,
        };
      }

      if (payload.engine === "cockroachdb") {
        return {
          success: true,
          value: {
            id: connectionId,
            engine: "cockroachdb",
            mode: "url",
            name,
            url: payload.url.trim(),
          } satisfies CockroachDbConnectionConfig,
        };
      }

      if (payload.engine === "mariadb") {
        return {
          success: true,
          value: {
            id: connectionId,
            engine: "mariadb",
            mode: "url",
            name,
            url: payload.url.trim(),
          } satisfies MariaDbConnectionConfig,
        };
      }

      return {
        success: true,
        value: {
          id: connectionId,
          engine: "mysql",
          mode: "url",
          name,
          url: payload.url.trim(),
        },
      };
    }

    const host = payload.host.trim();
    if (host.length === 0) {
      return {
        success: false,
        errorMessage: "请输入 host。",
      };
    }

    const port = AddMySqlConnectionCommand.parsePort(payload.port);
    if (port === undefined) {
      return {
        success: false,
        errorMessage: "port 必须是正整数。",
      };
    }

    const username = payload.username.trim();
    if (username.length === 0) {
      return {
        success: false,
        errorMessage: "请输入 user。",
      };
    }

    if (payload.engine === "postgresql") {
      return {
        success: true,
        value: {
          id: connectionId,
          engine: "postgresql",
          mode: "parameters",
          name,
          host,
          port,
          username,
          password: payload.password || undefined,
          database: payload.database.trim() || undefined,
        },
      };
    }

    if (payload.engine === "mssql") {
      return {
        success: true,
        value: {
          id: connectionId,
          engine: "mssql",
          mode: "parameters",
          name,
          host,
          port,
          username,
          password: payload.password || undefined,
          database: payload.database.trim() || undefined,
          encrypt: payload.encrypt,
          trustServerCertificate: payload.trustServerCertificate,
        } satisfies MssqlConnectionConfig,
      };
    }

    if (payload.engine === "cockroachdb") {
      return {
        success: true,
        value: {
          id: connectionId,
          engine: "cockroachdb",
          mode: "parameters",
          name,
          host,
          port,
          username,
          password: payload.password || undefined,
          database: payload.database.trim() || undefined,
          ssl: payload.ssl,
        } satisfies CockroachDbConnectionConfig,
      };
    }

    if (payload.engine === "mariadb") {
      return {
        success: true,
        value: {
          id: connectionId,
          engine: "mariadb",
          mode: "parameters",
          name,
          host,
          port,
          username,
          password: payload.password || undefined,
          database: payload.database.trim() || undefined,
        } satisfies MariaDbConnectionConfig,
      };
    }

    return {
      success: true,
      value: {
        id: connectionId,
        engine: "mysql",
        mode: "parameters",
        name,
        host,
        port,
        username,
        password: payload.password || undefined,
        database: payload.database.trim() || undefined,
      },
    };
  }

  /**
   * 提示用户填写 MySQL 连接详情。
   *
   * @param {ConnectionInputMode} mode 用户选择的连接输入模式。
   * @param {MysqlConnectionConfig} existingConfig 编辑时已有的连接配置。
   * @returns {Promise<MysqlConnectionConfig | undefined>} 最终得到的 MySQL 连接配置。
   */
  public static async collectMySqlConfig(
    mode: ConnectionInputMode,
    existingConfig?: MysqlConnectionConfig,
  ): Promise<MysqlConnectionConfig | undefined> {
    const name = await vscode.window.showInputBox({
      title: "PPZ Plus: MySQL 连接名称",
      prompt: "输入连接显示名称",
      value: existingConfig?.name ?? "MySQL 连接",
      validateInput: (value) => (value.trim().length > 0 ? undefined : "请输入连接名称。"),
    });
    if (!name) {
      return undefined;
    }

    /**
     * 编辑时保留原有标识，新建时生成新的标识。
     */
    const connectionId = existingConfig?.id ?? randomUUID();

    if (mode === "url") {
      const url = await vscode.window.showInputBox({
        title: "PPZ Plus: MySQL 连接 URL",
        prompt: "输入 mysql:// 连接 URL",
        value:
          existingConfig?.mode === "url"
            ? existingConfig.url
            : "mysql://root:password@127.0.0.1:3306/mysql",
        validateInput: (value) => validateMysqlUrl(value),
      });
      if (!url) {
        return undefined;
      }

      return {
        id: connectionId,
        engine: "mysql",
        mode: "url",
        name: name.trim(),
        url,
      };
    }

    const host = await vscode.window.showInputBox({
      title: "PPZ Plus: MySQL Host",
      prompt: "输入 MySQL 服务 host",
      value: existingConfig?.mode === "parameters" ? existingConfig.host : "127.0.0.1",
      validateInput: (value) => (value.trim().length > 0 ? undefined : "请输入 host。"),
    });
    if (!host) {
      return undefined;
    }

    const portInput = await vscode.window.showInputBox({
      title: "PPZ Plus: MySQL Port",
      prompt: "输入 MySQL 服务端口",
      value: existingConfig?.mode === "parameters" ? String(existingConfig.port) : "3306",
      validateInput: (value) =>
        AddMySqlConnectionCommand.parsePort(value) === undefined
          ? "port 必须是正整数。"
          : undefined,
    });
    if (!portInput) {
      return undefined;
    }

    const username = await vscode.window.showInputBox({
      title: "PPZ Plus: MySQL User",
      prompt: "输入 MySQL 用户名",
      value: existingConfig?.mode === "parameters" ? existingConfig.username : "root",
      validateInput: (value) => (value.trim().length > 0 ? undefined : "请输入 user。"),
    });
    if (!username) {
      return undefined;
    }

    const password = await vscode.window.showInputBox({
      title: "PPZ Plus: MySQL Password",
      prompt: "输入 MySQL 密码（可选）",
      password: true,
      value: existingConfig?.mode === "parameters" ? (existingConfig.password ?? "") : "",
    });
    if (password === undefined) {
      return undefined;
    }

    const database = await vscode.window.showInputBox({
      title: "PPZ Plus: 默认 Database",
      prompt: "输入默认 database（可选）",
      value: existingConfig?.mode === "parameters" ? (existingConfig.database ?? "") : "",
    });
    if (database === undefined) {
      return undefined;
    }

    return {
      id: connectionId,
      engine: "mysql",
      mode: "parameters",
      name: name.trim(),
      host: host.trim(),
      port: AddMySqlConnectionCommand.parsePort(portInput) ?? 3306,
      username: username.trim(),
      password: password || undefined,
      database: database.trim() || undefined,
    };
  }

  /**
   * 提示用户填写 PostgreSQL 连接详情。
   *
   * @param {ConnectionInputMode} mode 用户选择的连接输入模式。
   * @param {PostgreSqlConnectionConfig} existingConfig 编辑时已有的连接配置。
   * @returns {Promise<PostgreSqlConnectionConfig | undefined>} 最终得到的 PostgreSQL 连接配置。
   */
  public static async collectPostgreSqlConfig(
    mode: ConnectionInputMode,
    existingConfig?: PostgreSqlConnectionConfig,
  ): Promise<PostgreSqlConnectionConfig | undefined> {
    const name = await vscode.window.showInputBox({
      title: "PPZ Plus: PostgreSQL 连接名称",
      prompt: "输入连接显示名称",
      value: existingConfig?.name ?? "PostgreSQL 连接",
      validateInput: (value) => (value.trim().length > 0 ? undefined : "请输入连接名称。"),
    });
    if (!name) {
      return undefined;
    }

    const connectionId = existingConfig?.id ?? randomUUID();

    if (mode === "url") {
      const url = await vscode.window.showInputBox({
        title: "PPZ Plus: PostgreSQL 连接 URL",
        prompt: "输入 postgresql:// 或 postgres:// 连接 URL",
        value:
          existingConfig?.mode === "url"
            ? existingConfig.url
            : "postgresql://postgres:password@127.0.0.1:5432/postgres",
        validateInput: (value) => validatePostgreSqlUrl(value),
      });
      if (!url) {
        return undefined;
      }

      return {
        id: connectionId,
        engine: "postgresql",
        mode: "url",
        name: name.trim(),
        url,
      };
    }

    const host = await vscode.window.showInputBox({
      title: "PPZ Plus: PostgreSQL Host",
      prompt: "输入 PostgreSQL 服务 host",
      value: existingConfig?.mode === "parameters" ? existingConfig.host : "127.0.0.1",
      validateInput: (value) => (value.trim().length > 0 ? undefined : "请输入 host。"),
    });
    if (!host) {
      return undefined;
    }

    const portInput = await vscode.window.showInputBox({
      title: "PPZ Plus: PostgreSQL Port",
      prompt: "输入 PostgreSQL 服务端口",
      value: existingConfig?.mode === "parameters" ? String(existingConfig.port) : "5432",
      validateInput: (value) =>
        AddMySqlConnectionCommand.parsePort(value) === undefined
          ? "port 必须是正整数。"
          : undefined,
    });
    if (!portInput) {
      return undefined;
    }

    const username = await vscode.window.showInputBox({
      title: "PPZ Plus: PostgreSQL User",
      prompt: "输入 PostgreSQL 用户名",
      value: existingConfig?.mode === "parameters" ? existingConfig.username : "postgres",
      validateInput: (value) => (value.trim().length > 0 ? undefined : "请输入 user。"),
    });
    if (!username) {
      return undefined;
    }

    const password = await vscode.window.showInputBox({
      title: "PPZ Plus: PostgreSQL Password",
      prompt: "输入 PostgreSQL 密码（可选）",
      password: true,
      value: existingConfig?.mode === "parameters" ? (existingConfig.password ?? "") : "",
    });
    if (password === undefined) {
      return undefined;
    }

    const database = await vscode.window.showInputBox({
      title: "PPZ Plus: 默认 Database",
      prompt: "输入默认 database（可选）",
      value:
        existingConfig?.mode === "parameters"
          ? (existingConfig.database ?? "postgres")
          : "postgres",
    });
    if (database === undefined) {
      return undefined;
    }

    return {
      id: connectionId,
      engine: "postgresql",
      mode: "parameters",
      name: name.trim(),
      host: host.trim(),
      port: AddMySqlConnectionCommand.parsePort(portInput) ?? 5432,
      username: username.trim(),
      password: password || undefined,
      database: database.trim() || undefined,
    };
  }

  /**
   * 创建连接表单 Webview HTML。
   *
   * @param {string} cspSource Webview 资源来源，用于构建 CSP。
   * @param {MySqlConnectionFormContext} context 连接表单打开时的上下文。
   * @returns {string} 可渲染到 Webview 的 HTML 文档。
   */
  private renderConnectionFormHtml(cspSource: string, context: MySqlConnectionFormContext): string {
    const nonce = createWebviewNonce();
    const cspMeta = buildWebviewCspMeta(cspSource, nonce);
    const isEditing = context.mode === "edit";
    const isReadOnly = context.mode === "details";
    const pageTitle = isReadOnly ? "连接详情" : isEditing ? "编辑连接" : "创建连接";
    const formButtonsStyle = isReadOnly ? ' style="display: none;"' : "";
    const initialConnection = serializeScriptValue(context.initialConnection ?? null);
    const readOnlyForm = serializeScriptValue(isReadOnly);

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
	<meta charset="UTF-8" />
	${cspMeta}
	<meta name="viewport" content="width=device-width, initial-scale=1.0" />
	<title>${pageTitle}</title>
	<style>
		:root {
			color-scheme: light dark;
		}
		body {
			--border1-18: 1px solid var(--vscode-panel-border);
			--border-focus: 1px solid var(--vscode-focusBorder);
			--border-radius: .25rem;
			margin: 0;
			padding: 0;
			font-family: var(--vscode-font-family);
			background: var(--vscode-editor-background);
			color: var(--vscode-editor-foreground);
			line-height: 1;
		}
		.flex-container {
			width: 100%;
			height: 100vh;
			display: flex;
			align-items: center;
			justify-content: center;
			flex-direction: column;
		}
		.form-container {
			width: 100%;
		}
		.forms {
			width: 100%;
		}
		.form {
			max-width: 666px;
			margin: 0 auto;
		}
		.public.form {
			padding-bottom: 1.16em;
			border-bottom: var(--border1-18);
			margin-bottom: 1.36em;
		}
		.form > .label,
		.form > label {
			display: inline-flex;
			align-items: center;
			line-height: 2em;
			min-width: 22em;
			margin: .8em 1.5em;
		}
		.form > label > span:first-child,
		.form > .label > span:first-child {
			display: block;
			min-width: 5em;
			text-align: right;
		}
		input[type="text"],
		input[type="password"],
		input[type="number"],
		input[type="url"] {
			display: block;
			flex: 1;
			margin-left: 1em;
			box-sizing: border-box;
			height: 2em;
			border: 1px solid var(--vscode-input-border);
			border-radius: 2px;
			background: var(--vscode-input-background);
			color: var(--vscode-input-foreground);
			padding: 0 .6em;
			font: inherit;
			outline: none;
		}
		input:focus {
			border: 1px solid var(--vscode-focusBorder);
		}
		.ppz-radio-group {
			display: flex;
			flex: 1;
			margin-left: 1em;
			align-items: center;
			gap: .8em;
			white-space: nowrap;
		}
		.ppz-radio-group label {
			display: flex;
			align-items: center;
			gap: .28em;
		}
		.conn-type {
			position: relative;
		}
		.conn-type .url-mode-hint {
			position: absolute;
			top: 50%;
			left: 80%;
			right: -100%;
			display: inline-flex;
			align-items: center;
			gap: .36em;
			height: 2em;
			transform: translateY(-50%);
			font-size: .9em;
			opacity: .9;
			line-height: 1;
			color: var(--vscode-descriptionForeground);
			white-space: nowrap;
		}
		.url-mode-hint a {
			display: inline-flex;
			align-items: center;
			line-height: 1;
			cursor: pointer;
		}
		.unsupported-option {
			opacity: .6;
		}
		.url-field {
			display: none;
		}
		.sqlite3-file-field {
			display: none;
		}
		.sqlite3-file-field input {
			min-width: 0;
		}
		.sqlite3-file-field button {
			margin-left: .8em;
			flex: 0 0 auto;
		}
		.form > .label.long-txt,
		.form > label.long-txt {
			width: 36em;
		}
		button {
			outline: none;
			border: none;
			background: var(--vscode-button-background);
			color: var(--vscode-button-foreground);
			border-radius: 1px;
			font-size: .95em;
			display: inline-block;
			height: 2em;
			min-width: 6em;
			padding: 0 1em;
			cursor: pointer;
		}
		button:not([disabled]):hover {
			background: var(--vscode-button-hoverBackground);
		}
		.form-btns {
			margin-top: 3.8em;
			text-align: center;
		}
		.form-btns button:not(:first-child) {
			margin-left: 1.2em;
		}
		.error {
			min-height: 20px;
			margin-top: 1em;
			text-align: center;
			color: var(--vscode-errorForeground);
		}
		.tttips {
			position: fixed;
			right: 1em;
			bottom: .5em;
			opacity: .9;
			font-size: .8em;
			line-height: 1.5;
			color: var(--vscode-descriptionForeground);
		}
		a {
			color: var(--vscode-textLink-foreground);
			text-decoration: none;
		}
		@media (max-width: 760px) {
			.flex-container {
				height: auto;
				min-height: 100vh;
				padding: 24px 0;
			}
			.form > .label,
			.form > label,
			.form > .label.long-txt,
			.form > label.long-txt {
				display: flex;
				width: auto;
				min-width: 0;
				margin: .8em 1em;
			}
			.conn-type .url-mode-hint {
				position: static;
				height: auto;
				margin-left: 1em;
				transform: none;
				line-height: 1.4;
				white-space: normal;
			}
			.tttips {
				position: static;
				margin: 2em 1em 0;
				text-align: right;
			}
		}
	</style>
</head>
<body>
	<div id="vue-app" class="flex-container">
		<div class="form-container">
			<div class="forms">
				<div class="public form">
					<label>
						<span>name</span>
						<input id="name" type="text" value="未命名连接" autocomplete="off" />
					</label>
					<div class="label">
						<span>连接类型</span>
						<div class="ppz-radio-group">
							<label><input name="engine" type="radio" value="mysql" checked /> MySQL</label>
							<label><input name="engine" type="radio" value="mssql" /> SQL Server</label>
							<label><input name="engine" type="radio" value="postgresql" /> PostgreSQL</label>
							<label><input name="engine" type="radio" value="sqlite3" /> SQLite3</label>
							<label><input name="engine" type="radio" value="cockroachdb" /> CockroachDB</label>
							<label><input name="engine" type="radio" value="mariadb" /> MariaDB</label>
						</div>
					</div>
					<br>
					<div id="modeRow" class="label conn-type">
						<span>连接方式</span>
						<div class="ppz-radio-group">
							<label>
								<input name="mode" type="radio" value="parameters" checked />
								字段
							</label>
							<label>
								<input name="mode" type="radio" value="url" />
								URL
							</label>
						</div>
						<span class="url-mode-hint">
							<span>如果下面没有你需要的字段，可以尝试</span>
							<a id="selectUrlModeLink" class="link-button">使用 URL 连接方式</a>
						</span>
					</div>
				</div>
				<div class="private form">
					<label class="parameter-field">
						<span>host</span>
						<input id="host" type="text" value="127.0.0.1" autocomplete="off" />
					</label>
					<label class="parameter-field">
						<span>port</span>
						<input id="port" type="number" min="1" value="3306" autocomplete="off" />
					</label>
					<label class="parameter-field">
						<span>user</span>
						<input id="username" type="text" value="root" autocomplete="off" />
					</label>
					<label class="parameter-field">
						<span>password</span>
						<input id="password" type="password" autocomplete="new-password" />
					</label>
					<label class="parameter-field">
						<span>database</span>
						<input id="database" type="text" autocomplete="off" />
					</label>
					<label class="parameter-field mssql-option">
						<span>encrypt</span>
						<input id="encrypt" type="checkbox" checked />
					</label>
					<label class="parameter-field mssql-option">
						<span>trust cert</span>
						<input id="trustServerCertificate" type="checkbox" />
					</label>
					<label class="parameter-field cockroachdb-option">
						<span>ssl</span>
						<input id="ssl" type="checkbox" checked />
					</label>
					<label id="urlField" class="long-txt url-field">
						<span>URL</span>
						<input id="url" type="url" value="mysql://root:password@127.0.0.1:3306/mysql" autocomplete="off" />
					</label>
					<label id="sqlite3FileField" class="long-txt sqlite3-file-field">
						<span>database file</span>
						<input id="dbPath" type="text" readonly autocomplete="off" />
						<button type="button" id="selectSqlite3FileButton">选择文件</button>
					</label>
				</div>
			</div>
		</div>
		<div id="error" class="error"></div>
		<div class="form-btns"${formButtonsStyle}>
			<button id="saveAndTestButton" data-submit="saveAndTest">${isEditing ? "更新并连接" : "保存并连接"}</button>
			<button id="saveButton" data-submit="save">${isEditing ? "更新" : "保存"}</button>
		</div>
	</div>

	<div class="tttips">
		* 新增的 SQL Server、CockroachDB、MariaDB 当前先保存连接配置，驱动能力按路线图继续接入
	</div>

	<script nonce="${nonce}">
		const vscode = acquireVsCodeApi();
		const initialConnection = ${initialConnection};
		const readOnlyForm = ${readOnlyForm};

		function selectedEngine() {
			return document.querySelector('input[name="engine"]:checked').value;
		}

		function selectedMode() {
			return document.querySelector('input[name="mode"]:checked').value;
		}

		function syncEngine() {
			const engine = selectedEngine();
			const port = document.getElementById('port');
			const username = document.getElementById('username');
			const database = document.getElementById('database');
			const url = document.getElementById('url');
			const isSqlite3 = engine === 'sqlite3';
			const defaults = connectionDefaults(engine);

			document.getElementById('modeRow').style.display = isSqlite3 ? 'none' : 'inline-flex';

			if (isSqlite3) {
				syncMode();
				document.getElementById('error').textContent = '';
				return;
			}

			if (isKnownDefaultPort(port.value)) {
				port.value = defaults.port;
			}
			if (isKnownDefaultUsername(username.value)) {
				username.value = defaults.username;
			}
			if (!database.value || isKnownDefaultDatabase(database.value)) {
				database.value = defaults.database;
			}
			if (isKnownDefaultUrl(url.value)) {
				url.value = defaults.url;
			}
			syncMode();
			document.getElementById('error').textContent = '';
		}

		function syncMode() {
			const mode = selectedMode();
			const engine = selectedEngine();
			const isSqlite3 = engine === 'sqlite3';
			document.getElementById('modeRow').style.display = isSqlite3 ? 'none' : 'inline-flex';
			document.querySelectorAll('.parameter-field').forEach((field) => {
				field.style.display = !isSqlite3 && mode === 'parameters' ? 'inline-flex' : 'none';
			});
			document.querySelectorAll('.mssql-option').forEach((field) => {
				field.style.display = !isSqlite3 && mode === 'parameters' && engine === 'mssql' ? 'inline-flex' : 'none';
			});
			document.querySelectorAll('.cockroachdb-option').forEach((field) => {
				field.style.display = !isSqlite3 && mode === 'parameters' && engine === 'cockroachdb' ? 'inline-flex' : 'none';
			});
			document.getElementById('urlField').style.display = !isSqlite3 && mode === 'url' ? 'inline-flex' : 'none';
			document.getElementById('sqlite3FileField').style.display = isSqlite3 ? 'inline-flex' : 'none';
			document.getElementById('error').textContent = '';
		}

		function connectionDefaults(engine) {
			const defaults = {
				mysql: {
					port: '3306',
					username: 'root',
					database: '',
					url: 'mysql://root:password@127.0.0.1:3306/mysql'
				},
				postgresql: {
					port: '5432',
					username: 'postgres',
					database: 'postgres',
					url: 'postgresql://postgres:password@127.0.0.1:5432/postgres'
				},
				mssql: {
					port: '1433',
					username: 'sa',
					database: 'master',
					url: 'mssql://sa:password@127.0.0.1:1433/master'
				},
				cockroachdb: {
					port: '26257',
					username: 'root',
					database: 'defaultdb',
					url: 'postgresql://root:password@127.0.0.1:26257/defaultdb'
				},
				mariadb: {
					port: '3306',
					username: 'root',
					database: '',
					url: 'mysql://root:password@127.0.0.1:3306/mysql'
				}
			};
			return defaults[engine] ?? defaults.mysql;
		}

		function isKnownDefaultPort(value) {
			return ['', '3306', '5432', '1433', '26257'].includes(value);
		}

		function isKnownDefaultUsername(value) {
			return ['', 'root', 'postgres', 'sa'].includes(value);
		}

		function isKnownDefaultDatabase(value) {
			return ['mysql', 'postgres', 'master', 'defaultdb'].includes(value);
		}

		function isKnownDefaultUrl(value) {
			return [
				'mysql://root:password@127.0.0.1:3306/mysql',
				'postgresql://postgres:password@127.0.0.1:5432/postgres',
				'mssql://sa:password@127.0.0.1:1433/master',
				'postgresql://root:password@127.0.0.1:26257/defaultdb'
			].includes(value);
		}

		function selectUrlMode() {
			document.querySelector('input[name="mode"][value="url"]').checked = true;
			syncMode();
		}

		function selectSqlite3File() {
			vscode.postMessage({ type: 'selectSqlite3File' });
		}

		function setRadioValue(name, value) {
			const input = document.querySelector('input[name="' + name + '"][value="' + value + '"]');
			if (input) {
				input.checked = true;
			}
		}

		function setValue(id, value) {
			document.getElementById(id).value = value ?? '';
		}

		function setChecked(id, value) {
			document.getElementById(id).checked = Boolean(value);
		}

		function hydrateInitialConnection() {
			if (!initialConnection) {
				syncEngine();
				syncMode();
				syncReadOnlyState();
				return;
			}

			setValue('name', initialConnection.name);
			setRadioValue('engine', initialConnection.engine);
			syncEngine();

			if (initialConnection.mode === 'file') {
				setValue('dbPath', initialConnection.dbPath);
				syncMode();
				syncReadOnlyState();
				return;
			}

			setRadioValue('mode', initialConnection.mode);
			if (initialConnection.mode === 'url') {
				setValue('url', initialConnection.url);
				syncMode();
				syncReadOnlyState();
				return;
			}

			setValue('host', initialConnection.host);
			setValue('port', String(initialConnection.port ?? ''));
			setValue('username', initialConnection.username);
			setValue('password', initialConnection.password);
			setValue('database', initialConnection.database);
			setChecked('encrypt', initialConnection.encrypt ?? true);
			setChecked('trustServerCertificate', initialConnection.trustServerCertificate);
			setChecked('ssl', initialConnection.ssl ?? true);
			syncMode();
			syncReadOnlyState();
		}

		function syncReadOnlyState() {
			if (!readOnlyForm) {
				return;
			}

			document.querySelectorAll('input, button').forEach((control) => {
				control.disabled = true;
			});
			document.getElementById('selectUrlModeLink')?.removeAttribute('href');
			document.getElementById('selectUrlModeLink')?.style.setProperty('pointer-events', 'none');
		}

		function readValue(id) {
			return document.getElementById(id).value;
		}

		function validate(payload) {
			if (!payload.name.trim()) {
				return '请输入连接名称。';
			}
			if (payload.engine === 'sqlite3') {
				return payload.dbPath.trim() ? '' : '请选择 SQLite3 数据库文件。';
			}
			if (payload.mode === 'url') {
				if (payload.engine === 'postgresql' || payload.engine === 'cockroachdb') {
					const url = payload.url.trim();
					if (!url.startsWith('postgresql://') && !url.startsWith('postgres://')) {
						return 'URL 必须以 postgresql:// 或 postgres:// 开头。';
					}
					return '';
				}
				if (payload.engine === 'mssql') {
					return payload.url.trim().startsWith('mssql://') ? '' : 'URL 必须以 mssql:// 开头。';
				}
				if (!payload.url.trim().startsWith('mysql://')) {
					return 'URL 必须以 mysql:// 开头。';
				}
				return '';
			}
			if (!payload.host.trim()) {
				return '请输入 host。';
			}
			if (!Number.isInteger(Number(payload.port)) || Number(payload.port) <= 0) {
				return 'port 必须是正整数。';
			}
			if (!payload.username.trim()) {
				return '请输入 user。';
			}
			return '';
		}

		function submitForm(type) {
			const payload = {
				engine: selectedEngine(),
				name: readValue('name'),
				mode: selectedMode(),
				host: readValue('host'),
				port: readValue('port'),
				username: readValue('username'),
				password: readValue('password'),
				database: readValue('database'),
				url: readValue('url'),
				dbPath: readValue('dbPath'),
				encrypt: document.getElementById('encrypt').checked,
				trustServerCertificate: document.getElementById('trustServerCertificate').checked,
				ssl: document.getElementById('ssl').checked
			};
			const error = validate(payload);
			document.getElementById('error').textContent = error;
			if (error) {
				return;
			}
			vscode.postMessage({ type, payload });
		}

		window.addEventListener('message', (event) => {
			const message = event.data;
			if (message.type !== 'sqlite3FileSelected') {
				return;
			}

			document.getElementById('dbPath').value = message.dbPath;
			const nameInput = document.getElementById('name');
			if (nameInput.value === '未命名连接' && message.suggestedName) {
				nameInput.value = message.suggestedName;
			}
			document.getElementById('error').textContent = '';
		});

		document.querySelectorAll('input[name="engine"]').forEach((input) => {
			input.addEventListener('change', () => syncEngine());
		});
		document.querySelectorAll('input[name="mode"]').forEach((input) => {
			input.addEventListener('change', () => syncMode());
		});
		document.getElementById('selectUrlModeLink')?.addEventListener('click', () => selectUrlMode());
		document.getElementById('selectSqlite3FileButton')?.addEventListener('click', () => selectSqlite3File());
		document.querySelectorAll('button[data-submit]').forEach((button) => {
			button.addEventListener('click', () => submitForm(button.getAttribute('data-submit')));
		});

		hydrateInitialConnection();
	</script>
</body>
</html>`;
  }

  /**
   * 解析端口输入字符串。
   *
   * @param {string} value 原始端口值。
   * @returns {number | undefined} 有效时解析出的端口号。
   */
  private static parsePort(value: string): number | undefined {
    const parsedPort = Number(value);
    return Number.isInteger(parsedPort) && parsedPort > 0 ? parsedPort : undefined;
  }
}
