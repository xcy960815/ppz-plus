import type { Sqlite3ConnectionConfig } from '../../domain/connections/ConnectionConfig';
import type {
	Sqlite3TableDataProvider,
	Sqlite3TableDeleteResult,
	Sqlite3TableRowIdentityValues,
} from '../sqlite3/Sqlite3TableDataProvider';

/**
 * 删除 SQLite3 表单条记录的应用用例。
 */
export class DeleteSqlite3TableRowUseCase {
	/**
	 * 创建删除表行用例。
	 *
	 * @param sqlite3TableDataProvider 用于写入 SQLite3 表数据的提供者。
	 */
	public constructor(
		private readonly sqlite3TableDataProvider: Sqlite3TableDataProvider
	) {}

	/**
	 * 删除指定 SQLite3 表中的一条记录。
	 *
	 * @param {Sqlite3ConnectionConfig} connection SQLite3 连接配置。
	 * @param {string} tableName 需要删除记录的表。
	 * @param {Sqlite3TableRowIdentityValues} identityValues 用于定位原行的字段值。
	 * @returns {Promise<Sqlite3TableDeleteResult>} 单行删除结果。
	 */
	public async execute(
		connection: Sqlite3ConnectionConfig,
		tableName: string,
		identityValues: Sqlite3TableRowIdentityValues
	): Promise<Sqlite3TableDeleteResult> {
		if (tableName.trim().length === 0) {
			throw new Error('删除 SQLite3 记录需要提供表名。');
		}

		if (Object.keys(identityValues).length === 0) {
			throw new Error('删除 SQLite3 记录需要提供主键值。');
		}

		return this.sqlite3TableDataProvider.deleteRow(
			connection,
			tableName,
			identityValues
		);
	}
}
