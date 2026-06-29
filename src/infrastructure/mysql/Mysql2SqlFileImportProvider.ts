import type { MySqlSqlFileImportProvider } from '../../application/mysql/MySqlSqlFileImportProvider';
import type { MysqlConnectionConfig } from '../../domain/connections/ConnectionConfig';
import type { SqlFileImportResult } from '../../domain/import/SqlFileImportResult';
import { MySqlConnectionAdapter } from './MySqlConnectionAdapter';
import { MySqlRuntimeLoader } from './MySqlRuntimeLoader';

/**
 * 通过 mysql2 promise 驱动执行 MySQL SQL 文件导入。
 */
export class Mysql2SqlFileImportProvider
	implements MySqlSqlFileImportProvider
{
	/**
	 * 创建基于 mysql2 的 SQL 文件导入提供者。
	 *
	 * @param mySqlConnectionAdapter 用于归一化连接选项的适配器。
	 * @param mySqlRuntimeLoader 用于延迟解析 mysql2 运行时的加载器。
	 */
	public constructor(
		private readonly mySqlConnectionAdapter: MySqlConnectionAdapter,
		private readonly mySqlRuntimeLoader: MySqlRuntimeLoader
	) {}

	/**
	 * 执行 SQL 文件内容。
	 *
	 * @param connection MySQL 连接配置。
	 * @param sql SQL 文件内容。
	 * @returns SQL 文件导入结果。
	 */
	public async importSql(
		connection: MysqlConnectionConfig,
		sql: string
	): Promise<SqlFileImportResult> {
		const startedAt = Date.now();
		const normalizedSql = this.normalizeMySqlDumpText(sql);
		let runtimeConnection:
			| {
					query(sql: string, values?: readonly unknown[]): Promise<[unknown, unknown]>;
					end(): Promise<void>;
			  }
			| undefined;

		try {
			const mysql = await this.mySqlRuntimeLoader.loadMySqlPromiseModule();
			runtimeConnection = await mysql.createConnection(
				this.resolveImportDriverOptions(connection)
			);
			await runtimeConnection.query(normalizedSql);

			return {
				success: true,
				durationMs: Date.now() - startedAt,
			};
		} catch (error) {
			return {
				success: false,
				durationMs: Date.now() - startedAt,
				errorMessage: error instanceof Error ? error.message : String(error),
			};
		} finally {
			if (runtimeConnection) {
				try {
					await runtimeConnection.end();
				} catch {
					/**
					 * 导入结果优先，关闭连接失败不覆盖主要结果。
					 */
				}
			}
		}
	}

	/**
	 * 归一化 MySQL dump 文本，移除 mysql 客户端专属指令。
	 *
	 * @param sql SQL 文件原始文本。
	 * @returns 可交给 mysql2 执行的 SQL 文本。
	 */
	private normalizeMySqlDumpText(sql: string): string {
		const normalizedLines: string[] = [];
		let delimiter = ';';

		for (const rawLine of sql.replaceAll('\r\n', '\n').split('\n')) {
			const delimiterDirective = this.parseDelimiterDirective(rawLine);
			if (delimiterDirective !== undefined) {
				delimiter = delimiterDirective;
				continue;
			}

			normalizedLines.push(
				delimiter === ';'
					? rawLine
					: this.replaceCustomDelimiterAtLineEnd(rawLine, delimiter)
			);
		}

		return normalizedLines.join('\n');
	}

	/**
	 * 解析 MySQL dump 中的 DELIMITER 指令。
	 *
	 * @param line SQL 文件中的单行文本。
	 * @returns 指令指定的新分隔符；不是 DELIMITER 指令时为空。
	 */
	private parseDelimiterDirective(line: string): string | undefined {
		const match = /^delimiter\s+(.+)$/i.exec(line.trim());
		const delimiter = match?.[1]?.trim();

		return delimiter && delimiter.length > 0 ? delimiter : undefined;
	}

	/**
	 * 将自定义语句分隔符替换回标准分号。
	 *
	 * @param line SQL 文件中的单行文本。
	 * @param delimiter 当前 MySQL dump 自定义分隔符。
	 * @returns 替换后的 SQL 行文本。
	 */
	private replaceCustomDelimiterAtLineEnd(
		line: string,
		delimiter: string
	): string {
		const lineWithoutTrailingWhitespace = line.replace(/[ \t]+$/u, '');

		if (!lineWithoutTrailingWhitespace.endsWith(delimiter)) {
			return line;
		}

		return `${lineWithoutTrailingWhitespace.slice(0, -delimiter.length)};`;
	}

	/**
	 * 为 SQL 文件导入开启 mysql2 多语句执行选项。
	 *
	 * @param connection MySQL 连接配置。
	 * @returns mysql2 可接收的导入连接选项。
	 */
	private resolveImportDriverOptions(connection: MysqlConnectionConfig): unknown {
		const driverOptions =
			this.mySqlConnectionAdapter.resolveDriverOptions(connection);

		if (typeof driverOptions === 'string') {
			return this.appendMultipleStatementsOption(driverOptions);
		}

		return {
			...driverOptions,
			multipleStatements: true,
		};
	}

	/**
	 * 为 MySQL URL 连接追加多语句执行选项。
	 *
	 * @param connectionUrl 用户保存的 MySQL 连接 URL。
	 * @returns 带有 multipleStatements 参数的连接 URL。
	 */
	private appendMultipleStatementsOption(connectionUrl: string): string {
		if (/[?&]multipleStatements=/.test(connectionUrl)) {
			return connectionUrl;
		}

		return `${connectionUrl}${
			connectionUrl.includes('?') ? '&' : '?'
		}multipleStatements=true`;
	}
}
