import type { ConnectionConfig } from "../../domain/connections/ConnectionConfig";
import type {
  EncryptedConnectionSecret,
  SyncedConnectionConfig,
} from "../connections/ConnectionSyncPayload";

/**
 * 定义允许出现在同步载荷中的数据库引擎集合。
 */
const ALLOWED_ENGINES: readonly ConnectionConfig["engine"][] = [
  "mysql",
  "postgresql",
  "sqlite3",
  "mssql",
  "cockroachdb",
  "mariadb",
];

/**
 * 定义允许出现在同步载荷中的连接输入模式集合。
 */
const ALLOWED_MODES: readonly ConnectionConfig["mode"][] = ["parameters", "url", "file"];

/**
 * 判断未知值是否为普通对象。
 *
 * @param {unknown} value 待判断的值。
 * @returns {boolean} 普通对象返回 true。
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * 判断值是否为非空字符串。
 *
 * @param {unknown} value 待判断的值。
 * @returns {boolean} 非空字符串返回 true。
 */
function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

/**
 * 校验加密密码密文的结构。
 *
 * @param {unknown} value 待校验的密文值。
 */
function assertEncryptedSecretShape(value: unknown): asserts value is EncryptedConnectionSecret {
  if (!isRecord(value)) {
    throw new Error("同步载荷中的密码密文格式无效。");
  }

  if (value.algorithm !== "aes-256-gcm" || value.kdf !== "scrypt") {
    throw new Error("同步载荷中的密码密文使用了不支持的加密算法。");
  }

  for (const field of ["salt", "iv", "authTag", "ciphertext"] as const) {
    if (!isNonEmptyString(value[field])) {
      throw new Error(`同步载荷中的密码密文缺少 ${field}。`);
    }
  }
}

/**
 * 按连接输入模式校验必需字段。
 *
 * @param {Record<string, unknown>} config 待校验的连接配置。
 */
function assertModeSpecificFields(config: Record<string, unknown>): void {
  if (config.mode === "file") {
    if (!isNonEmptyString(config.dbPath)) {
      throw new Error("同步载荷中的文件连接缺少 dbPath。");
    }
    return;
  }

  if (config.mode === "url") {
    if (!isNonEmptyString(config.url)) {
      throw new Error("同步载荷中的 URL 连接缺少 url。");
    }
    try {
      new URL(config.url);
    } catch {
      throw new Error("同步载荷中的 URL 连接包含无法解析的 url。");
    }
    return;
  }

  if (!isNonEmptyString(config.host)) {
    throw new Error("同步载荷中的参数连接缺少 host。");
  }
  if (typeof config.port !== "number" || !Number.isFinite(config.port)) {
    throw new Error("同步载荷中的参数连接缺少合法 port。");
  }
  if (!isNonEmptyString(config.username)) {
    throw new Error("同步载荷中的参数连接缺少 username。");
  }
}

/**
 * 校验单条同步连接的结构，非法时抛出错误。
 *
 * @param {unknown} value 待校验的同步连接值。
 * @returns {SyncedConnectionConfig} 已通过结构校验的同步连接。
 */
export function assertSyncedConnection(value: unknown): SyncedConnectionConfig {
  if (!isRecord(value)) {
    throw new Error("同步载荷中的连接条目格式无效。");
  }

  const config = value.config;
  if (!isRecord(config)) {
    throw new Error("同步载荷中的连接条目缺少 config。");
  }

  if (!isNonEmptyString(config.id)) {
    throw new Error("同步载荷中的连接缺少 id。");
  }
  if (!isNonEmptyString(config.name)) {
    throw new Error("同步载荷中的连接缺少 name。");
  }
  if (!ALLOWED_ENGINES.includes(config.engine as ConnectionConfig["engine"])) {
    throw new Error(`同步载荷中的连接使用了不支持的 engine：${String(config.engine)}。`);
  }
  if (!ALLOWED_MODES.includes(config.mode as ConnectionConfig["mode"])) {
    throw new Error(`同步载荷中的连接使用了不支持的 mode：${String(config.mode)}。`);
  }

  assertModeSpecificFields(config);

  if (value.encryptedPassword !== undefined) {
    assertEncryptedSecretShape(value.encryptedPassword);
  }

  return value as unknown as SyncedConnectionConfig;
}
