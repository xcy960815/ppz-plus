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
	 * @param connection MySQL 连接配置。
	 * @param schemaName 表所属的 schema。
	 * @param tableName 需要更新记录的表。
	 * @param identityValues 用于定位原行的字段值。
	 * @param values 需要更新的新字段值。
	 * @returns 单行更新结果。
	 */
	public async execute(
		connection: MysqlConnectionConfig,
		schemaName: string,
		tableName: string,
		identityValues: MySqlTableRowIdentityValues,
		values: MySqlTableUpdateValues
	): Promise<MySqlTableUpdateResult> {
		if (schemaName.trim().length === 0) {
			throw new Error('Schema name is required for MySQL row update.');
		}

		if (tableName.trim().length === 0) {
			throw new Error('Table name is required for MySQL row update.');
		}

		if (Object.keys(identityValues).length === 0) {
			throw new Error('Primary key values are required for MySQL row update.');
		}

		if (Object.keys(values).length === 0) {
			throw new Error('At least one column value is required for MySQL row update.');
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
