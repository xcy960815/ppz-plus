import type { MysqlConnectionConfig } from '../../domain/connections/ConnectionConfig';
import type {
	MySqlTableColumnMetadata,
	MySqlTableDataProvider,
} from '../mysql/MySqlTableDataProvider';

/**
 * 列出 MySQL 表的字段元数据。
 */
export class ListMySqlTableColumnsUseCase {
	/**
	 * 创建表字段列表用例。
	 *
	 * @param mySqlTableDataProvider 用于读取 MySQL 表结构的提供者。
	 */
	public constructor(
		private readonly mySqlTableDataProvider: MySqlTableDataProvider
	) {}

	/**
	 * 加载选中 MySQL 表的字段。
	 *
	 * @param {MysqlConnectionConfig} connection MySQL 连接配置。
	 * @param {string} schemaName 表所属的 schema。
	 * @param {string} tableName 需要加载字段的表。
	 * @returns {Promise<readonly MySqlTableColumnMetadata[]>} 归一化后的字段元数据。
	 */
	public async execute(
		connection: MysqlConnectionConfig,
		schemaName: string,
		tableName: string
	): Promise<readonly MySqlTableColumnMetadata[]> {
		return this.mySqlTableDataProvider.listColumns(
			connection,
			schemaName,
			tableName
		);
	}
}
