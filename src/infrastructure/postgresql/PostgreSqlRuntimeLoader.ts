import { createRequire } from 'node:module';

import type { PostgreSqlDriverOptions } from './PostgreSqlConnectionAdapter';

/**
 * 描述 pg 查询返回的最小结果形状。
 */
export interface PostgreSqlQueryResult {
	readonly rows: readonly Record<string, unknown>[];
}

/**
 * 描述 pg Client 的最小运行时接口。
 */
export interface PostgreSqlRuntimeClient {
	connect(): Promise<void>;
	end(): Promise<void>;
	query(
		sql: string,
		values?: readonly unknown[]
	): Promise<PostgreSqlQueryResult>;
}

/**
 * 描述 pg 模块的最小运行时接口。
 */
export interface PostgreSqlRuntimeModule {
	readonly Client: new (
		options: PostgreSqlDriverOptions
	) => PostgreSqlRuntimeClient;
}

/**
 * 延迟加载 PostgreSQL 运行时依赖，避免扩展启动时立即解析驱动。
 */
export class PostgreSqlRuntimeLoader {
	/**
	 * 保存当前模块上下文可用的 CommonJS require。
	 */
	private readonly require = createRequire(__filename);

	/**
	 * 加载 pg 运行时模块。
	 *
	 * @returns pg 模块的最小接口。
	 */
	public loadPostgreSqlModule(): PostgreSqlRuntimeModule {
		return this.require('pg') as PostgreSqlRuntimeModule;
	}
}
