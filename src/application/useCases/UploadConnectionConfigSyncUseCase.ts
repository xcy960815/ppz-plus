import type { ConnectionRepository } from "../connections/ConnectionRepository";
import type { ConnectionSecretCipher } from "../connections/ConnectionSecretCipher";
import type { ConnectionSyncStore } from "../connections/ConnectionSyncStore";
import {
  CONNECTION_SYNC_PAYLOAD_VERSION,
  type SyncedConnectionConfig,
  type UploadConnectionConfigSyncResult,
} from "../connections/ConnectionSyncPayload";
import {
  extractConnectionPassword,
  sanitizeConnectionForSync,
} from "./ConnectionConfigSyncSanitizer";

/**
 * 上传加密连接配置同步载荷。
 */
export class UploadConnectionConfigSyncUseCase {
  /**
   * 创建连接配置上传同步用例。
   *
   * @param connectionRepository 本机连接仓储。
   * @param connectionSyncStore 远端同步存储。
   * @param connectionSecretCipher 连接密码加密器。
   */
  public constructor(
    private readonly connectionRepository: ConnectionRepository,
    private readonly connectionSyncStore: ConnectionSyncStore,
    private readonly connectionSecretCipher: ConnectionSecretCipher,
  ) {}

  /**
   * 将当前本机连接配置去敏并加密密码后写入 VS Code 账号同步。
   *
   * @param {string} syncKey 用户输入的同步密钥。
   * @returns {Promise<UploadConnectionConfigSyncResult>} 上传结果。
   */
  public async execute(syncKey: string): Promise<UploadConnectionConfigSyncResult> {
    const connections = await this.connectionRepository.list();
    const syncedConnections: SyncedConnectionConfig[] = [];

    for (const connection of connections) {
      const password = extractConnectionPassword(connection);
      const encryptedPassword = password
        ? await this.connectionSecretCipher.encrypt(password, syncKey)
        : undefined;
      syncedConnections.push({
        config: sanitizeConnectionForSync(connection),
        encryptedPassword,
      });
    }

    const exportedAt = new Date().toISOString();

    await this.connectionSyncStore.write({
      version: CONNECTION_SYNC_PAYLOAD_VERSION,
      exportedAt,
      connections: syncedConnections,
    });

    return {
      uploadedCount: syncedConnections.length,
      exportedAt,
      encryptedPasswordCount: syncedConnections.filter((connection) => connection.encryptedPassword)
        .length,
    };
  }
}
