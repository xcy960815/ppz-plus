import type { Sqlite3SqlExecutor as ApplicationSqlite3SqlExecutor } from '../../application/sqlite3/Sqlite3SqlExecutor';
import type { Sqlite3ConnectionConfig } from '../../domain/connections/ConnectionConfig';
import type {
	SqlExecutionCellValue,
	SqlExecutionField,
	SqlExecutionResult,
	SqlExecutionResultSet,
} from '../../domain/query/SqlExecutionResult';
import { stringifyObjectValue } from '../shared/stringifyObjectValue';
import { Sqlite3ConnectionAdapter } from './Sqlite3ConnectionAdapter';
import { Sqlite3RuntimeLoader } from './Sqlite3RuntimeLoader';
import type {
	Sqlite3QueryRows,
	Sqlite3RunContext,
	Sqlite3RuntimeDatabase,
} from './Sqlite3RuntimeTypes';

/**
 * 通过 @vscode/sqlite3 执行 SQLite3 SQL。
 */
export class Sqlite3SqlExecutor implements ApplicationSqlite3SqlExecutor {
	/**
	 * 创建 SQLite3 SQL 执行器。
	 *
	 * @param sqlite3ConnectionAdapter 用于归一化数据库文件路径的适配器。
	 * @param sqlite3RuntimeLoader 用于延迟解析 SQLite3 运行时的加载器。
	 */
	public constructor(
		private readonly sqlite3ConnectionAdapter: Sqlite3ConnectionAdapter,
		private readonly sqlite3RuntimeLoader: Sqlite3RuntimeLoader
	) {}

	/**
	 * 执行 SQLite3 SQL 并返回统一结果模型。
	 *
	 * @param connection SQLite3 连接配置。
	 * @param sql 用户输入的 SQL 文本。
	 * @returns 统一 SQL 执行结果。
	 */
	public async executeSql(
		connection: Sqlite3ConnectionConfig,
		sql: string
	): Promise<SqlExecutionResult> {
		const startedAt = Date.now();
		let database: Sqlite3RuntimeDatabase | undefined;

		try {
			database = await this.openDatabase(connection);
			const statements = this.splitSqlStatements(sql);
			const resultSets: SqlExecutionResultSet[] = [];

			for (const statement of statements) {
				resultSets.push(await this.executeStatement(database, statement));
			}

			const primaryResultSet =
				resultSets[0] ?? this.createEmptyStatementResultSet();

			return {
				sql,
				success: true,
				isQuery: primaryResultSet.isQuery,
				fields: primaryResultSet.fields,
				rows: primaryResultSet.rows,
				affectedRows: primaryResultSet.affectedRows,
				durationMs: Date.now() - startedAt,
				resultSets,
			};
		} catch (error) {
			return {
				sql,
				success: false,
				isQuery: this.inferQuerySql(sql),
				fields: [],
				rows: [],
				affectedRows: null,
				durationMs: Date.now() - startedAt,
				resultSets: [],
				errorMessage: error instanceof Error ? error.message : String(error),
			};
		} finally {
			if (database) {
				try {
					await this.closeDatabase(database);
				} catch {
					/** SQL 执行结果优先，关闭连接失败不覆盖主要结果。 */
				}
			}
		}
	}

	/**
	 * 执行单条 SQLite3 语句。
	 *
	 * @param database 已打开的数据库实例。
	 * @param sql 单条 SQL 语句。
	 * @returns 归一化后的结果集。
	 */
	private async executeStatement(
		database: Sqlite3RuntimeDatabase,
		sql: string
	): Promise<SqlExecutionResultSet> {
		if (this.inferQuerySql(sql)) {
			const rows = await this.all(database, sql, []);
			return {
				isQuery: true,
				fields: this.normalizeFields(rows),
				rows: rows.map((row) => this.normalizeRow(row)),
				affectedRows: null,
				metadata: [],
			};
		}

		const result = await this.run(database, sql, []);
		return {
			isQuery: false,
			fields: [],
			rows: [],
			affectedRows: result.changes ?? null,
			metadata: [
				{ key: 'changes', value: result.changes ?? null },
				{ key: 'lastInsertRowid', value: result.lastID ?? null },
			],
		};
	}

	/**
	 * 按分号拆分 SQL 文本，保留引号内的分号。
	 *
	 * @param sql 用户提交的 SQL 文本。
	 * @returns 单条 SQL 语句列表。
	 */
	private splitSqlStatements(sql: string): readonly string[] {
		const statements: string[] = [];
		let current = '';
		let quote: '"' | "'" | '`' | undefined;
		let inBracketIdentifier = false;

		for (let index = 0; index < sql.length; index += 1) {
			const character = sql[index];
			const next = sql[index + 1];
			current += character;

			if (inBracketIdentifier) {
				if (character === ']') {
					inBracketIdentifier = false;
				}
				continue;
			}

			if (quote) {
				if (character === quote) {
					if ((quote === '"' || quote === "'") && next === quote) {
						current += next;
						index += 1;
						continue;
					}

					quote = undefined;
				}
				continue;
			}

			if (character === '"' || character === "'" || character === '`') {
				quote = character;
				continue;
			}

			if (character === '[') {
				inBracketIdentifier = true;
				continue;
			}

			if (character === ';') {
				const statement = current.trim();
				if (statement.length > 1) {
					statements.push(statement);
				}
				current = '';
			}
		}

		const trailingStatement = current.trim();
		if (trailingStatement.length > 0) {
			statements.push(trailingStatement);
		}

		return statements;
	}

	/**
	 * 根据 SQL 文本推断是否为查询语句。
	 *
	 * @param sql SQL 文本。
	 * @returns 是否应按查询语句执行。
	 */
	private inferQuerySql(sql: string): boolean {
		return /^(select|with|pragma|explain)\b/i.test(sql.trim());
	}

	/**
	 * 创建空的非查询结果集兜底。
	 *
	 * @returns 空的非查询结果集。
	 */
	private createEmptyStatementResultSet(): SqlExecutionResultSet {
		return {
			isQuery: false,
			fields: [],
			rows: [],
			affectedRows: null,
			metadata: [],
		};
	}

	/**
	 * 从查询行集合中推断字段。
	 *
	 * @param rows SQLite3 返回的原始行集合。
	 * @returns 字段列表。
	 */
	private normalizeFields(rows: Sqlite3QueryRows): readonly SqlExecutionField[] {
		const firstRow = rows[0];
		return firstRow ? Object.keys(firstRow).map((name) => ({ name })) : [];
	}

	/**
	 * 将 SQLite3 行归一化为可渲染对象。
	 *
	 * @param row SQLite3 返回的原始行。
	 * @returns 可序列化的 SQL 行数据。
	 */
	private normalizeRow(
		row: Record<string, unknown>
	): Record<string, SqlExecutionCellValue> {
		return Object.fromEntries(
			Object.entries(row).map(([key, value]) => [
				key,
				this.normalizeCellValue(value),
			])
		);
	}

	/**
	 * 将 SQLite3 单元格值归一化为可序列化值。
	 *
	 * @param value SQLite3 返回的原始值。
	 * @returns 可渲染单元格值。
	 */
	private normalizeCellValue(value: unknown): SqlExecutionCellValue {
		if (value === null || value === undefined) {
			return null;
		}

		if (
			typeof value === 'string' ||
			typeof value === 'number' ||
			typeof value === 'boolean'
		) {
			return value;
		}

		if (Buffer.isBuffer(value)) {
			return value.toString('base64');
		}

		return stringifyObjectValue(value);
	}

	/**
	 * 打开 SQLite3 数据库文件。
	 *
	 * @param connection SQLite3 连接配置。
	 * @returns 已打开的数据库实例。
	 */
	private async openDatabase(
		connection: Sqlite3ConnectionConfig
	): Promise<Sqlite3RuntimeDatabase> {
		const sqlite3 = await this.sqlite3RuntimeLoader.loadSqlite3Module();
		const databasePath =
			this.sqlite3ConnectionAdapter.resolveDatabasePath(connection);
		return new Promise((resolve, reject) => {
			const database = new sqlite3.Database(
				databasePath,
				sqlite3.OPEN_READWRITE,
				(error) => {
					if (error) {
						reject(error);
						return;
					}

					resolve(database);
				}
			);
		});
	}

	/**
	 * 执行 SQLite3 多行查询。
	 *
	 * @param database 已打开的数据库实例。
	 * @param sql 需要执行的 SQL。
	 * @param params 绑定参数。
	 * @returns 原始查询行。
	 */
	private async all(
		database: Sqlite3RuntimeDatabase,
		sql: string,
		params: readonly unknown[]
	): Promise<Sqlite3QueryRows> {
		return new Promise((resolve, reject) => {
			database.all(sql, params, (error, rows) => {
				if (error) {
					reject(error);
					return;
				}

				resolve(
					rows.filter(
						(row): row is Record<string, unknown> =>
							row !== null &&
							typeof row === 'object' &&
							!Array.isArray(row)
					)
				);
			});
		});
	}

	/**
	 * 执行 SQLite3 写入语句。
	 *
	 * @param database 已打开的数据库实例。
	 * @param sql 需要执行的 SQL。
	 * @param params 绑定参数。
	 * @returns 语句执行上下文。
	 */
	private async run(
		database: Sqlite3RuntimeDatabase,
		sql: string,
		params: readonly unknown[]
	): Promise<Sqlite3RunContext> {
		return new Promise((resolve, reject) => {
			database.run(sql, params, function runCallback(error) {
				if (error) {
					reject(error);
					return;
				}

				resolve({
					lastID: this.lastID,
					changes: this.changes,
				});
			});
		});
	}

	/**
	 * 关闭 SQLite3 数据库实例。
	 *
	 * @param database 已打开的数据库实例。
	 */
	private async closeDatabase(database: Sqlite3RuntimeDatabase): Promise<void> {
		await new Promise<void>((resolve, reject) => {
			database.close((error) => {
				if (error) {
					reject(error);
					return;
				}

				resolve();
			});
		});
	}
}
