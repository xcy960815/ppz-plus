import type {
	Sqlite3TableCellValue,
	Sqlite3TableColumnMetadata,
	Sqlite3TableDataProvider as ApplicationSqlite3TableDataProvider,
	Sqlite3TableDeleteResult,
	Sqlite3TableFilterCondition,
	Sqlite3TableInsertResult,
	Sqlite3TableInsertValues,
	Sqlite3TableQueryOptions,
	Sqlite3TableRowIdentityValues,
	Sqlite3TableRowPage,
	Sqlite3TableUpdateResult,
	Sqlite3TableUpdateValues,
} from '../../application/sqlite3/Sqlite3TableDataProvider';
import type { Sqlite3ConnectionConfig } from '../../domain/connections/ConnectionConfig';
import { stringifyObjectValue } from '../shared/stringifyObjectValue';
import { Sqlite3ConnectionAdapter } from './Sqlite3ConnectionAdapter';
import { Sqlite3RuntimeLoader } from './Sqlite3RuntimeLoader';
import type {
	Sqlite3QueryRows,
	Sqlite3RunContext,
	Sqlite3RuntimeDatabase,
} from './Sqlite3RuntimeTypes';

/**
 * 描述待执行 SQL、绑定参数和展示 SQL。
 */
interface Sqlite3PreparedQuery {
	readonly sql: string;
	readonly values: readonly unknown[];
	readonly displaySql: string;
	readonly displaySqlWithoutPagination?: string;
}

/**
 * 通过 @vscode/sqlite3 读取和写入 SQLite3 表数据。
 */
export class Sqlite3TableDataProvider
	implements ApplicationSqlite3TableDataProvider
{
	/**
	 * 创建 SQLite3 表数据提供者。
	 *
	 * @param sqlite3ConnectionAdapter 用于归一化数据库文件路径的适配器。
	 * @param sqlite3RuntimeLoader 用于延迟解析 SQLite3 运行时的加载器。
	 */
	public constructor(
		private readonly sqlite3ConnectionAdapter: Sqlite3ConnectionAdapter,
		private readonly sqlite3RuntimeLoader: Sqlite3RuntimeLoader
	) {}

	/**
	 * 列出指定 SQLite3 表的字段。
	 *
	 * @param connection SQLite3 连接配置。
	 * @param tableName 需要加载字段的表。
	 * @returns 归一化后的字段元数据。
	 */
	public async listColumns(
		connection: Sqlite3ConnectionConfig,
		tableName: string
	): Promise<readonly Sqlite3TableColumnMetadata[]> {
		const database = await this.openDatabase(connection);

		try {
			return await this.listColumnsWithDatabase(database, tableName);
		} finally {
			await this.closeDatabase(database);
		}
	}

	/**
	 * 列出指定 SQLite3 表的一页行数据。
	 *
	 * @param connection SQLite3 连接配置。
	 * @param tableName 需要加载行数据的表。
	 * @param pageIndex 从 0 开始的页码。
	 * @param pageSize 每页请求的行数。
	 * @param options 排序和过滤等查询选项。
	 * @returns 分页行数据。
	 */
	public async listRowPage(
		connection: Sqlite3ConnectionConfig,
		tableName: string,
		pageIndex: number,
		pageSize: number,
		options?: Sqlite3TableQueryOptions
	): Promise<Sqlite3TableRowPage> {
		const database = await this.openDatabase(connection);

		try {
			const columns = await this.listColumnsWithDatabase(database, tableName);
			const normalizedPageIndex = Math.max(pageIndex, 0);
			const rowPageQuery = this.createRowPageQuery(
				tableName,
				columns,
				normalizedPageIndex,
				pageSize,
				options
			);
			const rowCountQuery = this.createRowCountQuery(
				tableName,
				columns,
				options
			);
			const [rows, countRows] = await Promise.all([
				this.all(database, rowPageQuery.sql, rowPageQuery.values),
				this.all(database, rowCountQuery.sql, rowCountQuery.values),
			]);
			const totalRowCount = this.readTotalRowCount(countRows);

			return {
				pageIndex: normalizedPageIndex,
				pageSize,
				totalRowCount,
				hasNextPage: (normalizedPageIndex + 1) * pageSize < totalRowCount,
				sql: rowPageQuery.displaySql,
				sqlWithoutPagination:
					rowPageQuery.displaySqlWithoutPagination ?? rowPageQuery.displaySql,
				rows: rows.map((row) => this.normalizeRow(row)),
			};
		} finally {
			await this.closeDatabase(database);
		}
	}

	/**
	 * 向指定 SQLite3 表新增一条记录。
	 *
	 * @param connection SQLite3 连接配置。
	 * @param tableName 需要新增记录的表。
	 * @param values 需要显式写入的字段值。
	 * @returns 单行新增结果。
	 */
	public async insertRow(
		connection: Sqlite3ConnectionConfig,
		tableName: string,
		values: Sqlite3TableInsertValues
	): Promise<Sqlite3TableInsertResult> {
		const database = await this.openDatabase(connection);

		try {
			const insertQuery = this.createInsertRowQuery(tableName, values);
			const result = await this.run(
				database,
				insertQuery.sql,
				insertQuery.values
			);

			return {
				affectedRows: result.changes ?? 0,
				insertId: result.lastID ?? null,
				sql: insertQuery.displaySql,
			};
		} finally {
			await this.closeDatabase(database);
		}
	}

	/**
	 * 更新指定 SQLite3 表中的一条记录。
	 *
	 * @param connection SQLite3 连接配置。
	 * @param tableName 需要更新记录的表。
	 * @param identityValues 用于定位原行的字段值。
	 * @param values 需要更新的新字段值。
	 * @returns 单行更新结果。
	 */
	public async updateRow(
		connection: Sqlite3ConnectionConfig,
		tableName: string,
		identityValues: Sqlite3TableRowIdentityValues,
		values: Sqlite3TableUpdateValues
	): Promise<Sqlite3TableUpdateResult> {
		const database = await this.openDatabase(connection);

		try {
			const updateQuery = this.createUpdateRowQuery(
				tableName,
				identityValues,
				values
			);
			const result = await this.run(
				database,
				updateQuery.sql,
				updateQuery.values
			);

			return {
				affectedRows: result.changes ?? 0,
				sql: updateQuery.displaySql,
			};
		} finally {
			await this.closeDatabase(database);
		}
	}

	/**
	 * 删除指定 SQLite3 表中的一条记录。
	 *
	 * @param connection SQLite3 连接配置。
	 * @param tableName 需要删除记录的表。
	 * @param identityValues 用于定位原行的字段值。
	 * @returns 单行删除结果。
	 */
	public async deleteRow(
		connection: Sqlite3ConnectionConfig,
		tableName: string,
		identityValues: Sqlite3TableRowIdentityValues
	): Promise<Sqlite3TableDeleteResult> {
		const database = await this.openDatabase(connection);

		try {
			const deleteQuery = this.createDeleteRowQuery(tableName, identityValues);
			const result = await this.run(
				database,
				deleteQuery.sql,
				deleteQuery.values
			);

			return {
				affectedRows: result.changes ?? 0,
				sql: deleteQuery.displaySql,
			};
		} finally {
			await this.closeDatabase(database);
		}
	}

	/**
	 * 复用已有 SQLite3 连接列出字段。
	 *
	 * @param database 当前可用的 SQLite3 连接。
	 * @param tableName 需要加载字段的表。
	 * @returns 归一化后的字段元数据。
	 */
	private async listColumnsWithDatabase(
		database: Sqlite3RuntimeDatabase,
		tableName: string
	): Promise<readonly Sqlite3TableColumnMetadata[]> {
		const rows = await this.all(
			database,
			`PRAGMA table_info(${this.quoteIdentifier(tableName)})`,
			[]
		);

		return rows
			.map((row): Sqlite3TableColumnMetadata | undefined => {
				const name = row.name;
				const type = row.type;
				const notNull = row.notnull;
				const primaryKeyOrder = row.pk;
				const defaultValue = row.dflt_value;

				if (typeof name !== 'string') {
					return undefined;
				}

				return {
					name,
					dataType:
						typeof type === 'string' && type.trim().length > 0
							? type
							: 'TEXT',
					dateTimePrecision: null as number | null,
					nullable: Number(notNull) !== 1,
					isPrimaryKey: Number(primaryKeyOrder) > 0,
					extra:
						defaultValue === null || defaultValue === undefined
							? ''
							: `DEFAULT ${String(defaultValue)}`,
				};
			})
			.filter(
				(
					column
				): column is Sqlite3TableColumnMetadata => column !== undefined
			);
	}

	/**
	 * 创建分页行查询。
	 *
	 * @param tableName 需要查询的表。
	 * @param columns 表字段元数据。
	 * @param pageIndex 从 0 开始的页码。
	 * @param pageSize 每页请求的行数。
	 * @param options 排序和过滤选项。
	 * @returns 可执行查询和展示 SQL。
	 */
	private createRowPageQuery(
		tableName: string,
		columns: readonly Sqlite3TableColumnMetadata[],
		pageIndex: number,
		pageSize: number,
		options?: Sqlite3TableQueryOptions
	): Sqlite3PreparedQuery {
		const whereClause = this.createWhereClause(columns, options);
		const orderByClause = this.createOrderByClause(columns, options);
		const offset = pageIndex * pageSize;
		const sqlWithoutPagination = [
			'SELECT *',
			`FROM ${this.quoteIdentifier(tableName)}`,
			whereClause.sql,
			orderByClause,
		]
			.filter((segment) => segment.length > 0)
			.join(' ');
		const sql = `${sqlWithoutPagination} LIMIT ? OFFSET ?`;
		const values = [...whereClause.values, pageSize, offset];

		return {
			sql,
			values,
			displaySql: this.createDisplaySql(sql, values),
			displaySqlWithoutPagination: this.createDisplaySql(
				sqlWithoutPagination,
				whereClause.values
			),
		};
	}

	/**
	 * 创建总行数查询。
	 *
	 * @param tableName 需要查询的表。
	 * @param columns 表字段元数据。
	 * @param options 排序和过滤选项。
	 * @returns 可执行查询和展示 SQL。
	 */
	private createRowCountQuery(
		tableName: string,
		columns: readonly Sqlite3TableColumnMetadata[],
		options?: Sqlite3TableQueryOptions
	): Sqlite3PreparedQuery {
		const whereClause = this.createWhereClause(columns, options);
		const sql = [
			'SELECT COUNT(*) AS totalRowCount',
			`FROM ${this.quoteIdentifier(tableName)}`,
			whereClause.sql,
		]
			.filter((segment) => segment.length > 0)
			.join(' ');

		return {
			sql,
			values: whereClause.values,
			displaySql: this.createDisplaySql(sql, whereClause.values),
		};
	}

	/**
	 * 创建过滤条件片段。
	 *
	 * @param columns 表字段元数据。
	 * @param options 查询选项。
	 * @returns WHERE SQL 片段和绑定参数。
	 */
	private createWhereClause(
		columns: readonly Sqlite3TableColumnMetadata[],
		options?: Sqlite3TableQueryOptions
	): { readonly sql: string; readonly values: readonly unknown[] } {
		const clauses: string[] = [];
		const values: unknown[] = [];
		const keyword = options?.filter?.keyword?.trim();

		if (keyword && columns.length > 0) {
			clauses.push(
				`(${columns
					.map(
						(column) =>
							`CAST(${this.quoteIdentifier(column.name)} AS TEXT) LIKE ?`
					)
					.join(' OR ')})`
			);
			values.push(...columns.map(() => `%${keyword}%`));
		}

		for (const condition of options?.filter?.conditions ?? []) {
			const clause = this.createConditionClause(condition);
			if (clause) {
				clauses.push(clause.sql);
				values.push(...clause.values);
			}
		}

		return {
			sql: clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '',
			values,
		};
	}

	/**
	 * 创建单个字段过滤条件。
	 *
	 * @param condition 表字段过滤条件。
	 * @returns SQL 片段和绑定参数；无效时为空。
	 */
	private createConditionClause(
		condition: Sqlite3TableFilterCondition
	): { readonly sql: string; readonly values: readonly unknown[] } | undefined {
		const column = this.quoteIdentifier(condition.columnName);

		if (condition.operator === 'null') {
			return { sql: `${column} IS NULL`, values: [] };
		}

		if (condition.operator === 'not null') {
			return { sql: `${column} IS NOT NULL`, values: [] };
		}

		if (condition.operator === 'in' || condition.operator === 'not in') {
			const values = Array.isArray(condition.value) ? condition.value : [];
			if (values.length === 0) {
				return undefined;
			}

			return {
				sql: `${column} ${condition.operator.toUpperCase()} (${values
					.map(() => '?')
					.join(', ')})`,
				values,
			};
		}

		if (typeof condition.value !== 'string') {
			return undefined;
		}

		return {
			sql: `${column} ${condition.operator.toUpperCase()} ?`,
			values: [condition.operator === 'like' ? `%${condition.value}%` : condition.value],
		};
	}

	/**
	 * 创建排序片段。
	 *
	 * @param columns 表字段元数据。
	 * @param options 查询选项。
	 * @returns ORDER BY SQL 片段。
	 */
	private createOrderByClause(
		columns: readonly Sqlite3TableColumnMetadata[],
		options?: Sqlite3TableQueryOptions
	): string {
		const sort = options?.sort;

		if (!sort) {
			return '';
		}

		const columnNames = new Set(columns.map((column) => column.name));

		if (!columnNames.has(sort.columnName)) {
			return '';
		}

		return `ORDER BY ${this.quoteIdentifier(sort.columnName)} ${
			sort.direction === 'desc' ? 'DESC' : 'ASC'
		}`;
	}

	/**
	 * 创建新增单行记录 SQL。
	 *
	 * @param tableName 需要新增记录的表。
	 * @param values 需要写入的字段值。
	 * @returns 可执行查询和展示 SQL。
	 */
	private createInsertRowQuery(
		tableName: string,
		values: Sqlite3TableInsertValues
	): Sqlite3PreparedQuery {
		const entries = Object.entries(values);

		if (entries.length === 0) {
			const sql = `INSERT INTO ${this.quoteIdentifier(tableName)} DEFAULT VALUES`;
			return { sql, values: [], displaySql: sql };
		}

		const columnNames = entries.map(([columnName]) =>
			this.quoteIdentifier(columnName)
		);
		const boundValues = entries.map(([, value]) => value);
		const sql = `INSERT INTO ${this.quoteIdentifier(
			tableName
		)} (${columnNames.join(', ')}) VALUES (${entries.map(() => '?').join(', ')})`;

		return {
			sql,
			values: boundValues,
			displaySql: this.createDisplaySql(sql, boundValues),
		};
	}

	/**
	 * 创建更新单行记录 SQL。
	 *
	 * @param tableName 需要更新记录的表。
	 * @param identityValues 用于定位原行的字段值。
	 * @param values 需要更新的新字段值。
	 * @returns 可执行查询和展示 SQL。
	 */
	private createUpdateRowQuery(
		tableName: string,
		identityValues: Sqlite3TableRowIdentityValues,
		values: Sqlite3TableUpdateValues
	): Sqlite3PreparedQuery {
		const updateEntries = Object.entries(values);

		if (updateEntries.length === 0) {
			throw new Error('没有需要更新的 SQLite3 字段。');
		}

		const whereClause = this.createIdentityWhereClause(identityValues);
		const sql = [
			`UPDATE ${this.quoteIdentifier(tableName)}`,
			`SET ${updateEntries
				.map(([columnName]) => `${this.quoteIdentifier(columnName)} = ?`)
				.join(', ')}`,
			whereClause.sql,
		].join(' ');
		const boundValues = [
			...updateEntries.map(([, value]) => value),
			...whereClause.values,
		];

		return {
			sql,
			values: boundValues,
			displaySql: this.createDisplaySql(sql, boundValues),
		};
	}

	/**
	 * 创建删除单行记录 SQL。
	 *
	 * @param tableName 需要删除记录的表。
	 * @param identityValues 用于定位原行的字段值。
	 * @returns 可执行查询和展示 SQL。
	 */
	private createDeleteRowQuery(
		tableName: string,
		identityValues: Sqlite3TableRowIdentityValues
	): Sqlite3PreparedQuery {
		const whereClause = this.createIdentityWhereClause(identityValues);
		const sql = `DELETE FROM ${this.quoteIdentifier(tableName)} ${whereClause.sql}`;

		return {
			sql,
			values: whereClause.values,
			displaySql: this.createDisplaySql(sql, whereClause.values),
		};
	}

	/**
	 * 创建主键定位条件。
	 *
	 * @param identityValues 用于定位原行的字段值。
	 * @returns WHERE SQL 片段和绑定参数。
	 */
	private createIdentityWhereClause(
		identityValues: Sqlite3TableRowIdentityValues
	): { readonly sql: string; readonly values: readonly unknown[] } {
		const entries = Object.entries(identityValues);

		if (entries.length === 0) {
			throw new Error('SQLite3 表记录写操作需要可用主键。');
		}

		const values: unknown[] = [];
		const clauses = entries.map(([columnName, value]) => {
			if (value === null) {
				return `${this.quoteIdentifier(columnName)} IS NULL`;
			}

			values.push(value);
			return `${this.quoteIdentifier(columnName)} = ?`;
		});

		return {
			sql: `WHERE ${clauses.join(' AND ')}`,
			values,
		};
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

	/**
	 * 读取 COUNT(*) 查询结果。
	 *
	 * @param rows SQLite3 返回的原始行。
	 * @returns 总行数。
	 */
	private readTotalRowCount(rows: Sqlite3QueryRows): number {
		const value = rows[0]?.totalRowCount;
		return typeof value === 'number' ? value : Number(value ?? 0);
	}

	/**
	 * 将 SQLite3 行归一化为可渲染对象。
	 *
	 * @param row SQLite3 返回的原始行。
	 * @returns 可序列化的表行。
	 */
	private normalizeRow(
		row: Record<string, unknown>
	): Record<string, Sqlite3TableCellValue> {
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
	private normalizeCellValue(value: unknown): Sqlite3TableCellValue {
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
	 * 转义 SQLite3 标识符。
	 *
	 * @param identifier 原始标识符。
	 * @returns 可安全拼接进 SQL 的标识符。
	 */
	private quoteIdentifier(identifier: string): string {
		return `"${identifier.replaceAll('"', '""')}"`;
	}

	/**
	 * 创建带参数值的展示 SQL。
	 *
	 * @param sql 参数化 SQL。
	 * @param values 绑定参数。
	 * @returns 仅用于展示的 SQL。
	 */
	private createDisplaySql(sql: string, values: readonly unknown[]): string {
		let valueIndex = 0;
		return sql.replaceAll('?', () =>
			this.formatLiteralForDisplay(values[valueIndex++])
		);
	}

	/**
	 * 格式化展示 SQL 中的字面量。
	 *
	 * @param value 原始绑定值。
	 * @returns SQLite3 字面量文本。
	 */
	private formatLiteralForDisplay(value: unknown): string {
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

		return `'${String(value).replaceAll("'", "''")}'`;
	}
}
