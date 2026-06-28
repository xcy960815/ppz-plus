import type { MysqlConnectionConfig } from '../../domain/connections/ConnectionConfig';
import type {
	MySqlTableDataProvider,
	MySqlTableInsertResult,
	MySqlTableInsertValues,
} from '../mysql/MySqlTableDataProvider';

/**
 * 向 MySQL 表新增单条记录的应用用例。
 */
export class InsertMySqlTableRowUseCase {
	/**
	 * 创建新增表行用例。
	 *
	 * @param mySqlTableDataProvider 用于写入 MySQL 表数据的提供者。
	 */
	public constructor(
		private readonly mySqlTableDataProvider: MySqlTableDataProvider
	) {}

	/**
	 * 向指定 MySQL 表新增单条记录。
	 *
	 * @param connection MySQL 连接配置。
	 * @param schemaName 表所属的 schema。
	 * @param tableName 需要新增记录的表。
	 * @param values 需要显式写入的字段值。
	 * @returns 单行新增结果。
	 */
	public async execute(
		connection: MysqlConnectionConfig,
		schemaName: string,
		tableName: string,
		values: MySqlTableInsertValues
	): Promise<MySqlTableInsertResult> {
		if (schemaName.trim().length === 0) {
			throw new Error('Schema name is required for MySQL row insert.');
		}

		if (tableName.trim().length === 0) {
			throw new Error('Table name is required for MySQL row insert.');
		}

		return this.mySqlTableDataProvider.insertRow(
			connection,
			schemaName,
			tableName,
			values
		);
	}
}
