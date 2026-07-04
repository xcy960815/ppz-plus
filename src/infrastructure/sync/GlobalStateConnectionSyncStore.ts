import type * as vscode from "vscode";

import type { ConnectionSyncPayload } from "../../application/connections/ConnectionSyncPayload";
import { CONNECTION_SYNC_PAYLOAD_VERSION } from "../../application/connections/ConnectionSyncPayload";
import type { ConnectionSyncStore } from "../../application/connections/ConnectionSyncStore";

/**
 * 使用 VS Code Settings Sync 可同步的 globalState 保存连接同步载荷。
 */
export class GlobalStateConnectionSyncStore implements ConnectionSyncStore {
  /**
   * 定义保存账号同步连接载荷的全局状态键。
   */
  public static readonly storageKey = "ppz-plus.syncedConnections";

  /**
   * 创建账号同步存储适配器。
   *
   * @param globalState VS Code 全局状态存储。
   */
  public constructor(private readonly globalState: vscode.ExtensionContext["globalState"]) {
    this.globalState.setKeysForSync([GlobalStateConnectionSyncStore.storageKey]);
  }

  /**
   * 从 VS Code 账号同步状态读取连接同步载荷。
   *
   * @returns {Promise<ConnectionSyncPayload | undefined>} 已保存载荷；缺失时为空。
   */
  public async read(): Promise<ConnectionSyncPayload | undefined> {
    const value = this.globalState.get<unknown>(GlobalStateConnectionSyncStore.storageKey);
    if (value === undefined) {
      return undefined;
    }

    return this.parsePayload(value);
  }

  /**
   * 将连接同步载荷写入 VS Code 账号同步状态。
   *
   * @param {ConnectionSyncPayload} payload 需要同步的载荷。
   */
  public async write(payload: ConnectionSyncPayload): Promise<void> {
    await this.globalState.update(GlobalStateConnectionSyncStore.storageKey, payload);
  }

  /**
   * 清空 VS Code 账号同步状态中的连接载荷。
   */
  public async clear(): Promise<void> {
    await this.globalState.update(GlobalStateConnectionSyncStore.storageKey, undefined);
  }

  /**
   * 将未知 globalState 值解析为连接同步载荷。
   *
   * @param {unknown} value globalState 中的原始值。
   * @returns {ConnectionSyncPayload} 连接同步载荷。
   */
  private parsePayload(value: unknown): ConnectionSyncPayload {
    if (!this.isRecord(value)) {
      throw new Error("账号同步中的连接配置格式无效。");
    }

    if (value.version !== CONNECTION_SYNC_PAYLOAD_VERSION) {
      throw new Error(`暂不支持版本 ${String(value.version)} 的连接同步载荷。`);
    }

    if (typeof value.exportedAt !== "string") {
      throw new Error("账号同步中的连接配置缺少 exportedAt。");
    }

    if (!Array.isArray(value.connections)) {
      throw new Error("账号同步中的连接配置缺少 connections。");
    }

    return {
      version: CONNECTION_SYNC_PAYLOAD_VERSION,
      exportedAt: value.exportedAt,
      connections: value.connections as ConnectionSyncPayload["connections"],
    };
  }

  /**
   * 判断未知值是否为普通对象。
   *
   * @param {unknown} value 待判断的值。
   * @returns {boolean} 普通对象返回 true。
   */
  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }
}
