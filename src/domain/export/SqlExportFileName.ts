import type { SqlExportKind } from "./SqlExportDocument";

/**
 * 格式化 SQL 导出文件名。
 *
 * DDL 和 DML 单独导出时保留类型后缀，DDL+DML 同时导出时省略 both 后缀。
 *
 * @param {readonly string[]} nameSegments 导出目标名称片段。
 * @param {SqlExportKind} kind SQL 导出类型。
 * @param {string} extension 文件扩展名。
 * @returns {string} SQL 导出文件名。
 */
export function formatSqlExportFileName(
  nameSegments: readonly string[],
  kind: SqlExportKind,
  extension = "sql",
): string {
  const suffixSegments = kind === "both" ? [extension] : [kind, extension];

  return [...nameSegments, ...suffixSegments].join(".");
}
