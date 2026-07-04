import type { ConnectionConfig } from "../../domain/connections/ConnectionConfig";
import type { ConnectionRepository } from "../connections/ConnectionRepository";
import type { ConnectionSecretCipher } from "../connections/ConnectionSecretCipher";
import type { ConnectionSyncStore } from "../connections/ConnectionSyncStore";
import {
  CONNECTION_SYNC_PAYLOAD_VERSION,
  type ConnectionSyncPayload,
  type SyncedConnectionConfig,
  type PullConnectionConfigSyncResult,
} from "../connections/ConnectionSyncPayload";
import {
  attachConnectionPassword,
  containsSensitiveConnectionSecret,
  hasMissingLocalPassword,
  preserveLocalPassword,
  sanitizeConnectionForSync,
} from "./ConnectionConfigSyncSanitizer";
import { assertSyncedConnection } from "./SyncedConnectionValidator";

/**
 * 拉取 VS Code 账号同步中的加密连接配置并合并到本机。
 */
export class PullConnectionConfigSyncUseCase {
  /**
   * 创建连接配置拉取同步用例。
   *
   * @param connectionRepository 本机连接仓储。
   * @param connectionSyncStore 远端同步存储。
   * @param connectionSecretCipher 连接密码解密器。
   */
  public constructor(
    private readonly connectionRepository: ConnectionRepository,
    private readonly connectionSyncStore: ConnectionSyncStore,
    private readonly connectionSecretCipher: ConnectionSecretCipher,
  ) {}

  /**
   * 从 VS Code 账号同步读取同步载荷，并按连接 id 合并到本机。
   *
   * @param {string} syncKey 用户输入的同步密钥。
   * @returns {Promise<PullConnectionConfigSyncResult>} 拉取合并结果。
   */
  public async execute(syncKey: string): Promise<PullConnectionConfigSyncResult> {
    const payload = await this.connectionSyncStore.read();
    if (!payload) {
      throw new Error("VS Code 账号同步中还没有连接配置。");
    }

    this.assertSupportedPayload(payload);

    const localConnections = await this.connectionRepository.list();
    const localConnectionById = new Map(
      localConnections.map((connection) => [connection.id, connection]),
    );

    // 第一阶段：全量校验并解密到内存，任一失败立即整体中止，避免半导入。
    const mergedConnections: ConnectionConfig[] = [];
    let createdCount = 0;
    let updatedCount = 0;
    let missingLocalPasswordCount = 0;
    let decryptedPasswordCount = 0;

    for (const value of payload.connections) {
      const syncedConnection = assertSyncedConnection(value);

      if (containsSensitiveConnectionSecret(syncedConnection.config)) {
        throw new Error("同步载荷包含明文密码，已拒绝拉取。");
      }

      const remoteConnection = await this.decryptSyncedConnection(syncedConnection, syncKey);
      if (syncedConnection.encryptedPassword) {
        decryptedPasswordCount += 1;
      }

      const localConnection = localConnectionById.get(remoteConnection.id);
      const mergedConnection = syncedConnection.encryptedPassword
        ? remoteConnection
        : preserveLocalPassword(remoteConnection, localConnection);

      if (hasMissingLocalPassword(mergedConnection)) {
        missingLocalPasswordCount += 1;
      }

      mergedConnections.push(mergedConnection);

      if (localConnection) {
        updatedCount += 1;
      } else {
        createdCount += 1;
      }
    }

    // 第二阶段：全部校验解密通过后再统一落库。
    for (const mergedConnection of mergedConnections) {
      await this.connectionRepository.saveSynced(mergedConnection);
    }

    return {
      remoteCount: payload.connections.length,
      createdCount,
      updatedCount,
      decryptedPasswordCount,
      missingLocalPasswordCount,
    };
  }

  /**
   * 确认同步载荷版本可被当前实现处理。
   *
   * @param {ConnectionSyncPayload} payload 远端同步载荷。
   */
  private assertSupportedPayload(payload: ConnectionSyncPayload): void {
    if (payload.version !== CONNECTION_SYNC_PAYLOAD_VERSION) {
      throw new Error(`暂不支持版本 ${payload.version} 的连接同步载荷。`);
    }
  }

  /**
   * 解密单条同步连接中的密码。
   *
   * @param {SyncedConnectionConfig} syncedConnection 远端同步连接。
   * @param {string} syncKey 用户输入的同步密钥。
   * @returns {Promise<ConnectionSyncPayload["connections"][number]["config"]>} 已合并密码的连接。
   */
  private async decryptSyncedConnection(
    syncedConnection: SyncedConnectionConfig,
    syncKey: string,
  ): Promise<SyncedConnectionConfig["config"]> {
    const sanitizedConnection = sanitizeConnectionForSync(syncedConnection.config);
    if (!syncedConnection.encryptedPassword) {
      return sanitizedConnection;
    }

    try {
      const password = await this.connectionSecretCipher.decrypt(
        syncedConnection.encryptedPassword,
        syncKey,
      );
      return attachConnectionPassword(sanitizedConnection, password);
    } catch (error) {
      throw new Error("同步密钥不正确，或远端连接密码密文已损坏。", {
        cause: error,
      });
    }
  }
}
