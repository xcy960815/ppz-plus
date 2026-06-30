import type { PostgreSqlConnectionConfig } from '../../domain/connections/ConnectionConfig';
import type {
	PostgreSqlMetadataProvider,
	PostgreSqlSchemaMetadata,
} from '../postgresql/PostgreSqlMetadataProvider';

/**
 * 列出 PostgreSQL database 下的 schema。
 */
export class ListPostgreSqlSchemasUseCase {
	/**
	 * 创建 PostgreSQL schema 列表用例。
	 *
	 * @param postgreSqlMetadataProvider 用于读取 PostgreSQL schema 元数据的提供者。
	 */
	public constructor(
		private readonly postgreSqlMetadataProvider: PostgreSqlMetadataProvider
	) {}

	/**
	 * 加载选中 PostgreSQL database 下的 schema。
	 *
	 * @param {PostgreSqlConnectionConfig} connection PostgreSQL 连接配置。
	 * @param {string} databaseName 需要连接并读取 schema 的 database。
	 * @returns {Promise<readonly PostgreSqlSchemaMetadata[]>} 该 database 下可见的 schema 列表。
	 */
	public async execute(
		connection: PostgreSqlConnectionConfig,
		databaseName: string
	): Promise<readonly PostgreSqlSchemaMetadata[]> {
		return this.postgreSqlMetadataProvider.listSchemas(
			connection,
			databaseName
		);
	}
}
