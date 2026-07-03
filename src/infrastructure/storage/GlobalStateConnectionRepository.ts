import type * as vscode from "vscode";

import type { ConnectionRepository } from "../../application/connections/ConnectionRepository";
import type { ConnectionConfig } from "../../domain/connections/ConnectionConfig";

/**
 * 将非敏感连接配置保存到 VS Code 全局状态，并把密码保存到本机安全存储中。
 */
export class GlobalStateConnectionRepository implements ConnectionRepository {
  /**
   * 记录当前仓储是否已经完成历史连接配置去敏迁移。
   */
  private migrationPromise?: Promise<void>;

  /**
   * 定义保存连接记录使用的全局状态键。
   */
  public static readonly storageKey = "ppz-plus.connections";

  /**
   * 定义密码保存到本机安全存储时使用的键前缀。
   */
  private static readonly passwordSecretKeyPrefix = "ppz-plus.connection-password.";

  /**
   * 创建基于全局状态和本机安全存储的连接仓储。
   *
   * @param globalState VS Code 全局状态存储。
   * @param secretStorage VS Code 本机安全存储。
   */
  public constructor(
    private readonly globalState: vscode.Memento,
    private readonly secretStorage: vscode.SecretStorage,
  ) {}

  /**
   * 列出所有已保存的连接配置。
   *
   * @returns {Promise<readonly ConnectionConfig[]>} 已保存的连接配置。
   */
  public async list(): Promise<readonly ConnectionConfig[]> {
    await this.ensureStorageMigrated();
    const storedConnections = this.readConnections();
    return Promise.all(
      storedConnections.map(async (connection) => this.hydrateConnection(connection)),
    );
  }

  /**
   * 根据标识查找已保存连接。
   *
   * @param {string} id 连接标识。
   * @returns {Promise<ConnectionConfig | undefined>} 存在时返回匹配的已保存连接。
   */
  public async find(id: string): Promise<ConnectionConfig | undefined> {
    await this.ensureStorageMigrated();
    const connections = this.readConnections();
    const matchedConnection = connections.find((connection) => connection.id === id);
    return matchedConnection ? this.hydrateConnection(matchedConnection) : undefined;
  }

  /**
   * 保存连接配置，并替换具有相同标识的已有连接。
   *
   * @param {ConnectionConfig} config 需要持久化的连接配置。
   */
  public async save(config: ConnectionConfig): Promise<void> {
    await this.ensureStorageMigrated();
    const connections = this.readConnections();
    const existingIndex = connections.findIndex((connection) => connection.id === config.id);
    const sanitizedConfig = this.stripSensitiveFields(config);

    /**
     * 构建 upsert 操作后的下一份连接列表。
     */
    const nextConnections =
      existingIndex === -1
        ? [...connections, sanitizedConfig]
        : connections.map((connection, index) =>
            index === existingIndex ? sanitizedConfig : connection,
          );

    await this.saveConnectionPassword(config);
    await this.globalState.update(GlobalStateConnectionRepository.storageKey, nextConnections);
  }

  /**
   * 删除已保存连接配置。
   *
   * @param {string} id 需要删除的连接标识。
   */
  public async delete(id: string): Promise<void> {
    await this.ensureStorageMigrated();
    const connections = this.readConnections().filter((connection) => connection.id !== id);
    await this.deleteConnectionPassword(id);
    await this.globalState.update(GlobalStateConnectionRepository.storageKey, connections);
  }

  /**
   * 清空所有已保存连接配置。
   */
  public async clear(): Promise<void> {
    await this.ensureStorageMigrated();
    const connections = this.readConnections();
    await Promise.all(
      connections.map(async (connection) => this.deleteConnectionPassword(connection.id)),
    );
    await this.globalState.update(GlobalStateConnectionRepository.storageKey, []);
  }

  /**
   * 从 VS Code 全局状态读取已保存连接列表。
   *
   * @returns {ConnectionConfig[]} 已保存连接列表。
   */
  private readConnections(): ConnectionConfig[] {
    return this.globalState.get<ConnectionConfig[]>(GlobalStateConnectionRepository.storageKey, []);
  }

  /**
   * 将本机安全存储中的密码重新合并回连接配置。
   *
   * @param {ConnectionConfig} connection 已保存的非敏感连接配置。
   * @returns {Promise<ConnectionConfig>} 可直接用于运行时访问数据库的连接配置。
   */
  private async hydrateConnection(connection: ConnectionConfig): Promise<ConnectionConfig> {
    if (connection.mode === "file" || !this.hasStoredPasswordMarker(connection)) {
      return connection;
    }

    const password = await this.secretStorage.get(this.createPasswordSecretKey(connection.id));

    if (!password) {
      return connection;
    }

    if (connection.mode === "parameters") {
      return {
        ...connection,
        password,
      };
    }

    return {
      ...connection,
      url: this.attachPasswordToUrl(connection.url, password),
    };
  }

  /**
   * 去除可同步配置中的敏感字段，仅保留非敏感连接信息。
   *
   * @param {ConnectionConfig} connection 待持久化的连接配置。
   * @returns {ConnectionConfig} 去敏后的连接配置。
   */
  private stripSensitiveFields(connection: ConnectionConfig): ConnectionConfig {
    if (connection.mode === "file") {
      return connection;
    }

    if (connection.mode === "parameters") {
      const { password, ...restConnection } = connection;
      return {
        ...restConnection,
        hasPassword: Boolean(password),
      };
    }

    const parsedUrl = new URL(connection.url);
    const password = parsedUrl.password;
    parsedUrl.password = "";

    return {
      ...connection,
      url: parsedUrl.toString(),
      hasPassword: password.length > 0,
    };
  }

  /**
   * 把连接密码保存到本机安全存储中。
   *
   * @param {ConnectionConfig} connection 含有原始密码信息的连接配置。
   */
  private async saveConnectionPassword(connection: ConnectionConfig): Promise<void> {
    if (connection.mode === "file") {
      return;
    }

    const password = this.extractPassword(connection);
    const secretKey = this.createPasswordSecretKey(connection.id);

    if (!password) {
      await this.secretStorage.delete(secretKey);
      return;
    }

    await this.secretStorage.store(secretKey, password);
  }

  /**
   * 删除指定连接对应的本机密码记录。
   *
   * @param {string} connectionId 需要删除密码的连接标识。
   */
  private async deleteConnectionPassword(connectionId: string): Promise<void> {
    await this.secretStorage.delete(this.createPasswordSecretKey(connectionId));
  }

  /**
   * 从连接配置中提取待写入本机安全存储的密码。
   *
   * @param {ConnectionConfig} connection 连接配置。
   * @returns {string | undefined} 待保存的密码；不存在时为空。
   */
  private extractPassword(connection: ConnectionConfig): string | undefined {
    if (connection.mode === "file") {
      return undefined;
    }

    if (connection.mode === "parameters") {
      return connection.password;
    }

    return this.extractPasswordFromUrl(connection);
  }

  /**
   * 从 URL 连接配置中解析密码。
   *
   * @param {ConnectionConfig} connection URL 模式的连接配置。
   * @returns {string | undefined} 解析出的密码。
   */
  private extractPasswordFromUrl(connection: ConnectionConfig): string | undefined {
    if (connection.mode !== "url") {
      return undefined;
    }

    const parsedUrl = new URL(connection.url);
    return parsedUrl.password || undefined;
  }

  /**
   * 把本机安全存储中的密码重新拼回连接 URL。
   *
   * @param {string} connectionUrl 已去敏的连接 URL。
   * @param {string} password 本机安全存储中的密码。
   * @returns {string} 可直接用于运行时连接数据库的 URL。
   */
  private attachPasswordToUrl(connectionUrl: string, password: string): string {
    const parsedUrl = new URL(connectionUrl);
    parsedUrl.password = password;
    return parsedUrl.toString();
  }

  /**
   * 为指定连接创建本机安全存储使用的键。
   *
   * @param {string} connectionId 连接标识。
   * @returns {string} 该连接对应的密码存储键。
   */
  private createPasswordSecretKey(connectionId: string): string {
    return `${GlobalStateConnectionRepository.passwordSecretKeyPrefix}${connectionId}`;
  }

  /**
   * 判断连接配置是否标记了需要从本机安全存储恢复密码。
   *
   * @param {ConnectionConfig} connection 当前连接配置。
   * @returns {boolean} 是否存在本机密码标记。
   */
  private hasStoredPasswordMarker(connection: ConnectionConfig): boolean {
    return "hasPassword" in connection && connection.hasPassword === true;
  }

  /**
   * 确保历史连接配置已经迁移为“非敏感字段 + 本机密码”存储结构。
   */
  private async ensureStorageMigrated(): Promise<void> {
    this.migrationPromise ??= this.migrateStoredConnections();
    await this.migrationPromise;
  }

  /**
   * 把历史可能仍包含明文密码的连接配置迁移为去敏版本。
   */
  private async migrateStoredConnections(): Promise<void> {
    const connections = this.readConnections();
    let hasMigrationChanges = false;

    const migratedConnections = await Promise.all(
      connections.map(async (connection) => {
        if (connection.mode === "file") {
          return connection;
        }

        if (connection.mode === "parameters") {
          if (!connection.password && this.hasStoredPasswordMarker(connection)) {
            return connection;
          }

          hasMigrationChanges = hasMigrationChanges || Boolean(connection.password);
          await this.saveConnectionPassword(connection);
          return this.stripSensitiveFields(connection);
        }

        const parsedUrl = new URL(connection.url);
        const containsUrlPassword = parsedUrl.password.length > 0;
        if (!containsUrlPassword && this.hasStoredPasswordMarker(connection)) {
          return connection;
        }

        hasMigrationChanges = hasMigrationChanges || containsUrlPassword;
        await this.saveConnectionPassword(connection);
        return this.stripSensitiveFields(connection);
      }),
    );

    if (!hasMigrationChanges) {
      return;
    }

    await this.globalState.update(GlobalStateConnectionRepository.storageKey, migratedConnections);
  }
}
