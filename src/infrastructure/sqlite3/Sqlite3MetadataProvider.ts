import type {
	Sqlite3MetadataProvider as ApplicationSqlite3MetadataProvider,
	Sqlite3TableMetadata,
} from '../../application/sqlite3/Sqlite3MetadataProvider';
import type { Sqlite3ConnectionConfig } from '../../domain/connections/ConnectionConfig';
import { Sqlite3ConnectionAdapter } from './Sqlite3ConnectionAdapter';
import { Sqlite3RuntimeLoader } from './Sqlite3RuntimeLoader';
import type {
	Sqlite3QueryRows,
	Sqlite3RuntimeDatabase,
} from './Sqlite3RuntimeTypes';

/**
 * 通过 @vscode/sqlite3 读取 SQLite3 表和视图元数据。
 */
export class Sqlite3MetadataProvider
	implements ApplicationSqlite3MetadataProvider
{
	/**
	 * 创建 SQLite3 元数据提供者。
	 *
	 * @param sqlite3ConnectionAdapter 用于归一化数据库文件路径的适配器。
	 * @param sqlite3RuntimeLoader 用于延迟解析 SQLite3 运行时的加载器。
	 */
	public constructor(
		private readonly sqlite3ConnectionAdapter: Sqlite3ConnectionAdapter,
		private readonly sqlite3RuntimeLoader: Sqlite3RuntimeLoader
	) {}

	/**
	 * 列出当前 SQLite3 文件中的表和视图。
	 *
	 * @param connection SQLite3 连接配置。
	 * @returns 可见的表和视图列表。
	 */
	public async listTables(
		connection: Sqlite3ConnectionConfig
	): Promise<readonly Sqlite3TableMetadata[]> {
		const database = await this.openDatabase(connection);

		try {
			const rows = await this.all(
				database,
				[
					'SELECT name, type',
					'FROM sqlite_master',
					"WHERE type IN ('table', 'view')",
					"AND name NOT LIKE 'sqlite_%'",
					'ORDER BY type, name',
				].join(' '),
				[]
			);

			return this.normalizeTableRows(rows);
		} finally {
			await this.closeDatabase(database);
		}
	}

	/**
	 * 打开 SQLite3 数据库文件。
	 *
	 * @param connection SQLite3 连接配置。
	 * @returns 已打开的数据库实例。
	 */
	private async openDatabase(
		connection: Sqlite3ConnectionConfig
	): Promise<Sqlite3RuntimeDatabase> {
		const sqlite3 = await this.sqlite3RuntimeLoader.loadSqlite3Module();
		const databasePath =
			this.sqlite3ConnectionAdapter.resolveDatabasePath(connection);
		return new Promise((resolve, reject) => {
			const database = new sqlite3.Database(
				databasePath,
				sqlite3.OPEN_READWRITE,
				(error) => {
					if (error) {
						reject(error);
						return;
					}

					resolve(database);
				}
			);
		});
	}

	/**
	 * 执行 SQLite3 多行查询。
	 *
	 * @param database 已打开的数据库实例。
	 * @param sql 需要执行的 SQL。
	 * @param params 绑定参数。
	 * @returns 原始查询行。
	 */
	private async all(
		database: Sqlite3RuntimeDatabase,
		sql: string,
		params: readonly unknown[]
	): Promise<Sqlite3QueryRows> {
		return new Promise((resolve, reject) => {
			database.all(sql, params, (error, rows) => {
				if (error) {
					reject(error);
					return;
				}

				resolve(this.normalizeRawRows(rows));
			});
		});
	}

	/**
	 * 关闭 SQLite3 数据库实例。
	 *
	 * @param database 已打开的数据库实例。
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

	/**
	 * 将运行时返回的行集合归一化为对象数组。
	 *
	 * @param rows SQLite3 返回的原始行。
	 * @returns 对象行集合。
	 */
	private normalizeRawRows(rows: unknown[]): Sqlite3QueryRows {
		return rows.filter(
			(row): row is Record<string, unknown> =>
				row !== null && typeof row === 'object' && !Array.isArray(row)
		);
	}

	/**
	 * 将 sqlite_master 行归一化为表元数据。
	 *
	 * @param rows SQLite3 返回的原始行。
	 * @returns 归一化后的表元数据。
	 */
	private normalizeTableRows(
		rows: Sqlite3QueryRows
	): readonly Sqlite3TableMetadata[] {
		return rows
			.map((row) => {
				const name = row.name;
				const type = row.type;

				if (
					typeof name !== 'string' ||
					(type !== 'table' && type !== 'view')
				) {
					return undefined;
				}

				return { name, type };
			})
			.filter((table): table is Sqlite3TableMetadata => table !== undefined);
	}
}
