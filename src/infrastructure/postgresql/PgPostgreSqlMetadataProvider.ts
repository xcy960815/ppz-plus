import type { PostgreSqlConnectionConfig } from '../../domain/connections/ConnectionConfig';
import type {
	PostgreSqlDatabaseMetadata,
	PostgreSqlMetadataProvider,
	PostgreSqlSchemaMetadata,
	PostgreSqlTableMetadata,
} from '../../application/postgresql/PostgreSqlMetadataProvider';
import { PostgreSqlConnectionAdapter } from './PostgreSqlConnectionAdapter';
import type { PostgreSqlRuntimeClient } from './PostgreSqlRuntimeLoader';
import { PostgreSqlRuntimeLoader } from './PostgreSqlRuntimeLoader';

/**
 * 通过 pg 驱动读取 PostgreSQL database、schema 和表元数据。
 */
export class PgPostgreSqlMetadataProvider
	implements PostgreSqlMetadataProvider
{
	/**
	 * 创建基于 pg 的 PostgreSQL 元数据提供者。
	 *
	 * @param postgreSqlConnectionAdapter 用于归一化连接选项的适配器。
	 * @param postgreSqlRuntimeLoader 用于延迟解析 pg 运行时的加载器。
	 */
	public constructor(
		private readonly postgreSqlConnectionAdapter: PostgreSqlConnectionAdapter,
		private readonly postgreSqlRuntimeLoader: PostgreSqlRuntimeLoader
	) {}

	/**
	 * 列出当前 PostgreSQL 连接可见的 database。
	 *
	 * @param connection PostgreSQL 连接配置。
	 * @returns 可见的 database 列表。
	 */
	public async listDatabases(
		connection: PostgreSqlConnectionConfig
	): Promise<readonly PostgreSqlDatabaseMetadata[]> {
		const client = await this.openClient(connection);

		try {
			const result = await client.query(
				[
					'SELECT datname AS name',
					'FROM pg_database',
					'WHERE datistemplate = false',
					'ORDER BY datname',
				].join(' ')
			);

			return this.normalizeNameRows(result.rows);
		} finally {
			await client.end();
		}
	}

	/**
	 * 列出指定 PostgreSQL database 下的 schema。
	 *
	 * @param connection PostgreSQL 连接配置。
	 * @param databaseName 需要连接的 database。
	 * @returns 可见的 schema 列表。
	 */
	public async listSchemas(
		connection: PostgreSqlConnectionConfig,
		databaseName: string
	): Promise<readonly PostgreSqlSchemaMetadata[]> {
		const client = await this.openClient(connection, databaseName);

		try {
			const result = await client.query(
				[
					'SELECT schema_name AS name',
					'FROM information_schema.schemata',
					'ORDER BY schema_name',
				].join(' ')
			);

			return this.normalizeNameRows(result.rows).map((schema) => ({
				databaseName,
				name: schema.name,
			}));
		} finally {
			await client.end();
		}
	}

	/**
	 * 列出指定 PostgreSQL schema 下的表。
	 *
	 * @param connection PostgreSQL 连接配置。
	 * @param databaseName 需要连接的 database。
	 * @param schemaName 需要加载表的 schema。
	 * @returns 该 schema 下可见的表。
	 */
	public async listTables(
		connection: PostgreSqlConnectionConfig,
		databaseName: string,
		schemaName: string
	): Promise<readonly PostgreSqlTableMetadata[]> {
		const client = await this.openClient(connection, databaseName);

		try {
			const result = await client.query(
				[
					'SELECT table_name AS name',
					'FROM information_schema.tables',
					'WHERE table_schema = $1',
					'ORDER BY table_name',
				].join(' '),
				[schemaName]
			);

			return this.normalizeNameRows(result.rows).map((table) => ({
				databaseName,
				schemaName,
				name: table.name,
			}));
		} finally {
			await client.end();
		}
	}

	/**
	 * 打开 pg 客户端连接。
	 *
	 * @param connection PostgreSQL 连接配置。
	 * @param databaseName 需要覆盖连接目标时使用的 database。
	 * @returns 已连接的 pg 客户端。
	 */
	private async openClient(
		connection: PostgreSqlConnectionConfig,
		databaseName?: string
	): Promise<PostgreSqlRuntimeClient> {
		const postgreSql = this.postgreSqlRuntimeLoader.loadPostgreSqlModule();
		const client = new postgreSql.Client(
			this.postgreSqlConnectionAdapter.resolveDriverOptions(
				connection,
				databaseName
			)
		);
		await client.connect();
		return client;
	}

	/**
	 * 将 pg 查询行归一化为只包含 name 的元数据。
	 *
	 * @param rows pg 返回的原始行值。
	 * @returns 归一化后的名称元数据。
	 */
	private normalizeNameRows(
		rows: readonly Record<string, unknown>[]
	): readonly { readonly name: string }[] {
		return rows
			.map((row) =>
				typeof row.name === 'string' ? { name: row.name } : undefined
			)
			.filter(
				(entry): entry is { readonly name: string } => entry !== undefined
			);
	}
}
