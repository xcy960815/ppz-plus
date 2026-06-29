import type { PostgreSqlConnectionConfig } from '../../domain/connections/ConnectionConfig';
import type {
	MySqlTableCellValue,
	MySqlTableColumnMetadata,
	MySqlTableFilterCondition,
	MySqlTableQueryOptions,
	MySqlTableRowPage,
} from '../../application/mysql/MySqlTableDataProvider';
import type { PostgreSqlTableDataProvider } from '../../application/postgresql/PostgreSqlTableDataProvider';
import { PostgreSqlConnectionAdapter } from './PostgreSqlConnectionAdapter';
import type { PostgreSqlRuntimeClient } from './PostgreSqlRuntimeLoader';
import { PostgreSqlRuntimeLoader } from './PostgreSqlRuntimeLoader';

/**
 * 描述 PostgreSQL SQL 片段及参数。
 */
interface PostgreSqlQueryFragment {
	readonly sql: string;
	readonly displaySql: string;
	readonly values: readonly unknown[];
}

/**
 * 通过 pg 驱动读取 PostgreSQL 表结构和只读分页数据。
 */
export class PgPostgreSqlTableDataProvider
	implements PostgreSqlTableDataProvider
{
	/**
	 * 创建基于 pg 的 PostgreSQL 表数据提供者。
	 *
	 * @param postgreSqlConnectionAdapter 用于归一化连接选项的适配器。
	 * @param postgreSqlRuntimeLoader 用于延迟解析 pg 运行时的加载器。
	 */
	public constructor(
		private readonly postgreSqlConnectionAdapter: PostgreSqlConnectionAdapter,
		private readonly postgreSqlRuntimeLoader: PostgreSqlRuntimeLoader
	) {}

	/**
	 * 列出选中 PostgreSQL 表的字段。
	 *
	 * @param connection PostgreSQL 连接配置。
	 * @param databaseName 表所属的 database。
	 * @param schemaName 表所属的 schema。
	 * @param tableName 需要加载字段的表。
	 * @returns 归一化后的字段元数据。
	 */
	public async listColumns(
		connection: PostgreSqlConnectionConfig,
		databaseName: string,
		schemaName: string,
		tableName: string
	): Promise<readonly MySqlTableColumnMetadata[]> {
		const client = await this.openClient(connection, databaseName);

		try {
			const [columnsResult, primaryKeysResult] = await Promise.all([
				client.query(
					[
						'SELECT column_name AS "columnName",',
						'udt_name AS "dataType",',
						'datetime_precision AS "dateTimePrecision",',
						'is_nullable AS "isNullable",',
						'column_default AS "columnDefault"',
						'FROM information_schema.columns',
						'WHERE table_schema = $1 AND table_name = $2',
						'ORDER BY ordinal_position',
					].join(' '),
					[schemaName, tableName]
				),
				client.query(
					[
						'SELECT a.attname AS "columnName"',
						'FROM pg_index i',
						'JOIN pg_attribute a ON a.attrelid = i.indrelid',
						'AND a.attnum = ANY(i.indkey)',
						'WHERE i.indrelid = $1::regclass',
						'AND i.indisprimary',
					].join(' '),
					[`${this.quoteIdentifier(schemaName)}.${this.quoteIdentifier(tableName)}`]
				),
			]);

			return this.normalizeColumnRows(
				columnsResult.rows,
				new Set(
					primaryKeysResult.rows
						.map((row) => row.columnName)
						.filter((value): value is string => typeof value === 'string')
				)
			);
		} finally {
			await client.end();
		}
	}

	/**
	 * 列出选中 PostgreSQL 表的一页只读行数据。
	 *
	 * @param connection PostgreSQL 连接配置。
	 * @param databaseName 表所属的 database。
	 * @param schemaName 表所属的 schema。
	 * @param tableName 需要加载行数据的表。
	 * @param pageIndex 从 0 开始的页码。
	 * @param pageSize 每页请求的行数。
	 * @param options 排序和过滤等查询选项。
	 * @returns 分页行数据。
	 */
	public async listRowPage(
		connection: PostgreSqlConnectionConfig,
		databaseName: string,
		schemaName: string,
		tableName: string,
		pageIndex: number,
		pageSize: number,
		options?: MySqlTableQueryOptions
	): Promise<MySqlTableRowPage> {
		const client = await this.openClient(connection, databaseName);

		try {
			const columns = await this.listColumnsWithClient(
				client,
				schemaName,
				tableName
			);
			const rowCountQuery = this.createRowCountQuery(
				schemaName,
				tableName,
				columns,
				options
			);
			const rowPageQuery = this.createRowPageQuery(
				schemaName,
				tableName,
				columns,
				pageIndex,
				pageSize,
				options
			);

			const [countResult, rowsResult] = await Promise.all([
				client.query(rowCountQuery.sql, rowCountQuery.values),
				client.query(rowPageQuery.sql, rowPageQuery.values),
			]);

			return this.normalizeRowPage(
				rowsResult.rows,
				columns,
				pageIndex,
				pageSize,
				this.readTotalRowCount(countResult.rows),
				rowPageQuery.displaySql,
				rowPageQuery.displaySqlWithoutPagination
			);
		} finally {
			await client.end();
		}
	}

	/**
	 * 复用已有 pg 连接列出字段。
	 *
	 * @param client 当前可用的 pg 客户端。
	 * @param schemaName 表所属的 schema。
	 * @param tableName 需要加载字段的表。
	 * @returns 归一化后的字段元数据。
	 */
	private async listColumnsWithClient(
		client: PostgreSqlRuntimeClient,
		schemaName: string,
		tableName: string
	): Promise<readonly MySqlTableColumnMetadata[]> {
		const [columnsResult, primaryKeysResult] = await Promise.all([
			client.query(
				[
					'SELECT column_name AS "columnName",',
					'udt_name AS "dataType",',
					'datetime_precision AS "dateTimePrecision",',
					'is_nullable AS "isNullable",',
					'column_default AS "columnDefault"',
					'FROM information_schema.columns',
					'WHERE table_schema = $1 AND table_name = $2',
					'ORDER BY ordinal_position',
				].join(' '),
				[schemaName, tableName]
			),
			client.query(
				[
					'SELECT a.attname AS "columnName"',
					'FROM pg_index i',
					'JOIN pg_attribute a ON a.attrelid = i.indrelid',
					'AND a.attnum = ANY(i.indkey)',
					'WHERE i.indrelid = $1::regclass',
					'AND i.indisprimary',
				].join(' '),
				[`${this.quoteIdentifier(schemaName)}.${this.quoteIdentifier(tableName)}`]
			),
		]);

		return this.normalizeColumnRows(
			columnsResult.rows,
			new Set(
				primaryKeysResult.rows
					.map((row) => row.columnName)
					.filter((value): value is string => typeof value === 'string')
			)
		);
	}

	/**
	 * 打开 pg 客户端连接。
	 *
	 * @param connection PostgreSQL 连接配置。
	 * @param databaseName 需要连接的 database。
	 * @returns 已连接的 pg 客户端。
	 */
	private async openClient(
		connection: PostgreSqlConnectionConfig,
		databaseName: string
	): Promise<PostgreSqlRuntimeClient> {
		const postgreSql = this.postgreSqlRuntimeLoader.loadPostgreSqlModule();
		const client = new postgreSql.Client(
			this.postgreSqlConnectionAdapter.resolveDriverOptions(
				connection,
				databaseName
			)
		);
		await client.connect();
		return client;
	}

	/**
	 * 将 information_schema 行归一化为字段元数据。
	 *
	 * @param rows pg 返回的原始行值。
	 * @param primaryKeyNames 当前表主键字段名集合。
	 * @returns 归一化后的字段元数据。
	 */
	private normalizeColumnRows(
		rows: readonly Record<string, unknown>[],
		primaryKeyNames: ReadonlySet<string>
	): readonly MySqlTableColumnMetadata[] {
		return rows
			.map((row) => {
				const name = row.columnName;
				const dataType = row.dataType;
				if (typeof name !== 'string' || typeof dataType !== 'string') {
					return undefined;
				}

				return {
					name,
					dataType,
					dateTimePrecision: this.normalizeDateTimePrecision(
						row.dateTimePrecision
					),
					nullable: row.isNullable === 'YES',
					isPrimaryKey: primaryKeyNames.has(name),
					extra: typeof row.columnDefault === 'string' ? row.columnDefault : '',
				};
			})
			.filter(
				(column): column is MySqlTableColumnMetadata => column !== undefined
			);
	}

	/**
	 * 创建表数据总数查询。
	 *
	 * @param schemaName 表所属的 schema。
	 * @param tableName 需要统计的表。
	 * @param columns 当前表字段元数据。
	 * @param options 过滤查询选项。
	 * @returns 可执行 SQL 和参数。
	 */
	private createRowCountQuery(
		schemaName: string,
		tableName: string,
		columns: readonly MySqlTableColumnMetadata[],
		options?: MySqlTableQueryOptions
	): {
		readonly sql: string;
		readonly values: readonly unknown[];
	} {
		const filterClause = this.createFilterClause(columns, 1, options);
		return {
			sql: [
				`SELECT COUNT(*) AS "totalRowCount" FROM ${this.quoteQualifiedTableName(schemaName, tableName)}`,
				filterClause.sql,
			]
				.filter((part) => part.length > 0)
				.join(' '),
			values: filterClause.values,
		};
	}

	/**
	 * 创建分页行数据查询。
	 *
	 * @param schemaName 表所属的 schema。
	 * @param tableName 需要加载行数据的表。
	 * @param columns 当前表字段元数据。
	 * @param pageIndex 从 0 开始的页码。
	 * @param pageSize 每页请求的行数。
	 * @param options 排序和过滤等查询选项。
	 * @returns 可执行 SQL、参数和展示 SQL。
	 */
	private createRowPageQuery(
		schemaName: string,
		tableName: string,
		columns: readonly MySqlTableColumnMetadata[],
		pageIndex: number,
		pageSize: number,
		options?: MySqlTableQueryOptions
	): {
		readonly sql: string;
		readonly values: readonly unknown[];
		readonly displaySql: string;
		readonly displaySqlWithoutPagination: string;
	} {
		const offset = pageIndex * pageSize;
		const filterClause = this.createFilterClause(columns, 1, options);
		const orderByClause = this.createOrderByClause(columns, options);
		const baseSql = [
			`SELECT * FROM ${this.quoteQualifiedTableName(schemaName, tableName)}`,
			filterClause.sql,
			orderByClause,
		]
			.filter((part) => part.length > 0)
			.join(' ');
		const paginationSql = `LIMIT $${filterClause.values.length + 1} OFFSET $${filterClause.values.length + 2}`;

		return {
			sql: `${baseSql} ${paginationSql}`,
			values: [...filterClause.values, pageSize + 1, offset],
			displaySql: `${[
				`SELECT * FROM ${this.quoteQualifiedTableName(schemaName, tableName)}`,
				filterClause.displaySql,
				orderByClause,
				`LIMIT ${pageSize + 1} OFFSET ${offset}`,
			]
				.filter((part) => part.length > 0)
				.join(' ')};`,
			displaySqlWithoutPagination: `${[
				`SELECT * FROM ${this.quoteQualifiedTableName(schemaName, tableName)}`,
				filterClause.displaySql,
				orderByClause,
			]
				.filter((part) => part.length > 0)
				.join(' ')};`,
		};
	}

	/**
	 * 创建过滤 SQL 片段。
	 *
	 * @param columns 当前表字段元数据。
	 * @param startIndex PostgreSQL 参数起始下标。
	 * @param options 查询选项。
	 * @returns WHERE 片段和参数。
	 */
	private createFilterClause(
		columns: readonly MySqlTableColumnMetadata[],
		startIndex: number,
		options?: MySqlTableQueryOptions
	): PostgreSqlQueryFragment {
		const fragments: PostgreSqlQueryFragment[] = [];
		let nextIndex = startIndex;
		const keyword = options?.filter?.keyword?.trim();

		if (keyword) {
			const searchableColumns = columns.map((column) =>
				this.quoteIdentifier(column.name)
			);
			if (searchableColumns.length > 0) {
				const value = `%${keyword}%`;
				const conditions = searchableColumns.map(
					(columnSql) => `${columnSql}::text ILIKE $${nextIndex}`
				);
				fragments.push({
					sql: `(${conditions.join(' OR ')})`,
					displaySql: `(${searchableColumns
						.map(
							(columnSql) =>
								`${columnSql}::text ILIKE ${this.formatSqlLiteral(value)}`
						)
						.join(' OR ')})`,
					values: [value],
				});
				nextIndex += 1;
			}
		}

		for (const condition of options?.filter?.conditions ?? []) {
			const fragment = this.createConditionClause(
				columns,
				condition,
				nextIndex
			);
			if (fragment) {
				fragments.push(fragment);
				nextIndex += fragment.values.length;
			}
		}

		return {
			sql:
				fragments.length > 0
					? `WHERE ${fragments.map((fragment) => fragment.sql).join(' AND ')}`
					: '',
			displaySql:
				fragments.length > 0
					? `WHERE ${fragments
							.map((fragment) => fragment.displaySql)
							.join(' AND ')}`
					: '',
			values: fragments.flatMap((fragment) => fragment.values),
		};
	}

	/**
	 * 创建单条字段过滤条件 SQL 片段。
	 *
	 * @param columns 当前表字段元数据。
	 * @param condition 字段过滤条件。
	 * @param parameterIndex PostgreSQL 参数下标。
	 * @returns 可拼接到 WHERE 中的条件片段。
	 */
	private createConditionClause(
		columns: readonly MySqlTableColumnMetadata[],
		condition: MySqlTableFilterCondition,
		parameterIndex: number
	): PostgreSqlQueryFragment | undefined {
		const column = columns.find((item) => item.name === condition.columnName);
		if (!column) {
			return undefined;
		}

		const columnSql = this.quoteIdentifier(column.name);
		if (condition.operator === 'null' || condition.operator === 'not null') {
			const operator = condition.operator === 'null' ? 'IS NULL' : 'IS NOT NULL';
			return {
				sql: `${columnSql} ${operator}`,
				displaySql: `${columnSql} ${operator}`,
				values: [],
			};
		}

		if (condition.operator === 'in' || condition.operator === 'not in') {
			const values = this.normalizeFilterValueList(condition.value);
			if (values.length === 0) {
				return undefined;
			}

			const placeholders = values
				.map((_, index) => `$${parameterIndex + index}`)
				.join(', ');
			const displayValues = values
				.map((item) => this.formatSqlLiteral(item))
				.join(', ');
			const operator = condition.operator === 'in' ? 'IN' : 'NOT IN';
			return {
				sql: `${columnSql} ${operator} (${placeholders})`,
				displaySql: `${columnSql} ${operator} (${displayValues})`,
				values,
			};
		}

		const value = this.normalizeFilterScalarValue(condition.value);
		const sqlOperator =
			condition.operator === '!='
				? '<>'
				: condition.operator === 'like'
					? 'ILIKE'
					: condition.operator;

		return {
			sql: `${columnSql} ${sqlOperator} $${parameterIndex}`,
			displaySql: `${columnSql} ${sqlOperator} ${this.formatSqlLiteral(value)}`,
			values: [condition.operator === 'like' ? `%${value}%` : value],
		};
	}

	/**
	 * 将字段过滤值归一化为非空字符串列表。
	 *
	 * @param value Webview 提交的过滤值。
	 * @returns 可用于 IN / NOT IN 查询的字符串列表。
	 */
	private normalizeFilterValueList(
		value: MySqlTableFilterCondition['value']
	): readonly string[] {
		const values =
			typeof value === 'string'
				? value.split(',')
				: value === undefined
					? []
					: value;

		return values.map((item) => item.trim()).filter((item) => item.length > 0);
	}

	/**
	 * 将字段过滤值归一化为单个字符串。
	 *
	 * @param value Webview 提交的过滤值。
	 * @returns 可用于普通比较查询的字符串值。
	 */
	private normalizeFilterScalarValue(
		value: MySqlTableFilterCondition['value']
	): string {
		if (typeof value === 'string') {
			return value;
		}

		if (value === undefined) {
			return '';
		}

		return value[0] ?? '';
	}

	/**
	 * 创建排序 SQL 片段。
	 *
	 * @param columns 当前表字段元数据。
	 * @param options 查询选项。
	 * @returns ORDER BY SQL 片段。
	 */
	private createOrderByClause(
		columns: readonly MySqlTableColumnMetadata[],
		options?: MySqlTableQueryOptions
	): string {
		const requestedSortColumn = options?.sort
			? columns.find((column) => column.name === options.sort?.columnName)
			: undefined;
		if (requestedSortColumn) {
			return `ORDER BY ${this.quoteIdentifier(requestedSortColumn.name)} ${options?.sort?.direction === 'desc' ? 'DESC' : 'ASC'}`;
		}

		const primaryKeyColumns = columns
			.filter((column) => column.isPrimaryKey)
			.map((column) => column.name);
		return primaryKeyColumns.length > 0
			? `ORDER BY ${primaryKeyColumns
					.map((columnName) => this.quoteIdentifier(columnName))
					.join(', ')}`
			: '';
	}

	/**
	 * 将 pg 行数据归一化为可序列化的分页载荷。
	 *
	 * @param rows pg 返回的原始行值。
	 * @param columns 当前表字段元数据。
	 * @param pageIndex 从 0 开始的页码。
	 * @param pageSize 请求的分页大小。
	 * @param totalRowCount 当前查询条件下的总行数。
	 * @param sql 当前表数据页带分页条件的展示 SQL。
	 * @param sqlWithoutPagination 当前表数据查询去掉分页条件后的展示 SQL。
	 * @returns 归一化后的分页行数据。
	 */
	private normalizeRowPage(
		rows: readonly Record<string, unknown>[],
		columns: readonly MySqlTableColumnMetadata[],
		pageIndex: number,
		pageSize: number,
		totalRowCount: number,
		sql: string,
		sqlWithoutPagination: string
	): MySqlTableRowPage {
		return {
			pageIndex,
			pageSize,
			totalRowCount,
			hasNextPage: rows.length > pageSize,
			sql,
			sqlWithoutPagination,
			rows: rows.slice(0, pageSize).map((row) => this.normalizeRow(row, columns)),
		};
	}

	/**
	 * 将单条 pg 行归一化为可序列化的单元格值。
	 *
	 * @param row pg 返回的原始行。
	 * @param columns 当前表字段元数据。
	 * @returns 归一化后的行对象。
	 */
	private normalizeRow(
		row: Record<string, unknown>,
		columns: readonly MySqlTableColumnMetadata[]
	): Record<string, MySqlTableCellValue> {
		const columnsByName = new Map(
			columns.map((column) => [column.name, column])
		);
		return Object.fromEntries(
			Object.entries(row).map(([key, value]) => [
				key,
				this.normalizeCellValue(value, columnsByName.get(key)),
			])
		);
	}

	/**
	 * 将单个单元格值归一化为可安全 JSON 渲染的值。
	 *
	 * @param value 原始单元格值。
	 * @param column 当前字段元数据。
	 * @returns 归一化后的单元格值。
	 */
	private normalizeCellValue(
		value: unknown,
		column?: MySqlTableColumnMetadata
	): MySqlTableCellValue {
		if (
			value === null ||
			typeof value === 'string' ||
			typeof value === 'number' ||
			typeof value === 'boolean'
		) {
			return value;
		}
		if (typeof value === 'bigint') {
			return value.toString();
		}
		if (value instanceof Date) {
			return this.formatDateCellValue(value, column);
		}
		if (Buffer.isBuffer(value)) {
			return `0x${value.toString('hex')}`;
		}
		if (value && typeof value === 'object') {
			return JSON.stringify(value);
		}
		return String(value);
	}

	/**
	 * 格式化日期时间单元格。
	 *
	 * @param value 原始 Date 值。
	 * @param column 当前字段元数据。
	 * @returns 旧 PPZ 风格的日期时间字符串。
	 */
	private formatDateCellValue(
		value: Date,
		column?: MySqlTableColumnMetadata
	): string {
		const year = value.getFullYear().toString().padStart(4, '0');
		const month = (value.getMonth() + 1).toString().padStart(2, '0');
		const day = value.getDate().toString().padStart(2, '0');
		const hours = value.getHours().toString().padStart(2, '0');
		const minutes = value.getMinutes().toString().padStart(2, '0');
		const seconds = value.getSeconds().toString().padStart(2, '0');
		const milliseconds = value.getMilliseconds().toString().padStart(3, '0');
		const baseValue = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;

		if (!column || column.dateTimePrecision === null || column.dateTimePrecision <= 0) {
			return baseValue;
		}

		return `${baseValue}.${milliseconds.slice(0, Math.min(3, column.dateTimePrecision))}`;
	}

	/**
	 * 归一化 PostgreSQL 返回的日期时间小数秒精度。
	 *
	 * @param value information_schema 中的 datetime_precision 值。
	 * @returns 可用于展示截断的小数秒精度。
	 */
	private normalizeDateTimePrecision(value: unknown): number | null {
		if (typeof value === 'number' && Number.isFinite(value)) {
			return Math.max(0, Math.floor(value));
		}
		if (typeof value === 'string' && value.trim().length > 0) {
			const parsedValue = Number.parseInt(value, 10);
			return Number.isFinite(parsedValue) ? Math.max(0, parsedValue) : null;
		}
		return null;
	}

	/**
	 * 从 COUNT 查询结果中读取总行数。
	 *
	 * @param rows pg 返回的 COUNT 查询行。
	 * @returns 当前查询条件下的总行数。
	 */
	private readTotalRowCount(rows: readonly Record<string, unknown>[]): number {
		const value = rows[0]?.totalRowCount;
		if (typeof value === 'number') {
			return value;
		}
		if (typeof value === 'bigint') {
			return Number(value);
		}
		if (typeof value === 'string') {
			const parsedValue = Number(value);
			return Number.isFinite(parsedValue) ? parsedValue : 0;
		}
		return 0;
	}

	/**
	 * 转义 PostgreSQL 标识符。
	 *
	 * @param value 原始标识符。
	 * @returns 可拼接 SQL 的标识符。
	 */
	private quoteIdentifier(value: string): string {
		return `"${value.replaceAll('"', '""')}"`;
	}

	/**
	 * 转义 PostgreSQL schema.table 名称。
	 *
	 * @param schemaName schema 名称。
	 * @param tableName 表名称。
	 * @returns 可拼接 SQL 的完整表名。
	 */
	private quoteQualifiedTableName(schemaName: string, tableName: string): string {
		return `${this.quoteIdentifier(schemaName)}.${this.quoteIdentifier(tableName)}`;
	}

	/**
	 * 格式化展示 SQL 使用的字面量。
	 *
	 * @param value 原始值。
	 * @returns 可读 SQL 字面量。
	 */
	private formatSqlLiteral(value: string): string {
		return `'${value.replaceAll("'", "''")}'`;
	}
}
