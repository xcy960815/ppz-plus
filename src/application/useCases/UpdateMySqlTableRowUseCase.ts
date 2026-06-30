import type { MysqlConnectionConfig } from '../../domain/connections/ConnectionConfig';
import type {
	MySqlTableDataProvider,
	MySqlTableRowIdentityValues,
	MySqlTableUpdateResult,
	MySqlTableUpdateValues,
} from '../mysql/MySqlTableDataProvider';

/**
 * 更新 MySQL 表单条记录的应用用例。
 */
export class UpdateMySqlTableRowUseCase {
	/**
	 * 创建更新表行用例。
	 *
	 * @param mySqlTableDataProvider 用于写入 MySQL 表数据的提供者。
	 */
	public constructor(
		private readonly mySqlTableDataProvider: MySqlTableDataProvider
	) {}

	/**
	 * 更新指定 MySQL 表中的单条记录。
	 *
	 * @param {MysqlConnectionConfig} connection MySQL 连接配置。
	 * @param {string} schemaName 表所属的 schema。
	 * @param {string} tableName 需要更新记录的表。
	 * @param {MySqlTableRowIdentityValues} identityValues 用于定位原行的字段值。
	 * @param {MySqlTableUpdateValues} values 需要更新的新字段值。
	 * @returns {Promise<MySqlTableUpdateResult>} 单行更新结果。
	 */
	public async execute(
		connection: MysqlConnectionConfig,
		schemaName: string,
		tableName: string,
		identityValues: MySqlTableRowIdentityValues,
		values: MySqlTableUpdateValues
	): Promise<MySqlTableUpdateResult> {
		if (schemaName.trim().length === 0) {
			throw new Error('更新 MySQL 记录需要提供 schema 名称。');
		}

		if (tableName.trim().length === 0) {
			throw new Error('更新 MySQL 记录需要提供表名。');
		}

		if (Object.keys(identityValues).length === 0) {
			throw new Error('更新 MySQL 记录需要提供主键值。');
		}

		if (Object.keys(values).length === 0) {
			throw new Error('更新 MySQL 记录至少需要提供一个字段值。');
		}

		return this.mySqlTableDataProvider.updateRow(
			connection,
			schemaName,
			tableName,
			identityValues,
			values
		);
	}
}
