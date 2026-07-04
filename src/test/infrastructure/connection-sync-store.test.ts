import * as assert from "assert";

import { CONNECTION_SYNC_PAYLOAD_VERSION } from "../../application/connections/ConnectionSyncPayload";
import { GlobalStateConnectionSyncStore } from "../../infrastructure/sync/GlobalStateConnectionSyncStore";

/**
 * 提供最小可用的可同步 Memento 实现。
 */
class FakeSyncedMemento {
  /**
   * 保存内存中的键值对。
   */
  private readonly store = new Map<string, unknown>();

  /**
   * 记录注册给 VS Code Settings Sync 的键。
   */
  public readonly syncedKeys: string[] = [];

  /**
   * 读取指定键对应的值。
   *
   * @param {string} key 状态键。
   * @returns {T | undefined} 已保存值；缺失时为空。
   */
  public get<T>(key: string): T | undefined {
    return this.store.get(key) as T | undefined;
  }

  /**
   * 更新指定键对应的值。
   *
   * @param {string} key 状态键。
   * @param {unknown} value 待保存值。
   */
  public async update(key: string, value: unknown): Promise<void> {
    this.store.set(key, value);
  }

  /**
   * 返回全部已保存键。
   *
   * @returns {readonly string[]} 已保存键列表。
   */
  public keys(): readonly string[] {
    return [...this.store.keys()];
  }

  /**
   * 记录需要交给 VS Code Settings Sync 的键。
   *
   * @param {readonly string[]} keys 可同步键列表。
   */
  public setKeysForSync(keys: readonly string[]): void {
    this.syncedKeys.splice(0, this.syncedKeys.length, ...keys);
  }
}

suite("Infrastructure — VS Code 账号连接同步存储", () => {
  test("构造时注册 Settings Sync 键", () => {
    const memento = new FakeSyncedMemento();

    new GlobalStateConnectionSyncStore(memento as never);

    assert.deepStrictEqual(memento.syncedKeys, [GlobalStateConnectionSyncStore.storageKey]);
  });

  test("写入并读取账号同步载荷", async () => {
    const memento = new FakeSyncedMemento();
    const store = new GlobalStateConnectionSyncStore(memento as never);

    await store.write({
      version: CONNECTION_SYNC_PAYLOAD_VERSION,
      exportedAt: "2026-07-04T00:00:00.000Z",
      connections: [
        {
          config: {
            id: "mysql-1",
            name: "MySQL",
            engine: "mysql",
            mode: "parameters",
            host: "127.0.0.1",
            port: 3306,
            username: "root",
            hasPassword: true,
          },
        },
      ],
    });

    const payload = await store.read();

    assert.strictEqual(payload?.connections.length, 1);
    assert.strictEqual(payload?.connections[0]?.config.id, "mysql-1");
  });

  test("清空后账号同步载荷不再可读", async () => {
    const memento = new FakeSyncedMemento();
    const store = new GlobalStateConnectionSyncStore(memento as never);

    await store.write({
      version: CONNECTION_SYNC_PAYLOAD_VERSION,
      exportedAt: "2026-07-04T00:00:00.000Z",
      connections: [],
    });
    await store.clear();

    assert.strictEqual(await store.read(), undefined);
  });
});
