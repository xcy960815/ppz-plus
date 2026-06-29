import type { MysqlConnectionConfig } from '../../domain/connections/ConnectionConfig';
import type { SqlExecutionResult } from '../../domain/query/SqlExecutionResult';
import type { MySqlSqlExecutor } from '../mysql/MySqlSqlExecutor';

/**
 * 执行 MySQL SQL 文本的应用用例。
 */
export class ExecuteMySqlSqlUseCase {
	/**
	 * 创建 MySQL SQL 执行用例。
	 *
	 * @param mySqlSqlExecutor 用于实际执行 SQL 的 MySQL 能力提供者。
	 */
	public constructor(private readonly mySqlSqlExecutor: MySqlSqlExecutor) {}

	/**
	 * 执行用户提交的 MySQL SQL。
	 *
	 * @param connection MySQL 连接配置。
	 * @param sql 用户输入的 SQL 文本。
	 * @returns 统一 SQL 执行结果。
	 */
	public async execute(
		connection: MysqlConnectionConfig,
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
				errorMessage: 'SQL 不能为空。',
			};
		}

		return this.mySqlSqlExecutor.executeSql(connection, normalizedSql);
	}
}
