import type { Sqlite3ConnectionConfig } from '../../domain/connections/ConnectionConfig';
import type {
	Sqlite3MetadataProvider,
	Sqlite3TableMetadata,
} from '../sqlite3/Sqlite3MetadataProvider';

/**
 * 列出 SQLite3 数据库文件中的表和视图。
 */
export class ListSqlite3TablesUseCase {
	/**
	 * 创建 SQLite3 表列表用例。
	 *
	 * @param sqlite3MetadataProvider 用于读取 SQLite3 表元数据的提供者。
	 */
	public constructor(
		private readonly sqlite3MetadataProvider: Sqlite3MetadataProvider
	) {}

	/**
	 * 加载选中 SQLite3 连接下的表和视图。
	 *
	 * @param connection SQLite3 连接配置。
	 * @returns 当前文件中可见的表和视图。
	 */
	public async execute(
		connection: Sqlite3ConnectionConfig
	): Promise<readonly Sqlite3TableMetadata[]> {
		return this.sqlite3MetadataProvider.listTables(connection);
	}
}
