import type { ConnectionConfig } from "../../domain/connections/ConnectionConfig";

/**
 * 为 UI 展示创建连接目标描述。
 *
 * @param {ConnectionConfig} connection 当前连接配置。
 * @returns {string} 用户可读的连接目标文本。
 */
export function describeConnectionTarget(connection: ConnectionConfig): string {
  if (connection.mode === "parameters") {
    return `${connection.host}:${connection.port}`;
  }

  if (connection.mode === "file") {
    return connection.dbPath;
  }

  return maskConnectionUrl(connection.url);
}

/**
 * 移除连接 URL 中的密码片段，避免在 UI 中直接展示敏感信息。
 *
 * @param {string} connectionUrl 原始连接 URL。
 * @returns {string} 去掉密码后的连接 URL。
 */
export function maskConnectionUrl(connectionUrl: string): string {
  try {
    const parsedUrl = new URL(connectionUrl);

    if (parsedUrl.password.length === 0) {
      return connectionUrl;
    }

    parsedUrl.password = "";
    return parsedUrl.toString();
  } catch {
    return connectionUrl;
  }
}
