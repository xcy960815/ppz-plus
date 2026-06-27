import type { MysqlConnectionConfig } from '../../domain/connections/ConnectionConfig';
import type { SqlExecutionResult } from '../../domain/query/SqlExecutionResult';

/**
 * 向应用层提供 MySQL SQL 执行能力。
 */
export interface MySqlSqlExecutor {
	/**
	 * 执行一段 MySQL SQL 并返回归一化结果。
	 *
	 * @param connection MySQL 连接配置。
	 * @param sql 用户输入的 SQL 文本。
	 * @returns 统一 SQL 执行结果。
	 */
	executeSql(
		connection: MysqlConnectionConfig,
		sql: string
	): Promise<SqlExecutionResult>;
}
