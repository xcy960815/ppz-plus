import type { PostgreSqlConnectionConfig } from '../../domain/connections/ConnectionConfig';
import type {
	TableQueryOptions,
	TableRowPage,
} from '../shared/TableDataTypes';
import type { PostgreSqlTableDataProvider } from '../postgresql/PostgreSqlTableDataProvider';

/**
 * 列出 PostgreSQL 表的一页行数据。
 */
export class ListPostgreSqlTableRowPageUseCase {
	/**
	 * 创建 PostgreSQL 表分页行数据列表用例。
	 *
	 * @param postgreSqlTableDataProvider 用于读取 PostgreSQL 表行数据的提供者。
	 */
	public constructor(
		private readonly postgreSqlTableDataProvider: PostgreSqlTableDataProvider
	) {}

	/**
	 * 加载选中 PostgreSQL 表的一页只读行数据。
	 *
	 * @param {PostgreSqlConnectionConfig} connection PostgreSQL 连接配置。
	 * @param {string} databaseName 表所属的 database。
	 * @param {string} schemaName 表所属的 schema。
	 * @param {string} tableName 需要加载行数据的表。
	 * @param {number} pageIndex 从 0 开始的页码。
	 * @param {number} pageSize 每页请求的行数。
	 * @param {TableQueryOptions} options 排序和过滤等查询选项。
	 * @returns {Promise<TableRowPage>} 分页行数据。
	 */
	public async execute(
		connection: PostgreSqlConnectionConfig,
		databaseName: string,
		schemaName: string,
		tableName: string,
		pageIndex: number,
		pageSize: number,
		options?: TableQueryOptions
	): Promise<TableRowPage> {
		return this.postgreSqlTableDataProvider.listRowPage(
			connection,
			databaseName,
			schemaName,
			tableName,
			pageIndex,
			pageSize,
			options
		);
	}
}
