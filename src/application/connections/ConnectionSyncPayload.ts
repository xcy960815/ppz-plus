import type { ConnectionConfig } from "../../domain/connections/ConnectionConfig";

/**
 * 定义连接同步载荷的当前版本。
 */
export const CONNECTION_SYNC_PAYLOAD_VERSION = 2;

/**
 * 描述已加密的连接密码密文。
 */
export interface EncryptedConnectionSecret {
  /**
   * 记录对称加密算法。
   */
  readonly algorithm: "aes-256-gcm";

  /**
   * 记录密钥派生算法。
   */
  readonly kdf: "scrypt";

  /**
   * 保存 base64 编码的随机盐。
   */
  readonly salt: string;

  /**
   * 保存 base64 编码的初始化向量。
   */
  readonly iv: string;

  /**
   * 保存 base64 编码的认证标签。
   */
  readonly authTag: string;

  /**
   * 保存 base64 编码的密文。
   */
  readonly ciphertext: string;
}

/**
 * 描述一条可同步的连接配置及其加密密码。
 */
export interface SyncedConnectionConfig {
  /**
   * 保存不含明文密码的连接配置。
   */
  readonly config: ConnectionConfig;

  /**
   * 保存连接密码的加密密文。
   */
  readonly encryptedPassword?: EncryptedConnectionSecret;
}

/**
 * 描述写入 VS Code 账号同步远端的连接载荷。
 */
export interface ConnectionSyncPayload {
  /**
   * 记录同步载荷版本，用于后续格式演进。
   */
  readonly version: typeof CONNECTION_SYNC_PAYLOAD_VERSION;

  /**
   * 记录生成同步载荷的 ISO 时间。
   */
  readonly exportedAt: string;

  /**
   * 保存已去敏且带可选加密密码的连接配置列表。
   */
  readonly connections: readonly SyncedConnectionConfig[];
}

/**
 * 描述上传连接同步载荷后的结果。
 */
export interface UploadConnectionConfigSyncResult {
  /**
   * 记录上传的连接数量。
   */
  readonly uploadedCount: number;

  /**
   * 记录同步载荷生成时间。
   */
  readonly exportedAt: string;

  /**
   * 记录上传时一并加密的密码数量。
   */
  readonly encryptedPasswordCount: number;
}

/**
 * 描述拉取连接同步载荷后的合并结果。
 */
export interface PullConnectionConfigSyncResult {
  /**
   * 记录远端载荷中的连接数量。
   */
  readonly remoteCount: number;

  /**
   * 记录本次新建的本机连接数量。
   */
  readonly createdCount: number;

  /**
   * 记录本次更新的本机连接数量。
   */
  readonly updatedCount: number;

  /**
   * 记录本次成功解密并写入本机安全存储的密码数量。
   */
  readonly decryptedPasswordCount: number;

  /**
   * 记录拉取后仍缺少本机密码的连接数量。
   */
  readonly missingLocalPasswordCount: number;
}
