import type {
  SqlExportCapabilityCheck,
  SqlExportCapabilityRequirement,
} from "../../application/useCases/CheckSqlExportCapabilityUseCase";
import type { DatabaseCapabilityKey } from "../../domain/capabilities/DatabaseCapabilityDeclaration";
import type { DatabaseEngine } from "../../domain/database/DatabaseEngine";
import type { SqlExportKind } from "../../domain/export/SqlExportDocument";

const ENGINE_LABELS: Record<DatabaseEngine, string> = {
  mysql: "MySQL",
  postgresql: "PostgreSQL",
  sqlite3: "SQLite3",
  mssql: "MSSQL",
  cockroachdb: "CockroachDB",
  mariadb: "MariaDB",
};

const EXPORT_KIND_LABELS: Record<SqlExportKind, string> = {
  ddl: "DDL",
  dml: "DML",
  both: "DDL + DML",
};

/**
 * 将 SQL 导出能力检查结果格式化为用户可读提示。
 *
 * @param {SqlExportCapabilityCheck} capabilityCheck SQL 导出入口能力检查结果。
 * @returns {string} 可直接展示给用户的能力差异提示。
 */
export function formatSqlExportCapabilityMessage(
  capabilityCheck: SqlExportCapabilityCheck,
): string {
  const engineLabel = ENGINE_LABELS[capabilityCheck.engine];
  const exportKindLabel = EXPORT_KIND_LABELS[capabilityCheck.kind];

  if (!capabilityCheck.declarationFound) {
    return `${engineLabel} 导出能力尚未声明，PPZ Plus 不会开始 ${exportKindLabel} 导出。`;
  }

  const unsupportedRequirements = capabilityCheck.requirements.filter(
    (requirement) => requirement.support !== "supported",
  );
  const requirementSummary = unsupportedRequirements
    .map(formatSqlExportCapabilityRequirement)
    .join(", ");

  return `${engineLabel} ${exportKindLabel} 导出暂不可用：${requirementSummary}。PPZ Plus 不会开始导出。`;
}

/**
 * 格式化单项 SQL 导出能力状态。
 *
 * @param {SqlExportCapabilityRequirement} requirement 单项 SQL 导出能力要求。
 * @returns {string} 面向用户的能力状态片段。
 */
function formatSqlExportCapabilityRequirement(requirement: SqlExportCapabilityRequirement): string {
  return `${formatCapabilityKey(requirement.key)} 为 ${formatCapabilitySupport(
    requirement.support,
  )}`;
}

/**
 * 格式化 SQL 导出能力支持状态。
 *
 * @param {SqlExportCapabilityRequirement['support']} support 原始能力支持状态。
 * @returns {string} 面向用户展示的支持状态。
 */
function formatCapabilitySupport(support: SqlExportCapabilityRequirement["support"]): string {
  if (support === "supported") {
    return "已支持";
  }

  if (support === "unsupported") {
    return "未支持";
  }

  return "计划支持";
}

/**
 * 格式化能力键对应的导出名称。
 *
 * @param {DatabaseCapabilityKey} key 数据库能力键。
 * @returns {string} 面向用户的导出能力名称。
 */
function formatCapabilityKey(key: DatabaseCapabilityKey): string {
  if (key === "exportDdl") {
    return "DDL 导出";
  }

  if (key === "exportDml") {
    return "DML 导出";
  }

  return key;
}
