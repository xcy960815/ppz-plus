import type { MysqlConnectionConfig } from '../../domain/connections/ConnectionConfig';
import type {
	MySqlMetadataProvider,
	MySqlSchemaMetadata,
} from '../mysql/MySqlMetadataProvider';

/**
 * 列出 MySQL 连接下的 schema。
 */
export class ListMySqlSchemasUseCase {
	/**
	 * 创建 schema 列表用例。
	 *
	 * @param mySqlMetadataProvider 用于读取 MySQL schema 元数据的提供者。
	 */
	public constructor(
		private readonly mySqlMetadataProvider: MySqlMetadataProvider
	) {}

	/**
	 * 加载选中 MySQL 连接可见的 schema。
	 *
	 * @param {MysqlConnectionConfig} connection MySQL 连接配置。
	 * @returns {Promise<readonly MySqlSchemaMetadata[]>} 可见的 schema 列表。
	 */
	public async execute(
		connection: MysqlConnectionConfig
	): Promise<readonly MySqlSchemaMetadata[]> {
		return this.mySqlMetadataProvider.listSchemas(connection);
	}
}
