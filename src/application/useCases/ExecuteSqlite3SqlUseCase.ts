import type { Sqlite3ConnectionConfig } from '../../domain/connections/ConnectionConfig';
import type { SqlExecutionResult } from '../../domain/query/SqlExecutionResult';
import type { Sqlite3SqlExecutor } from '../sqlite3/Sqlite3SqlExecutor';

/**
 * 执行 SQLite3 SQL 文本的应用用例。
 */
export class ExecuteSqlite3SqlUseCase {
	/**
	 * 创建 SQLite3 SQL 执行用例。
	 *
	 * @param sqlite3SqlExecutor 用于实际执行 SQL 的 SQLite3 能力提供者。
	 */
	public constructor(private readonly sqlite3SqlExecutor: Sqlite3SqlExecutor) {}

	/**
	 * 执行用户提交的 SQLite3 SQL。
	 *
	 * @param connection SQLite3 连接配置。
	 * @param sql 用户输入的 SQL 文本。
	 * @returns 统一 SQL 执行结果。
	 */
	public async execute(
		connection: Sqlite3ConnectionConfig,
		sql: string
	): Promise<SqlExecutionResult> {
		const normalizedSql = sql.trim();

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

		return this.sqlite3SqlExecutor.executeSql(connection, normalizedSql);
	}
}
