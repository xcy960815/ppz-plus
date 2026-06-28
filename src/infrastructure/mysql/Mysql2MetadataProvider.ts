import type { MysqlConnectionConfig } from '../../domain/connections/ConnectionConfig';
import type {
	MySqlMetadataProvider,
	MySqlSchemaMetadata,
	MySqlTableMetadata,
} from '../../application/mysql/MySqlMetadataProvider';
import { MySqlConnectionAdapter } from './MySqlConnectionAdapter';
import { MySqlRuntimeLoader } from './MySqlRuntimeLoader';

/**
 * 通过 mysql2 promise 驱动读取 MySQL schema 和表元数据。
 */
export class Mysql2MetadataProvider implements MySqlMetadataProvider {
	/**
	 * 创建基于 mysql2 的元数据提供者。
	 *
	 * @param mySqlConnectionAdapter 用于归一化连接选项的适配器。
	 * @param mySqlRuntimeLoader 用于延迟解析 mysql2 运行时的加载器。
	 */
	public constructor(
		private readonly mySqlConnectionAdapter: MySqlConnectionAdapter,
		private readonly mySqlRuntimeLoader: MySqlRuntimeLoader
	) {}

	/**
	 * 列出当前 MySQL 连接可见的 schema。
	 *
	 * @param connection MySQL 连接配置。
	 * @returns 可见的 schema 列表。
	 */
	public async listSchemas(
		connection: MysqlConnectionConfig
	): Promise<readonly MySqlSchemaMetadata[]> {
		const mysql = await this.mySqlRuntimeLoader.loadMySqlPromiseModule();
		const runtimeConnection = await mysql.createConnection(
			this.mySqlConnectionAdapter.resolveDriverOptions(connection)
		);

		try {
			const [rows] = await runtimeConnection.query('SHOW DATABASES');

			return this.normalizeDatabaseRows(rows);
		} finally {
			await runtimeConnection.end();
		}
	}

	/**
	 * 列出指定 MySQL schema 下的表。
	 *
	 * @param connection MySQL 连接配置。
	 * @param schemaName 需要加载表的 schema。
	 * @returns 该 schema 下可见的表。
	 */
	public async listTables(
		connection: MysqlConnectionConfig,
		schemaName: string
	): Promise<readonly MySqlTableMetadata[]> {
		const mysql = await this.mySqlRuntimeLoader.loadMySqlPromiseModule();
		const runtimeConnection = await mysql.createConnection(
			this.mySqlConnectionAdapter.resolveDriverOptions(connection)
		);

		try {
			const [rows] = await runtimeConnection.query(
				[
					'SELECT TABLE_NAME AS tableName',
					'FROM information_schema.tables',
					'WHERE TABLE_SCHEMA = ?',
					"AND TABLE_TYPE = 'BASE TABLE'",
					'ORDER BY TABLE_NAME',
				].join(' '),
				[schemaName]
			);

			return this.normalizeTableRows(rows, schemaName);
		} finally {
			await runtimeConnection.end();
		}
	}

	/**
	 * 将 `SHOW DATABASES` 行归一化为 schema 元数据。
	 *
	 * @param rows mysql2 返回的原始行值。
	 * @returns 归一化后的 schema 元数据。
	 */
	private normalizeDatabaseRows(
		rows: unknown
	): readonly MySqlSchemaMetadata[] {
		if (!Array.isArray(rows)) {
			return [];
		}

		return rows
			.map((row) => {
				if (!row || typeof row !== 'object') {
					return undefined;
				}

				const databaseName = Reflect.get(row, 'Database');
				return typeof databaseName === 'string'
					? { name: databaseName }
					: undefined;
			})
			.filter((schema): schema is MySqlSchemaMetadata => schema !== undefined);
	}

	/**
	 * 将 information_schema 行归一化为表元数据。
	 *
	 * @param rows mysql2 返回的原始行值。
	 * @param schemaName 这些表所属的 schema。
	 * @returns 归一化后的表元数据。
	 */
	private normalizeTableRows(
		rows: unknown,
		schemaName: string
	): readonly MySqlTableMetadata[] {
		if (!Array.isArray(rows)) {
			return [];
		}

		return rows
			.map((row) => {
				if (!row || typeof row !== 'object') {
					return undefined;
				}

				const tableName =
					Reflect.get(row, 'tableName') ??
					Reflect.get(row, 'TABLE_NAME') ??
					Reflect.get(row, 'table_name');
				return typeof tableName === 'string'
					? { schemaName, name: tableName }
					: undefined;
			})
			.filter((table): table is MySqlTableMetadata => table !== undefined);
	}
}
