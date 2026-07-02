import * as vscode from "vscode";

import type {
  ConnectionConfig,
  MysqlConnectionConfig,
  PostgreSqlConnectionConfig,
} from "../../domain/connections/ConnectionConfig";
import type { SaveConnectionConfigUseCase } from "../../application/useCases/SaveConnectionConfigUseCase";
import { maskConnectionUrl } from "./ConnectionDisplayFormatter";

/**
 * 负责在已保存连接缺少本机密码时提示用户补录。
 */
export class StoredConnectionPasswordPrompt {
  /**
   * 创建本机密码补录助手。
   *
   * @param saveConnectionConfigUseCase 用于保存补录后的连接配置。
   */
  public constructor(private readonly saveConnectionConfigUseCase: SaveConnectionConfigUseCase) {}

  /**
   * 判断连接是否缺少本机密码。
   *
   * @param {ConnectionConfig} connection 当前连接配置。
   * @returns {boolean} 是否缺少本机密码。
   */
  public hasMissingLocalPassword(connection: ConnectionConfig): boolean {
    if (connection.mode === "file") {
      return false;
    }

    if (!("hasPassword" in connection) || connection.hasPassword !== true) {
      return false;
    }

    if (connection.mode === "parameters") {
      return !connection.password;
    }

    try {
      return new URL(connection.url).password.length === 0;
    } catch {
      return true;
    }
  }

  /**
   * 确保连接具备可直接访问数据库的本机密码。
   *
   * @param {ConnectionConfig} connection 当前连接配置。
   * @returns {Promise<ConnectionConfig | undefined>} 可直接使用的连接；用户取消时为空。
   */
  public async ensureConnectionReady(
    connection: ConnectionConfig,
  ): Promise<ConnectionConfig | undefined> {
    if (!this.hasMissingLocalPassword(connection)) {
      return connection;
    }

    const password = await vscode.window.showInputBox({
      title: `PPZ Plus: 补录 ${connection.name} 的连接密码`,
      prompt:
        connection.mode === "parameters"
          ? `输入 ${connection.host}:${connection.port} 的本机连接密码`
          : `输入 ${maskConnectionUrl(connection.url)} 的本机连接密码`,
      password: true,
      ignoreFocusOut: true,
      validateInput: (value) => (value.length > 0 ? undefined : "请输入连接密码。"),
    });

    if (password === undefined) {
      return undefined;
    }

    const updatedConnection = this.attachPassword(connection, password);
    await this.saveConnectionConfigUseCase.execute(updatedConnection);
    return updatedConnection;
  }

  /**
   * 将用户补录的密码写回运行时连接配置。
   *
   * @param {ConnectionConfig} connection 当前连接配置。
   * @param {string} password 用户补录的密码。
   * @returns {ConnectionConfig} 已带上本机密码的连接配置。
   */
  private attachPassword(connection: ConnectionConfig, password: string): ConnectionConfig {
    if (connection.mode === "file") {
      return connection;
    }

    if (connection.mode === "parameters") {
      return {
        ...connection,
        password,
        hasPassword: true,
      };
    }

    return {
      ...connection,
      url: this.attachPasswordToUrl(connection, password),
      hasPassword: true,
    };
  }

  /**
   * 把补录密码重新拼回 URL 连接配置。
   *
   * @param {MysqlConnectionConfig | PostgreSqlConnectionConfig} connection URL 模式连接配置。
   * @param {string} password 用户补录的密码。
   * @returns {string} 含本机密码的运行时连接 URL。
   */
  private attachPasswordToUrl(
    connection: MysqlConnectionConfig | PostgreSqlConnectionConfig,
    password: string,
  ): string {
    if (connection.mode !== "url") {
      return "";
    }

    const parsedUrl = new URL(connection.url);
    parsedUrl.password = password;
    return parsedUrl.toString();
  }
}
