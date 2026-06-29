import type { PostgreSqlDatabaseMetadata, PostgreSqlMetadataProvider } from '../postgresql/PostgreSqlMetadataProvider';
import type { PostgreSqlConnectionConfig } from '../../domain/connections/ConnectionConfig';

/**
 * 列出 PostgreSQL 连接下的 database。
 */
export class ListPostgreSqlDatabasesUseCase {
	/**
	 * 创建 PostgreSQL database 列表用例。
	 *
	 * @param postgreSqlMetadataProvider 用于读取 PostgreSQL database 元数据的提供者。
	 */
	public constructor(
		private readonly postgreSqlMetadataProvider: PostgreSqlMetadataProvider
	) {}

	/**
	 * 加载选中 PostgreSQL 连接可见的 database。
	 *
	 * @param connection PostgreSQL 连接配置。
	 * @returns 可见的 database 列表。
	 */
	public async execute(
		connection: PostgreSqlConnectionConfig
	): Promise<readonly PostgreSqlDatabaseMetadata[]> {
		return this.postgreSqlMetadataProvider.listDatabases(connection);
	}
}
