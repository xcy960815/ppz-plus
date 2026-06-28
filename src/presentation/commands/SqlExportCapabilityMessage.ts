import type {
	SqlExportCapabilityCheck,
	SqlExportCapabilityRequirement,
} from '../../application/useCases/CheckSqlExportCapabilityUseCase';
import type { DatabaseCapabilityKey } from '../../domain/capabilities/DatabaseCapabilityDeclaration';
import type { DatabaseEngine } from '../../domain/database/DatabaseEngine';
import type { SqlExportKind } from '../../domain/export/SqlExportDocument';

const ENGINE_LABELS: Record<DatabaseEngine, string> = {
	mysql: 'MySQL',
	postgresql: 'PostgreSQL',
	sqlite3: 'SQLite3',
	mssql: 'MSSQL',
	cockroachdb: 'CockroachDB',
	mariadb: 'MariaDB',
};

const EXPORT_KIND_LABELS: Record<SqlExportKind, string> = {
	ddl: 'DDL',
	dml: 'DML',
	both: 'DDL + DML',
};

/**
 * 将 SQL 导出能力检查结果格式化为用户可读提示。
 *
 * @param capabilityCheck SQL 导出入口能力检查结果。
 * @returns 可直接展示给用户的能力差异提示。
 */
export function formatSqlExportCapabilityMessage(
	capabilityCheck: SqlExportCapabilityCheck
): string {
	const engineLabel = ENGINE_LABELS[capabilityCheck.engine];
	const exportKindLabel = EXPORT_KIND_LABELS[capabilityCheck.kind];

	if (!capabilityCheck.declarationFound) {
		return `${engineLabel} export capability is not declared yet. PPZ Plus will not start ${exportKindLabel} export.`;
	}

	const unsupportedRequirements = capabilityCheck.requirements.filter(
		(requirement) => requirement.support !== 'supported'
	);
	const requirementSummary = unsupportedRequirements
		.map(formatSqlExportCapabilityRequirement)
		.join(', ');

	return `${engineLabel} ${exportKindLabel} export is not available yet: ${requirementSummary}. PPZ Plus will not start the export.`;
}

/**
 * 格式化单项 SQL 导出能力状态。
 *
 * @param requirement 单项 SQL 导出能力要求。
 * @returns 面向用户的能力状态片段。
 */
function formatSqlExportCapabilityRequirement(
	requirement: SqlExportCapabilityRequirement
): string {
	return `${formatCapabilityKey(requirement.key)} is ${requirement.support}`;
}

/**
 * 格式化能力键对应的导出名称。
 *
 * @param key 数据库能力键。
 * @returns 面向用户的导出能力名称。
 */
function formatCapabilityKey(key: DatabaseCapabilityKey): string {
	if (key === 'exportDdl') {
		return 'DDL export';
	}

	if (key === 'exportDml') {
		return 'DML export';
	}

	return key;
}
