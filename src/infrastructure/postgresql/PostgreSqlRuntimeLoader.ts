import { createRequire } from 'node:module';

import type { PostgreSqlDriverOptions } from './PostgreSqlConnectionAdapter';
import type { PgRuntimeModule } from './PgRuntimeTypes';

/**
 * 延迟加载 PostgreSQL 运行时依赖，避免扩展启动时立即解析驱动。
 */
export class PostgreSqlRuntimeLoader {
	/** 保存当前模块上下文可用的 CommonJS require。 */
	private readonly require = createRequire(__filename);

	/**
	 * 加载 pg 运行时模块。
	 *
	 * @returns pg 模块的最小接口。
	 */
	public loadPostgreSqlModule(): PgRuntimeModule {
		return this.require('pg') as PgRuntimeModule;
	}
}
