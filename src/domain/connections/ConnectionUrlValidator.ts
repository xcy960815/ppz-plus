import type { ConnectionConfig } from "./ConnectionConfig";

/**
 * 校验 MySQL 连接 URL。
 *
 * @param {string} value 原始 URL 字符串。
 * @returns {string | undefined} 无效时返回的校验提示；有效时为空。
 */
export function validateMysqlUrl(value: string): string | undefined {
  try {
    const parsedUrl = new URL(value.trim());
    return parsedUrl.protocol === "mysql:" ? undefined : "URL 必须以 mysql:// 开头。";
  } catch {
    return "请输入有效的 mysql:// URL。";
  }
}

/**
 * 校验 MSSQL 连接 URL。
 *
 * @param {string} value 原始 URL 字符串。
 * @returns {string | undefined} 无效时返回的校验提示；有效时为空。
 */
export function validateMssqlUrl(value: string): string | undefined {
  try {
    const parsedUrl = new URL(value.trim());
    return parsedUrl.protocol === "mssql:" ? undefined : "URL 必须以 mssql:// 开头。";
  } catch {
    return "请输入有效的 mssql:// URL。";
  }
}

/**
 * 校验 PostgreSQL 连接 URL。
 *
 * @param {string} value 原始 URL 字符串。
 * @returns {string | undefined} 无效时返回的校验提示；有效时为空。
 */
export function validatePostgreSqlUrl(value: string): string | undefined {
  try {
    const parsedUrl = new URL(value.trim());
    return parsedUrl.protocol === "postgresql:" || parsedUrl.protocol === "postgres:"
      ? undefined
      : "URL 必须以 postgresql:// 或 postgres:// 开头。";
  } catch {
    return "请输入有效的 postgresql:// 或 postgres:// URL。";
  }
}

/**
 * 按数据库引擎选择并执行连接 URL 校验。
 *
 * @param {ConnectionConfig['engine']} engine 数据库引擎标识。
 * @param {string} value 原始 URL 字符串。
 * @returns {string | undefined} 无效时返回的校验提示；有效时为空。
 */
export function validateConnectionUrlForEngine(
  engine: ConnectionConfig["engine"],
  value: string,
): string | undefined {
  if (engine === "postgresql" || engine === "cockroachdb") {
    return validatePostgreSqlUrl(value);
  }

  if (engine === "mssql") {
    return validateMssqlUrl(value);
  }

  return validateMysqlUrl(value);
}
