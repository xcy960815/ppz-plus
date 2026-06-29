import type { PostgreSqlConnectionConfig } from '../../domain/connections/ConnectionConfig';
import type {
	PostgreSqlMetadataProvider,
	PostgreSqlTableMetadata,
} from '../postgresql/PostgreSqlMetadataProvider';

/**
 * 列出 PostgreSQL schema 下的表。
 */
export class ListPostgreSqlTablesUseCase {
	/**
	 * 创建 PostgreSQL 表列表用例。
	 *
	 * @param postgreSqlMetadataProvider 用于读取 PostgreSQL 表元数据的提供者。
	 */
	public constructor(
		private readonly postgreSqlMetadataProvider: PostgreSqlMetadataProvider
	) {}

	/**
	 * 加载选中 PostgreSQL schema 下的表。
	 *
	 * @param connection PostgreSQL 连接配置。
	 * @param databaseName 需要连接的 database。
	 * @param schemaName 需要加载表的 schema。
	 * @returns 该 schema 下可见的表。
	 */
	public async execute(
		connection: PostgreSqlConnectionConfig,
		databaseName: string,
		schemaName: string
	): Promise<readonly PostgreSqlTableMetadata[]> {
		return this.postgreSqlMetadataProvider.listTables(
			connection,
			databaseName,
			schemaName
		);
	}
}
