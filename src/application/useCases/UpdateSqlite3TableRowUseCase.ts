import type { Sqlite3ConnectionConfig } from '../../domain/connections/ConnectionConfig';
import type {
	Sqlite3TableDataProvider,
	Sqlite3TableRowIdentityValues,
	Sqlite3TableUpdateResult,
	Sqlite3TableUpdateValues,
} from '../sqlite3/Sqlite3TableDataProvider';

/**
 * 更新 SQLite3 表单条记录的应用用例。
 */
export class UpdateSqlite3TableRowUseCase {
	/**
	 * 创建更新表行用例。
	 *
	 * @param sqlite3TableDataProvider 用于写入 SQLite3 表数据的提供者。
	 */
	public constructor(
		private readonly sqlite3TableDataProvider: Sqlite3TableDataProvider
	) {}

	/**
	 * 更新指定 SQLite3 表中的一条记录。
	 *
	 * @param {Sqlite3ConnectionConfig} connection SQLite3 连接配置。
	 * @param {string} tableName 需要更新记录的表。
	 * @param {Sqlite3TableRowIdentityValues} identityValues 用于定位原行的字段值。
	 * @param {Sqlite3TableUpdateValues} values 需要更新的新字段值。
	 * @returns {Promise<Sqlite3TableUpdateResult>} 单行更新结果。
	 */
	public async execute(
		connection: Sqlite3ConnectionConfig,
		tableName: string,
		identityValues: Sqlite3TableRowIdentityValues,
		values: Sqlite3TableUpdateValues
	): Promise<Sqlite3TableUpdateResult> {
		if (tableName.trim().length === 0) {
			throw new Error('更新 SQLite3 记录需要提供表名。');
		}

		if (Object.keys(identityValues).length === 0) {
			throw new Error('更新 SQLite3 记录需要提供主键值。');
		}

		if (Object.keys(values).length === 0) {
			throw new Error('更新 SQLite3 记录至少需要提供一个字段值。');
		}

		return this.sqlite3TableDataProvider.updateRow(
			connection,
			tableName,
			identityValues,
			values
		);
	}
}
