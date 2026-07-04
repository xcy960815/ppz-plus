import type { ConnectionConfig } from "../../domain/connections/ConnectionConfig";

/**
 * 定义 URL query 中会承载连接口令的敏感参数键（统一小写比较）。
 */
const SENSITIVE_URL_QUERY_KEYS: readonly string[] = ["password", "passwd", "pwd", "sslpassword"];

/**
 * 从 URL query 中提取第一个非空的敏感口令值。
 *
 * @param {URL} parsedUrl 已解析的连接 URL。
 * @returns {string | undefined} query 中的口令；不存在时为空。
 */
function extractUrlQuerySecret(parsedUrl: URL): string | undefined {
  for (const [key, value] of parsedUrl.searchParams) {
    if (SENSITIVE_URL_QUERY_KEYS.includes(key.toLowerCase()) && value.length > 0) {
      return value;
    }
  }

  return undefined;
}

/**
 * 移除 URL userinfo 与 query 中的全部敏感口令。
 *
 * @param {URL} parsedUrl 已解析的连接 URL。
 */
function stripUrlSecrets(parsedUrl: URL): void {
  parsedUrl.password = "";
  const sensitiveKeys = [...parsedUrl.searchParams.keys()].filter((key) =>
    SENSITIVE_URL_QUERY_KEYS.includes(key.toLowerCase()),
  );
  for (const key of sensitiveKeys) {
    parsedUrl.searchParams.delete(key);
  }
}

/**
 * 判断 URL 的 userinfo 或 query 中是否包含明文口令。
 *
 * @param {URL} parsedUrl 已解析的连接 URL。
 * @returns {boolean} 存在明文口令时返回 true。
 */
function urlContainsSecret(parsedUrl: URL): boolean {
  return parsedUrl.password.length > 0 || extractUrlQuerySecret(parsedUrl) !== undefined;
}

/**
 * 生成去敏后的连接同步配置。
 *
 * @param {ConnectionConfig} connection 运行时连接配置。
 * @returns {ConnectionConfig} 可写入同步载荷的非敏感连接配置。
 */
export function sanitizeConnectionForSync(connection: ConnectionConfig): ConnectionConfig {
  if (connection.mode === "file") {
    return connection;
  }

  if (connection.mode === "parameters") {
    const { password, ...sanitizedConnection } = connection;
    return {
      ...sanitizedConnection,
      hasPassword: Boolean(password) || connection.hasPassword === true,
    };
  }

  const parsedUrl = new URL(connection.url);
  const hasPassword = urlContainsSecret(parsedUrl) || connection.hasPassword === true;
  stripUrlSecrets(parsedUrl);

  return {
    ...connection,
    url: parsedUrl.toString(),
    hasPassword,
  };
}

/**
 * 从连接配置中提取待同步加密的密码。
 *
 * @param {ConnectionConfig} connection 运行时连接配置。
 * @returns {string | undefined} 提取到的密码；无密码时为空。
 */
export function extractConnectionPassword(connection: ConnectionConfig): string | undefined {
  if (connection.mode === "file") {
    return undefined;
  }

  if (connection.mode === "parameters") {
    return connection.password;
  }

  const parsedUrl = new URL(connection.url);
  return parsedUrl.password || extractUrlQuerySecret(parsedUrl);
}

/**
 * 将解密后的密码合并回去敏连接配置。
 *
 * @param {ConnectionConfig} connection 已去敏连接配置。
 * @param {string} password 解密得到的密码。
 * @returns {ConnectionConfig} 带运行时密码的连接配置。
 */
export function attachConnectionPassword(
  connection: ConnectionConfig,
  password: string,
): ConnectionConfig {
  if (connection.mode === "file") {
    return connection;
  }

  if (connection.mode === "parameters") {
    return {
      ...connection,
      password,
      hasPassword: true,
    };
  }

  const parsedUrl = new URL(connection.url);
  parsedUrl.password = password;

  return {
    ...connection,
    url: parsedUrl.toString(),
    hasPassword: true,
  };
}

/**
 * 判断连接同步配置中是否仍包含明文密码。
 *
 * @param {ConnectionConfig} connection 需要检查的连接配置。
 * @returns {boolean} 包含明文密码时返回 true。
 */
export function containsSensitiveConnectionSecret(connection: ConnectionConfig): boolean {
  if (connection.mode === "file") {
    return false;
  }

  if (connection.mode === "parameters") {
    return Boolean(connection.password);
  }

  return urlContainsSecret(new URL(connection.url));
}

/**
 * 判断连接是否声明有密码但当前运行时配置缺少本机密码。
 *
 * @param {ConnectionConfig} connection 需要检查的连接配置。
 * @returns {boolean} 缺少本机密码时返回 true。
 */
export function hasMissingLocalPassword(connection: ConnectionConfig): boolean {
  if (connection.mode === "file") {
    return false;
  }

  if (connection.hasPassword !== true) {
    return false;
  }

  if (connection.mode === "parameters") {
    return !connection.password;
  }

  return new URL(connection.url).password.length === 0;
}

/**
 * 尽量把本机已有密码合并到远端拉取的连接配置中。
 *
 * @param {ConnectionConfig} remoteConnection 远端非敏感连接配置。
 * @param {ConnectionConfig | undefined} localConnection 本机已有连接配置。
 * @returns {ConnectionConfig} 已保留本机密码的连接配置。
 */
export function preserveLocalPassword(
  remoteConnection: ConnectionConfig,
  localConnection: ConnectionConfig | undefined,
): ConnectionConfig {
  if (!localConnection || remoteConnection.mode === "file" || localConnection.mode === "file") {
    return remoteConnection;
  }

  if (remoteConnection.mode !== localConnection.mode) {
    return remoteConnection;
  }

  if (remoteConnection.mode === "parameters" && localConnection.mode === "parameters") {
    if (!localConnection.password) {
      return remoteConnection;
    }

    return {
      ...remoteConnection,
      password: localConnection.password,
      hasPassword: true,
    };
  }

  if (remoteConnection.mode === "url" && localConnection.mode === "url") {
    const localUrl = new URL(localConnection.url);

    if (localUrl.password.length === 0) {
      return remoteConnection;
    }

    const remoteUrl = new URL(remoteConnection.url);
    remoteUrl.password = localUrl.password;
    return {
      ...remoteConnection,
      url: remoteUrl.toString(),
      hasPassword: true,
    };
  }

  return remoteConnection;
}
