import type { Sqlite3ExportProvider as ApplicationSqlite3ExportProvider } from '../../application/sqlite3/Sqlite3ExportProvider';
import type { Sqlite3ConnectionConfig } from '../../domain/connections/ConnectionConfig';
import type {
	SqlExportDocument,
	SqlExportKind,
	SqlExportTableTarget,
} from '../../domain/export/SqlExportDocument';
import { stringifyObjectValue } from '../shared/stringifyObjectValue';
import { Sqlite3ConnectionAdapter } from './Sqlite3ConnectionAdapter';
import { Sqlite3RuntimeLoader } from './Sqlite3RuntimeLoader';
import type {
	Sqlite3QueryRows,
	Sqlite3RuntimeDatabase,
} from './Sqlite3RuntimeTypes';

/**
 * 通过 @vscode/sqlite3 生成 SQLite3 表级 SQL 导出文档。
 */
export class Sqlite3ExportProvider implements ApplicationSqlite3ExportProvider {
	/**
	 * 创建 SQLite3 导出提供者。
	 *
	 * @param sqlite3ConnectionAdapter 用于归一化数据库文件路径的适配器。
	 * @param sqlite3RuntimeLoader 用于延迟解析 SQLite3 运行时的加载器。
	 */
	public constructor(
		private readonly sqlite3ConnectionAdapter: Sqlite3ConnectionAdapter,
		private readonly sqlite3RuntimeLoader: Sqlite3RuntimeLoader
	) {}

	/**
	 * 导出指定 SQLite3 表的 SQL 文档。
	 *
	 * @param connection SQLite3 连接配置。
	 * @param target 表级导出目标。
	 * @param kind 导出的 SQL 内容类型。
	 * @returns 生成后的 SQL 导出文档。
	 */
	public async exportTable(
		connection: Sqlite3ConnectionConfig,
		target: SqlExportTableTarget,
		kind: SqlExportKind
	): Promise<SqlExportDocument> {
		const database = await this.openDatabase(connection);

		try {
			const sections: string[] = [];

			if (kind === 'ddl' || kind === 'both') {
				sections.push(await this.exportDdl(database, target.tableName));
			}

			if (kind === 'dml' || kind === 'both') {
				sections.push(await this.exportDml(database, target.tableName));
			}

			return {
				title: `${target.tableName}.${kind}.sql`,
				format: 'sql',
				kind,
				target,
				content: sections.filter((section) => section.length > 0).join('\n\n'),
			};
		} finally {
			await this.closeDatabase(database);
		}
	}

	/**
	 * 从 sqlite_master 中导出建表 SQL。
	 *
	 * @param database 已打开的数据库实例。
	 * @param tableName 需要导出的表。
	 * @returns DDL SQL 文本。
	 */
	private async exportDdl(
		database: Sqlite3RuntimeDatabase,
		tableName: string
	): Promise<string> {
		const rows = await this.all(
			database,
			[
				'SELECT sql',
				'FROM sqlite_master',
				"WHERE type IN ('table', 'view')",
				'AND name = ?',
			].join(' '),
			[tableName]
		);
		const createSql = rows[0]?.sql;

		if (typeof createSql !== 'string' || createSql.trim().length === 0) {
			throw new Error(`未找到 SQLite3 表 ${tableName} 的 DDL。`);
		}

		return `${createSql.trim()};`;
	}

	/**
	 * 导出表数据 INSERT 语句。
	 *
	 * @param database 已打开的数据库实例。
	 * @param tableName 需要导出的表。
	 * @returns DML SQL 文本。
	 */
	private async exportDml(
		database: Sqlite3RuntimeDatabase,
		tableName: string
	): Promise<string> {
		const rows = await this.all(
			database,
			`SELECT * FROM ${this.quoteIdentifier(tableName)}`,
			[]
		);

		if (rows.length === 0) {
			return `-- ${tableName} 没有可导出的数据。`;
		}

		const columnNames = Object.keys(rows[0]);
		const quotedColumns = columnNames
			.map((columnName) => this.quoteIdentifier(columnName))
			.join(', ');

		return rows
			.map((row) => {
				const values = columnNames
					.map((columnName) => this.formatLiteral(row[columnName]))
					.join(', ');
				return `INSERT INTO ${this.quoteIdentifier(
					tableName
				)} (${quotedColumns}) VALUES (${values});`;
			})
			.join('\n');
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

	/**
	 * 转义 SQLite3 标识符。
	 *
	 * @param identifier 原始标识符。
	 * @returns 可安全拼接进 SQL 的标识符。
	 */
	private quoteIdentifier(identifier: string): string {
		return `"${identifier.replaceAll('"', '""')}"`;
	}

	/**
	 * 格式化 SQLite3 INSERT 字面量。
	 *
	 * @param value 原始单元格值。
	 * @returns SQL 字面量。
	 */
	private formatLiteral(value: unknown): string {
		if (value === null || value === undefined) {
			return 'NULL';
		}

		if (typeof value === 'number') {
			return Number.isFinite(value) ? String(value) : 'NULL';
		}

		if (typeof value === 'boolean') {
			return value ? '1' : '0';
		}

		if (Buffer.isBuffer(value)) {
			return `X'${value.toString('hex')}'`;
		}

		if (typeof value === 'object') {
			return `'${stringifyObjectValue(value).replaceAll("'", "''")}'`;
		}

		return `'${String(value).replaceAll("'", "''")}'`;
	}
}
