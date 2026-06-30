import type { PostgreSqlConnectionConfig } from '../../domain/connections/ConnectionConfig';
import type { SqlExecutionResult } from '../../domain/query/SqlExecutionResult';
import type { PostgreSqlSqlExecutor } from '../postgresql/PostgreSqlSqlExecutor';

/**
 * 执行 PostgreSQL SQL 文本的应用用例。
 */
export class ExecutePostgreSqlSqlUseCase {
	/**
	 * 创建 PostgreSQL SQL 执行用例。
	 *
	 * @param postgreSqlSqlExecutor 用于实际执行 SQL 的 PostgreSQL 能力提供者。
	 */
	public constructor(
		private readonly postgreSqlSqlExecutor: PostgreSqlSqlExecutor
	) {}

	/**
	 * 执行用户提交的 PostgreSQL SQL。
	 *
	 * @param {PostgreSqlConnectionConfig} connection PostgreSQL 连接配置。
	 * @param {string | undefined} databaseName 本次执行要连接的 database。
	 * @param {string} sql 用户输入的 SQL 文本。
	 * @returns {Promise<SqlExecutionResult>} 统一 SQL 执行结果。
	 */
	public async execute(
		connection: PostgreSqlConnectionConfig,
		databaseName: string | undefined,
		sql: string
	): Promise<SqlExecutionResult> {
		const normalizedSql = sql.trim();
		const normalizedDatabaseName =
			databaseName && databaseName.trim().length > 0
				? databaseName.trim()
				: undefined;

		if (normalizedSql.length === 0) {
			return {
				sql,
				success: false,
				isQuery: false,
				fields: [],
				rows: [],
				affectedRows: null,
				durationMs: 0,
				resultSets: [],
				errorMessage: 'SQL 不能为空。',
			};
		}

		return this.postgreSqlSqlExecutor.executeSql(
			connection,
			normalizedDatabaseName,
			normalizedSql
		);
	}
}
