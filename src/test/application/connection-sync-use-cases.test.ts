import * as assert from "assert";

import type { ConnectionRepository } from "../../application/connections/ConnectionRepository";
import type { ConnectionSecretCipher } from "../../application/connections/ConnectionSecretCipher";
import type { ConnectionSyncPayload } from "../../application/connections/ConnectionSyncPayload";
import { CONNECTION_SYNC_PAYLOAD_VERSION } from "../../application/connections/ConnectionSyncPayload";
import type { ConnectionSyncStore } from "../../application/connections/ConnectionSyncStore";
import { PullConnectionConfigSyncUseCase } from "../../application/useCases/PullConnectionConfigSyncUseCase";
import { UploadConnectionConfigSyncUseCase } from "../../application/useCases/UploadConnectionConfigSyncUseCase";
import type { ConnectionConfig } from "../../domain/connections/ConnectionConfig";

/**
 * 构建 MySQL 参数连接。
 *
 * @param {Partial<ConnectionConfig>} overrides 覆盖字段。
 * @returns {ConnectionConfig} 测试连接配置。
 */
function makeMysqlParameterConnection(overrides: Partial<ConnectionConfig> = {}): ConnectionConfig {
  return {
    id: "mysql-1",
    name: "MySQL",
    engine: "mysql",
    mode: "parameters",
    host: "127.0.0.1",
    port: 3306,
    username: "root",
    password: "secret",
    database: "app",
    ...overrides,
  } as ConnectionConfig;
}

/**
 * 构建 PostgreSQL URL 连接。
 *
 * @param {Partial<ConnectionConfig>} overrides 覆盖字段。
 * @returns {ConnectionConfig} 测试连接配置。
 */
function makePostgreSqlUrlConnection(overrides: Partial<ConnectionConfig> = {}): ConnectionConfig {
  return {
    id: "pg-1",
    name: "PostgreSQL",
    engine: "postgresql",
    mode: "url",
    url: "postgresql://postgres:secret@127.0.0.1:5432/postgres",
    ...overrides,
  } as ConnectionConfig;
}

/**
 * 构建内存连接仓储。
 *
 * @param {ConnectionConfig[]} initialConnections 初始连接列表。
 * @returns 内存仓储和观测状态。
 */
function makeConnectionRepository(initialConnections: ConnectionConfig[] = []): {
  readonly repository: ConnectionRepository;
  readonly savedSyncedConnections: ConnectionConfig[];
  readonly connections: ConnectionConfig[];
} {
  const connections = [...initialConnections];
  const savedSyncedConnections: ConnectionConfig[] = [];

  const repository: ConnectionRepository = {
    async list() {
      return [...connections];
    },
    async find(id) {
      return connections.find((connection) => connection.id === id);
    },
    async save(config) {
      upsertConnection(connections, config);
    },
    async saveSynced(config) {
      savedSyncedConnections.push(config);
      upsertConnection(connections, config);
    },
    async delete(id) {
      const index = connections.findIndex((connection) => connection.id === id);
      if (index !== -1) {
        connections.splice(index, 1);
      }
    },
    async clear() {
      connections.splice(0, connections.length);
    },
  };

  return {
    repository,
    savedSyncedConnections,
    connections,
  };
}

/**
 * 构建内存同步存储。
 *
 * @param {ConnectionSyncPayload} payload 初始同步载荷。
 * @returns 内存同步存储和观测状态。
 */
function makeConnectionSyncStore(payload?: ConnectionSyncPayload): {
  readonly store: ConnectionSyncStore;
  payload?: ConnectionSyncPayload;
} {
  const state: { payload?: ConnectionSyncPayload } = { payload };
  const store: ConnectionSyncStore = {
    async read() {
      return state.payload;
    },
    async write(nextPayload) {
      state.payload = nextPayload;
    },
    async clear() {
      state.payload = undefined;
    },
  };

  return {
    store,
    get payload() {
      return state.payload;
    },
  };
}

/**
 * 构建可预测的连接密码加密器。
 *
 * @returns {ConnectionSecretCipher} 测试加密器。
 */
function makeConnectionSecretCipher(): ConnectionSecretCipher {
  return {
    async encrypt(plaintext, syncKey) {
      return {
        algorithm: "aes-256-gcm",
        kdf: "scrypt",
        salt: "fake-salt",
        iv: "fake-iv",
        authTag: "fake-auth-tag",
        ciphertext: Buffer.from(`${syncKey}:${plaintext}`, "utf8").toString("base64"),
      };
    },
    async decrypt(encryptedSecret, syncKey) {
      const decoded = Buffer.from(encryptedSecret.ciphertext, "base64").toString("utf8");
      const prefix = `${syncKey}:`;
      if (!decoded.startsWith(prefix)) {
        throw new Error("同步密钥错误。");
      }

      return decoded.slice(prefix.length);
    },
  };
}

/**
 * 更新内存连接列表。
 *
 * @param {ConnectionConfig[]} connections 连接列表。
 * @param {ConnectionConfig} config 新连接配置。
 */
function upsertConnection(connections: ConnectionConfig[], config: ConnectionConfig): void {
  const index = connections.findIndex((connection) => connection.id === config.id);
  if (index === -1) {
    connections.push(config);
    return;
  }

  connections[index] = config;
}

suite("Application — 连接配置远端同步", () => {
  test("上传时剥离参数密码和 URL 密码", async () => {
    const { repository } = makeConnectionRepository([
      makeMysqlParameterConnection(),
      makePostgreSqlUrlConnection(),
    ]);
    const syncStore = makeConnectionSyncStore();
    const useCase = new UploadConnectionConfigSyncUseCase(
      repository,
      syncStore.store,
      makeConnectionSecretCipher(),
    );

    const result = await useCase.execute("sync-key");

    assert.strictEqual(result.uploadedCount, 2);
    assert.strictEqual(result.encryptedPasswordCount, 2);
    assert.strictEqual(syncStore.payload?.version, CONNECTION_SYNC_PAYLOAD_VERSION);
    const [syncedMysqlConnection, syncedPostgreSqlConnection] =
      syncStore.payload?.connections ?? [];
    const mysqlConnection = syncedMysqlConnection?.config;
    const postgreSqlConnection = syncedPostgreSqlConnection?.config;
    assert.strictEqual(
      mysqlConnection?.mode === "parameters" ? mysqlConnection.password : "unexpected",
      undefined,
    );
    assert.ok(syncedMysqlConnection?.encryptedPassword);
    assert.notStrictEqual(syncedMysqlConnection.encryptedPassword.ciphertext, "secret");
    assert.strictEqual(readHasPassword(mysqlConnection), true);
    const syncedUrl = postgreSqlConnection?.mode === "url" ? postgreSqlConnection.url : "";
    assert.strictEqual(new URL(syncedUrl).password, "");
    assert.ok(syncedPostgreSqlConnection?.encryptedPassword);
    assert.strictEqual(readHasPassword(postgreSqlConnection), true);
  });

  test("拉取时保留同 id 本机参数密码", async () => {
    const localConnection = makeMysqlParameterConnection({ password: "local-secret" });
    const remoteConnection = makeMysqlParameterConnection({
      name: "远端 MySQL",
      password: undefined,
      hasPassword: true,
    });
    const { repository, savedSyncedConnections } = makeConnectionRepository([localConnection]);
    const syncStore = makeConnectionSyncStore({
      version: CONNECTION_SYNC_PAYLOAD_VERSION,
      exportedAt: "2026-07-04T00:00:00.000Z",
      connections: [{ config: remoteConnection }],
    });
    const useCase = new PullConnectionConfigSyncUseCase(
      repository,
      syncStore.store,
      makeConnectionSecretCipher(),
    );

    const result = await useCase.execute("sync-key");

    assert.strictEqual(result.updatedCount, 1);
    assert.strictEqual(result.decryptedPasswordCount, 0);
    assert.strictEqual(result.missingLocalPasswordCount, 0);
    const savedConnection = savedSyncedConnections[0];
    assert.strictEqual(savedConnection?.name, "远端 MySQL");
    assert.strictEqual(
      savedConnection?.mode === "parameters" ? savedConnection.password : undefined,
      "local-secret",
    );
  });

  test("拉取新连接时保留缺失密码标记", async () => {
    const remoteConnection = makePostgreSqlUrlConnection({
      url: "postgresql://postgres@127.0.0.1:5432/postgres",
      hasPassword: true,
    });
    const { repository, savedSyncedConnections } = makeConnectionRepository();
    const syncStore = makeConnectionSyncStore({
      version: CONNECTION_SYNC_PAYLOAD_VERSION,
      exportedAt: "2026-07-04T00:00:00.000Z",
      connections: [{ config: remoteConnection }],
    });
    const useCase = new PullConnectionConfigSyncUseCase(
      repository,
      syncStore.store,
      makeConnectionSecretCipher(),
    );

    const result = await useCase.execute("sync-key");

    assert.strictEqual(result.createdCount, 1);
    assert.strictEqual(result.missingLocalPasswordCount, 1);
    assert.strictEqual(readHasPassword(savedSyncedConnections[0]), true);
  });

  test("拉取带密文的新连接时解密密码并保存", async () => {
    const remoteConnection = makePostgreSqlUrlConnection({
      url: "postgresql://postgres@127.0.0.1:5432/postgres",
      hasPassword: true,
    });
    const encryptedPassword = await makeConnectionSecretCipher().encrypt(
      "remote-secret",
      "sync-key",
    );
    const { repository, savedSyncedConnections } = makeConnectionRepository();
    const syncStore = makeConnectionSyncStore({
      version: CONNECTION_SYNC_PAYLOAD_VERSION,
      exportedAt: "2026-07-04T00:00:00.000Z",
      connections: [{ config: remoteConnection, encryptedPassword }],
    });
    const useCase = new PullConnectionConfigSyncUseCase(
      repository,
      syncStore.store,
      makeConnectionSecretCipher(),
    );

    const result = await useCase.execute("sync-key");

    assert.strictEqual(result.createdCount, 1);
    assert.strictEqual(result.decryptedPasswordCount, 1);
    const savedConnection = savedSyncedConnections[0];
    const savedUrl = savedConnection?.mode === "url" ? savedConnection.url : "";
    assert.strictEqual(new URL(savedUrl).password, "remote-secret");
  });

  test("拉取密文时同步密钥错误会拒绝导入", async () => {
    const encryptedPassword = await makeConnectionSecretCipher().encrypt("secret", "right-key");
    const { repository, savedSyncedConnections } = makeConnectionRepository();
    const syncStore = makeConnectionSyncStore({
      version: CONNECTION_SYNC_PAYLOAD_VERSION,
      exportedAt: "2026-07-04T00:00:00.000Z",
      connections: [
        {
          config: makeMysqlParameterConnection({ password: undefined, hasPassword: true }),
          encryptedPassword,
        },
      ],
    });
    const useCase = new PullConnectionConfigSyncUseCase(
      repository,
      syncStore.store,
      makeConnectionSecretCipher(),
    );

    await assert.rejects(() => useCase.execute("wrong-key"), /同步密钥不正确/);
    assert.strictEqual(savedSyncedConnections.length, 0);
  });

  test("拉取含明文密码的同步载荷时拒绝导入", async () => {
    const { repository } = makeConnectionRepository();
    const syncStore = makeConnectionSyncStore({
      version: CONNECTION_SYNC_PAYLOAD_VERSION,
      exportedAt: "2026-07-04T00:00:00.000Z",
      connections: [{ config: makeMysqlParameterConnection({ password: "remote-secret" }) }],
    });
    const useCase = new PullConnectionConfigSyncUseCase(
      repository,
      syncStore.store,
      makeConnectionSecretCipher(),
    );

    await assert.rejects(() => useCase.execute("sync-key"), /同步载荷包含明文密码/);
  });

  test("上传剥离 URL query 中的明文密码并加密", async () => {
    const { repository } = makeConnectionRepository([
      makePostgreSqlUrlConnection({
        url: "postgresql://postgres@127.0.0.1:5432/postgres?password=query-secret&sslmode=require",
      }),
    ]);
    const syncStore = makeConnectionSyncStore();
    const useCase = new UploadConnectionConfigSyncUseCase(
      repository,
      syncStore.store,
      makeConnectionSecretCipher(),
    );

    const result = await useCase.execute("sync-key");

    assert.strictEqual(result.encryptedPasswordCount, 1);
    const syncedConnection = syncStore.payload?.connections[0];
    const syncedConfig = syncedConnection?.config;
    const syncedUrl = syncedConfig?.mode === "url" ? syncedConfig.url : "";
    const parsedSyncedUrl = new URL(syncedUrl);
    assert.strictEqual(parsedSyncedUrl.searchParams.has("password"), false);
    assert.strictEqual(parsedSyncedUrl.searchParams.get("sslmode"), "require");
    assert.strictEqual(readHasPassword(syncedConfig), true);
    assert.ok(syncedConnection?.encryptedPassword);
  });

  test("拉取时保留同 id 本机 URL 密码", async () => {
    const localConnection = makePostgreSqlUrlConnection({
      url: "postgresql://postgres:local-secret@127.0.0.1:5432/postgres",
    });
    const remoteConnection = makePostgreSqlUrlConnection({
      name: "远端 PostgreSQL",
      url: "postgresql://postgres@127.0.0.1:5432/postgres",
      hasPassword: true,
    });
    const { repository, savedSyncedConnections } = makeConnectionRepository([localConnection]);
    const syncStore = makeConnectionSyncStore({
      version: CONNECTION_SYNC_PAYLOAD_VERSION,
      exportedAt: "2026-07-04T00:00:00.000Z",
      connections: [{ config: remoteConnection }],
    });
    const useCase = new PullConnectionConfigSyncUseCase(
      repository,
      syncStore.store,
      makeConnectionSecretCipher(),
    );

    const result = await useCase.execute("sync-key");

    assert.strictEqual(result.updatedCount, 1);
    assert.strictEqual(result.decryptedPasswordCount, 0);
    const savedConnection = savedSyncedConnections[0];
    const savedUrl = savedConnection?.mode === "url" ? savedConnection.url : "";
    assert.strictEqual(new URL(savedUrl).password, "local-secret");
    assert.strictEqual(savedConnection?.name, "远端 PostgreSQL");
  });

  test("多连接中任一密钥错误时整体不落库", async () => {
    const cleanConnection = makeMysqlParameterConnection({
      id: "mysql-clean",
      password: undefined,
      hasPassword: true,
    });
    const encryptedPassword = await makeConnectionSecretCipher().encrypt("secret", "right-key");
    const { repository, savedSyncedConnections } = makeConnectionRepository();
    const syncStore = makeConnectionSyncStore({
      version: CONNECTION_SYNC_PAYLOAD_VERSION,
      exportedAt: "2026-07-04T00:00:00.000Z",
      connections: [
        { config: cleanConnection },
        {
          config: makePostgreSqlUrlConnection({
            id: "pg-encrypted",
            url: "postgresql://postgres@127.0.0.1:5432/postgres",
            hasPassword: true,
          }),
          encryptedPassword,
        },
      ],
    });
    const useCase = new PullConnectionConfigSyncUseCase(
      repository,
      syncStore.store,
      makeConnectionSecretCipher(),
    );

    await assert.rejects(() => useCase.execute("wrong-key"), /同步密钥不正确/);
    assert.strictEqual(savedSyncedConnections.length, 0);
  });

  test("拉取畸形连接条目时整体拒绝且不落库", async () => {
    const { repository, savedSyncedConnections } = makeConnectionRepository();
    const syncStore = makeConnectionSyncStore({
      version: CONNECTION_SYNC_PAYLOAD_VERSION,
      exportedAt: "2026-07-04T00:00:00.000Z",
      connections: [
        { config: makeMysqlParameterConnection({ id: "mysql-ok", password: undefined }) },
        { config: { id: "broken", name: "缺字段", engine: "mysql", mode: "parameters" } },
      ] as never,
    });
    const useCase = new PullConnectionConfigSyncUseCase(
      repository,
      syncStore.store,
      makeConnectionSecretCipher(),
    );

    await assert.rejects(() => useCase.execute("sync-key"), /参数连接缺少 host/);
    assert.strictEqual(savedSyncedConnections.length, 0);
  });
});

/**
 * 读取连接配置的密码标记。
 *
 * @param {ConnectionConfig | undefined} connection 连接配置。
 * @returns {boolean | undefined} 密码标记。
 */
function readHasPassword(connection: ConnectionConfig | undefined): boolean | undefined {
  return connection && "hasPassword" in connection ? connection.hasPassword : undefined;
}
