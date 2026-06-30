import { constants as fsConstants } from 'node:fs';
import * as fs from 'node:fs/promises';

import type { ConnectionTester } from '../../application/connections/ConnectionTester';
import type { ConnectionConfig } from '../../domain/connections/ConnectionConfig';
import { Sqlite3ConnectionAdapter } from './Sqlite3ConnectionAdapter';
import { Sqlite3RuntimeLoader } from './Sqlite3RuntimeLoader';
import type { Sqlite3RuntimeDatabase } from './Sqlite3RuntimeTypes';

/**
 * 通过文件权限和简单 SQL 测试 SQLite3 连接。
 */
export class Sqlite3DatabaseConnectionTester implements ConnectionTester {
	/**
	 * 创建 SQLite3 连接测试器。
	 *
	 * @param sqlite3ConnectionAdapter 用于解析 SQLite3 文件路径的适配器。
	 * @param sqlite3RuntimeLoader 用于延迟解析 SQLite3 运行时的加载器。
	 */
	public constructor(
		private readonly sqlite3ConnectionAdapter: Sqlite3ConnectionAdapter,
		private readonly sqlite3RuntimeLoader: Sqlite3RuntimeLoader
	) {}

	/**
	 * 测试 SQLite3 数据库文件是否可访问并可执行 SQL。
	 *
	 * @param {ConnectionConfig} config 待验证的连接配置。
	 */
	public async test(config: ConnectionConfig): Promise<void> {
		if (!this.sqlite3ConnectionAdapter.supports(config)) {
			throw new Error('SQLite3 连接测试器仅支持 SQLite3 连接。');
		}

		const databasePath =
			this.sqlite3ConnectionAdapter.resolveDatabasePath(config);
		await fs.access(databasePath, fsConstants.R_OK | fsConstants.W_OK);
		const sqlite3 = await this.sqlite3RuntimeLoader.loadSqlite3Module();
		const database = await this.openDatabase(
			databasePath,
			sqlite3.OPEN_READWRITE
		);

		try {
			await this.get(database, 'SELECT 1 AS ok', []);
		} finally {
			await this.closeDatabase(database);
		}
	}

	/**
	 * 打开 SQLite3 数据库文件。
	 *
	 * @param {string} databasePath 数据库文件路径。
	 * @param {number} mode SQLite3 打开模式。
	 * @returns {Promise<Sqlite3RuntimeDatabase>} 已打开的数据库实例。
	 */
	private async openDatabase(
		databasePath: string,
		mode: number
	): Promise<Sqlite3RuntimeDatabase> {
		const sqlite3 = await this.sqlite3RuntimeLoader.loadSqlite3Module();
		return new Promise((resolve, reject) => {
			const database = new sqlite3.Database(databasePath, mode, (error) => {
				if (error) {
					reject(error);
					return;
				}

				resolve(database);
			});
		});
	}

	/**
	 * 执行一条 SQLite3 单行查询。
	 *
	 * @param {Sqlite3RuntimeDatabase} database 已打开的数据库实例。
	 * @param {string} sql 需要执行的 SQL。
	 * @param {readonly unknown[]} params 绑定参数。
	 */
	private async get(
		database: Sqlite3RuntimeDatabase,
		sql: string,
		params: readonly unknown[]
	): Promise<unknown> {
		return new Promise((resolve, reject) => {
			database.get(sql, params, (error, row) => {
				if (error) {
					reject(error);
					return;
				}

				resolve(row);
			});
		});
	}

	/**
	 * 关闭 SQLite3 数据库实例。
	 *
	 * @param {Sqlite3RuntimeDatabase} database 已打开的数据库实例。
	 */
	private async closeDatabase(database: Sqlite3RuntimeDatabase): Promise<void> {
		await new Promise<void>((resolve, reject) => {
			database.close((error) => {
				if (error) {
					reject(error);
					return;
				}

				resolve();
			});
		});
	}
}
