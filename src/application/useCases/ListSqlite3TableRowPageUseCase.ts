import type { Sqlite3ConnectionConfig } from '../../domain/connections/ConnectionConfig';
import type {
	Sqlite3TableDataProvider,
	Sqlite3TableQueryOptions,
	Sqlite3TableRowPage,
} from '../sqlite3/Sqlite3TableDataProvider';

/**
 * 列出 SQLite3 表的一页行数据。
 */
export class ListSqlite3TableRowPageUseCase {
	/**
	 * 创建 SQLite3 表分页行数据列表用例。
	 *
	 * @param sqlite3TableDataProvider 用于读取 SQLite3 表行数据的提供者。
	 */
	public constructor(
		private readonly sqlite3TableDataProvider: Sqlite3TableDataProvider
	) {}

	/**
	 * 加载选中 SQLite3 表的一页行数据。
	 *
	 * @param connection SQLite3 连接配置。
	 * @param tableName 需要加载行数据的表。
	 * @param pageIndex 从 0 开始的页码。
	 * @param pageSize 每页请求的行数。
	 * @param options 排序和过滤等查询选项。
	 * @returns 分页行数据。
	 */
	public async execute(
		connection: Sqlite3ConnectionConfig,
		tableName: string,
		pageIndex: number,
		pageSize: number,
		options?: Sqlite3TableQueryOptions
	): Promise<Sqlite3TableRowPage> {
		return this.sqlite3TableDataProvider.listRowPage(
			connection,
			tableName,
			pageIndex,
			pageSize,
			options
		);
	}
}
