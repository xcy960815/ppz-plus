import type { MysqlConnectionConfig } from '../../domain/connections/ConnectionConfig';
import type {
	MySqlTableDataProvider,
	MySqlTableDeleteResult,
	MySqlTableRowIdentityValues,
} from '../mysql/MySqlTableDataProvider';

/**
 * 删除 MySQL 表单条记录的应用用例。
 */
export class DeleteMySqlTableRowUseCase {
	/**
	 * 创建删除表行用例。
	 *
	 * @param mySqlTableDataProvider 用于写入 MySQL 表数据的提供者。
	 */
	public constructor(
		private readonly mySqlTableDataProvider: MySqlTableDataProvider
	) {}

	/**
	 * 删除指定 MySQL 表中的单条记录。
	 *
	 * @param connection MySQL 连接配置。
	 * @param schemaName 表所属的 schema。
	 * @param tableName 需要删除记录的表。
	 * @param identityValues 用于定位原行的字段值。
	 * @returns 单行删除结果。
	 */
	public async execute(
		connection: MysqlConnectionConfig,
		schemaName: string,
		tableName: string,
		identityValues: MySqlTableRowIdentityValues
	): Promise<MySqlTableDeleteResult> {
		if (schemaName.trim().length === 0) {
			throw new Error('删除 MySQL 记录需要提供 schema 名称。');
		}

		if (tableName.trim().length === 0) {
			throw new Error('删除 MySQL 记录需要提供表名。');
		}

		if (Object.keys(identityValues).length === 0) {
			throw new Error('删除 MySQL 记录需要提供主键值。');
		}

		return this.mySqlTableDataProvider.deleteRow(
			connection,
			schemaName,
			tableName,
			identityValues
		);
	}
}
