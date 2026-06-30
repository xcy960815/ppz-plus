import type { MySqlRuntimeModule } from './MySqlRuntimeTypes';

/**
 * 动态加载可选 MySQL 运行时依赖，避免建立静态 TypeScript 依赖边。
 */
export class MySqlRuntimeLoader {
	/**
	 * 按需加载 mysql2 promise 运行时模块。
	 *
	 * @returns {Promise<MySqlRuntimeModule>} 动态导入的 mysql2 promise 模块。
	 */
	public async loadMySqlPromiseModule(): Promise<MySqlRuntimeModule> {
		try {
			/**
			 * 使用间接动态导入，使仓库编译假设与依赖安装时机解耦。
			 */
			const dynamicImport = new Function(
				'modulePath',
				'return import(modulePath);'
			) as (modulePath: string) => Promise<unknown>;

			return (await dynamicImport('mysql2/promise')) as MySqlRuntimeModule;
		} catch (error) {
			throw new Error(
				[
					'MySQL runtime support requires the "mysql2" package to be installed.',
					error instanceof Error ? error.message : String(error),
				].join(' ')
			);
		}
	}
}
