import type { PostgreSqlConnectionConfig } from '../../domain/connections/ConnectionConfig';
import type { SqlExecutionResult } from '../../domain/query/SqlExecutionResult';

/**
 * 向应用层提供 PostgreSQL SQL 执行能力。
 */
export interface PostgreSqlSqlExecutor {
	/**
	 * 执行一段 PostgreSQL SQL 并返回归一化结果。
	 *
	 * @param connection PostgreSQL 连接配置。
	 * @param databaseName 本次执行要连接的 database。
	 * @param sql 用户输入的 SQL 文本。
	 * @returns 统一 SQL 执行结果。
	 */
	executeSql(
		connection: PostgreSqlConnectionConfig,
		databaseName: string | undefined,
		sql: string
	): Promise<SqlExecutionResult>;
}
