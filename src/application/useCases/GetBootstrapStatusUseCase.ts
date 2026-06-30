import type { DatabaseCapabilityCatalog } from '../capabilities/DatabaseCapabilityCatalog';
import { DATABASE_CAPABILITY_KEYS } from '../../domain/capabilities/DatabaseCapabilityDeclaration';

/**
 * 描述临时状态命令展示的启动信息。
 */
export interface BootstrapStatus {
	readonly focusEngine: string;
	readonly supportedCapabilities: readonly string[];
	readonly plannedEngines: readonly string[];
}

/**
 * 为当前扩展状态构建轻量启动摘要。
 */
export class GetBootstrapStatusUseCase {
	/**
	 * 创建启动状态用例。
	 *
	 * @param capabilityCatalog 用于汇总引擎支持情况的能力来源。
	 */
	public constructor(
		private readonly capabilityCatalog: DatabaseCapabilityCatalog
	) {}

	/**
	 * 生成表现层命令消费的启动状态数据。
	 *
	 * @returns {BootstrapStatus} 当前启动状态快照。
	 */
	public execute(): BootstrapStatus {
		/**
		 * 获取作为 MVP 基线的 MySQL 能力声明。
		 */
		const mysqlCapabilities = this.capabilityCatalog.find('mysql');

		/**
		 * 列出 MVP 引擎已标记为支持的能力。
		 */
		const supportedCapabilities = mysqlCapabilities
			? DATABASE_CAPABILITY_KEYS.filter(
					(key) => mysqlCapabilities.capabilities[key] === 'supported'
				)
			: [];

		/**
		 * 列出 MySQL MVP 之后预留给后续阶段的数据库引擎。
		 */
		const plannedEngines = this.capabilityCatalog
			.list()
			.map((declaration) => declaration.engine)
			.filter((engine) => engine !== 'mysql');

		return {
			focusEngine: 'mysql',
			supportedCapabilities,
			plannedEngines,
		};
	}
}
