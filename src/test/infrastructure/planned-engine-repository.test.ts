import * as assert from "assert";

import type {
  CockroachDbConnectionConfig,
  MssqlConnectionConfig,
} from "../../domain/connections/ConnectionConfig";
import { GlobalStateConnectionRepository } from "../../infrastructure/storage/GlobalStateConnectionRepository";

/**
 * 提供最小可用的 Memento 实现，用于隔离全局状态。
 */
class FakeMemento {
  /**
   * 保存内存中的键值对。
   */
  private readonly store = new Map<string, unknown>();

  /**
   * 读取指定键对应的值，缺失时返回默认值。
   *
   * @param {string} key 状态键。
   * @param {T} defaultValue 缺省返回值。
   * @returns {T} 已保存值或默认值。
   */
  public get<T>(key: string, defaultValue: T): T {
    return this.store.has(key) ? (this.store.get(key) as T) : defaultValue;
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
   * 返回全部已保存键，满足 Memento 契约。
   *
   * @returns {readonly string[]} 已保存键列表。
   */
  public keys(): readonly string[] {
    return [...this.store.keys()];
  }
}

/**
 * 提供最小可用的 SecretStorage 实现，用于隔离本机密码存储。
 */
class FakeSecretStorage {
  /**
   * 保存内存中的密码。
   */
  private readonly secrets = new Map<string, string>();

  /**
   * 读取指定键对应的密码。
   *
   * @param {string} key 密码键。
   * @returns {Promise<string | undefined>} 已保存密码；缺失时为空。
   */
  public async get(key: string): Promise<string | undefined> {
    return this.secrets.get(key);
  }

  /**
   * 保存指定键对应的密码。
   *
   * @param {string} key 密码键。
   * @param {string} value 待保存密码。
   */
  public async store(key: string, value: string): Promise<void> {
    this.secrets.set(key, value);
  }

  /**
   * 删除指定键对应的密码。
   *
   * @param {string} key 密码键。
   */
  public async delete(key: string): Promise<void> {
    this.secrets.delete(key);
  }
}

/**
 * 构建注入 fake 依赖的连接仓储及其底层存储。
 */
function makeRepository(): {
  readonly repository: GlobalStateConnectionRepository;
  readonly memento: FakeMemento;
  readonly secrets: FakeSecretStorage;
} {
  const memento = new FakeMemento();
  const secrets = new FakeSecretStorage();
  const repository = new GlobalStateConnectionRepository(memento as never, secrets as never);
  return { repository, memento, secrets };
}

suite("Infrastructure — 计划中引擎密码去敏", () => {
  test("MSSQL 参数连接保存后剥离明文密码并落入本机存储", async () => {
    const { repository, memento, secrets } = makeRepository();
    const config: MssqlConnectionConfig = {
      id: "mssql-secure",
      name: "MSSQL 安全连接",
      engine: "mssql",
      mode: "parameters",
      host: "127.0.0.1",
      port: 1433,
      username: "sa",
      password: "s3cret",
      encrypt: true,
      trustServerCertificate: false,
    };

    await repository.save(config);

    const stored = memento.get<readonly MssqlConnectionConfig[]>(
      GlobalStateConnectionRepository.storageKey,
      [],
    );
    assert.strictEqual(stored.length, 1);
    assert.strictEqual(
      stored[0]?.mode === "parameters" ? stored[0].password : "still-there",
      undefined,
    );
    assert.strictEqual(stored[0]?.hasPassword, true);
    // 引擎专有字段不应被去敏流程破坏。
    assert.strictEqual(stored[0]?.mode === "parameters" ? stored[0].encrypt : undefined, true);
    assert.strictEqual(
      stored[0]?.mode === "parameters" ? stored[0].trustServerCertificate : undefined,
      false,
    );
    assert.strictEqual(await secrets.get("ppz-plus.connection-password.mssql-secure"), "s3cret");
  });

  test("MSSQL 参数连接读取时从本机存储回填密码", async () => {
    const { repository } = makeRepository();
    await repository.save({
      id: "mssql-rehydrate",
      name: "MSSQL 回填连接",
      engine: "mssql",
      mode: "parameters",
      host: "127.0.0.1",
      port: 1433,
      username: "sa",
      password: "s3cret",
      encrypt: true,
      trustServerCertificate: false,
    });

    const hydrated = await repository.find("mssql-rehydrate");
    assert.ok(hydrated);
    assert.strictEqual(hydrated.mode === "parameters" ? hydrated.password : undefined, "s3cret");
  });

  test("CockroachDB URL 连接保存后从 URL 中剥离并回填密码", async () => {
    const { repository, memento } = makeRepository();
    const config: CockroachDbConnectionConfig = {
      id: "crdb-url",
      name: "CockroachDB URL 连接",
      engine: "cockroachdb",
      mode: "url",
      url: "postgresql://root:topsecret@127.0.0.1:26257/defaultdb",
    };

    await repository.save(config);

    const stored = memento.get<readonly CockroachDbConnectionConfig[]>(
      GlobalStateConnectionRepository.storageKey,
      [],
    );
    const storedUrl = stored[0]?.mode === "url" ? stored[0].url : "";
    assert.ok(!storedUrl.includes("topsecret"), "已保存 URL 不得包含明文密码");
    assert.strictEqual(stored[0]?.hasPassword, true);

    const hydrated = await repository.find("crdb-url");
    const hydratedUrl = hydrated?.mode === "url" ? hydrated.url : "";
    assert.ok(hydratedUrl.includes("topsecret"), "读取时应回填密码到 URL");
  });
});
