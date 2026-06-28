import type { DatabaseCapabilityCatalog } from '../capabilities/DatabaseCapabilityCatalog';
import type {
	CapabilitySupport,
	DatabaseCapabilityKey,
} from '../../domain/capabilities/DatabaseCapabilityDeclaration';
import type { DatabaseEngine } from '../../domain/database/DatabaseEngine';
import type { SqlExportKind } from '../../domain/export/SqlExportDocument';

/**
 * 描述 SQL 导出依赖的单项能力状态。
 */
export interface SqlExportCapabilityRequirement {
	readonly key: DatabaseCapabilityKey;
	readonly support: CapabilitySupport;
}

/**
 * 描述一次 SQL 导出入口能力检查结果。
 */
export interface SqlExportCapabilityCheck {
	readonly engine: DatabaseEngine;
	readonly kind: SqlExportKind;
	readonly declarationFound: boolean;
	readonly supported: boolean;
	readonly requirements: readonly SqlExportCapabilityRequirement[];
}

/**
 * 在 SQL 导出入口执行数据库能力判断。
 */
export class CheckSqlExportCapabilityUseCase {
	/**
	 * 创建 SQL 导出能力检查用例。
	 *
	 * @param capabilityCatalog 用于读取数据库能力声明的目录。
	 */
	public constructor(
		private readonly capabilityCatalog: DatabaseCapabilityCatalog
	) {}

	/**
	 * 检查指定数据库引擎是否支持目标 SQL 导出类型。
	 *
	 * @param engine 数据库引擎标识。
	 * @param kind 导出的 SQL 内容类型。
	 * @returns 可供表现层决定是否继续执行的能力检查结果。
	 */
	public execute(
		engine: DatabaseEngine,
		kind: SqlExportKind
	): SqlExportCapabilityCheck {
		/**
		 * 获取当前导出类型要求的能力键。
		 */
		const requiredCapabilityKeys = this.resolveRequiredCapabilityKeys(kind);

		/**
		 * 读取目标数据库的能力声明。
		 */
		const declaration = this.capabilityCatalog.find(engine);

		/**
		 * 汇总每一项导出能力的支持状态。
		 */
		const requirements = requiredCapabilityKeys.map((key) => ({
			key,
			support: declaration?.capabilities[key] ?? 'unsupported',
		}));

		return {
			engine,
			kind,
			declarationFound: declaration !== undefined,
			supported:
				declaration !== undefined &&
				requirements.every((requirement) => requirement.support === 'supported'),
			requirements,
		};
	}

	/**
	 * 将 SQL 导出类型转换为需要满足的能力键。
	 *
	 * @param kind 导出的 SQL 内容类型。
	 * @returns 当前导出类型要求的能力键列表。
	 */
	private resolveRequiredCapabilityKeys(
		kind: SqlExportKind
	): readonly DatabaseCapabilityKey[] {
		if (kind === 'ddl') {
			return ['exportDdl'];
		}

		if (kind === 'dml') {
			return ['exportDml'];
		}

		return ['exportDdl', 'exportDml'];
	}
}
