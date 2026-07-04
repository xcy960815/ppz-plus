import type { ConnectionSyncPayload } from "./ConnectionSyncPayload";

/**
 * 读写 VS Code 账号同步中的连接载荷。
 */
export interface ConnectionSyncStore {
  /**
   * 从账号同步存储读取连接同步载荷。
   *
   * @returns {Promise<ConnectionSyncPayload | undefined>} 已解析的同步载荷；缺失时为空。
   */
  read(): Promise<ConnectionSyncPayload | undefined>;

  /**
   * 将连接同步载荷写入账号同步存储。
   *
   * @param {ConnectionSyncPayload} payload 需要写入的同步载荷。
   */
  write(payload: ConnectionSyncPayload): Promise<void>;

  /**
   * 清空账号同步存储中的连接载荷。
   */
  clear(): Promise<void>;
}
