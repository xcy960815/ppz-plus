import type { MysqlConnectionConfig } from '../../domain/connections/ConnectionConfig';
import type {
	MySqlTableCellValue,
	MySqlTableColumnMetadata,
	MySqlTableDataProvider,
	MySqlTableQueryOptions,
	MySqlTableRowPage,
} from '../../application/mysql/MySqlTableDataProvider';
import { MySqlConnectionAdapter } from './MySqlConnectionAdapter';
import { MySqlRuntimeLoader } from './MySqlRuntimeLoader';

/**
 * 通过 mysql2 promise 驱动读取 MySQL 表字段和行数据。
 */
export class Mysql2TableDataProvider implements MySqlTableDataProvider {
	/**
	 * 创建基于 mysql2 的表数据提供者。
	 *
	 * @param mySqlConnectionAdapter 用于归一化连接选项的适配器。
	 * @param mySqlRuntimeLoader 用于延迟解析 mysql2 运行时的加载器。
	 */
	public constructor(
		private readonly mySqlConnectionAdapter: MySqlConnectionAdapter,
		private readonly mySqlRuntimeLoader: MySqlRuntimeLoader
	) {}

	/**
	 * 列出指定 MySQL 表的字段。
	 *
	 * @param connection MySQL 连接配置。
	 * @param schemaName 表所属的 schema。
	 * @param tableName 需要加载字段的表。
	 * @returns 归一化后的字段元数据。
	 */
	public async listColumns(
		connection: MysqlConnectionConfig,
		schemaName: string,
		tableName: string
	): Promise<readonly MySqlTableColumnMetadata[]> {
		const mysql = await this.mySqlRuntimeLoader.loadMySqlPromiseModule();
		const runtimeConnection = await mysql.createConnection(
			this.mySqlConnectionAdapter.resolveDriverOptions(connection)
		);

		try {
			return this.listColumnsWithConnection(
				runtimeConnection,
				schemaName,
				tableName
			);
		} finally {
			await runtimeConnection.end();
		}
	}

	/**
	 * 列出指定 MySQL 表的一页行数据。
	 *
	 * @param connection MySQL 连接配置。
	 * @param schemaName 表所属的 schema。
	 * @param tableName 需要加载行数据的表。
	 * @param pageIndex 从 0 开始的页码。
	 * @param pageSize 每页请求的行数。
	 * @returns 分页行数据。
	 */
	public async listRowPage(
		connection: MysqlConnectionConfig,
		schemaName: string,
		tableName: string,
		pageIndex: number,
		pageSize: number,
		options?: MySqlTableQueryOptions
	): Promise<MySqlTableRowPage> {
		const mysql = await this.mySqlRuntimeLoader.loadMySqlPromiseModule();
		const runtimeConnection = await mysql.createConnection(
			this.mySqlConnectionAdapter.resolveDriverOptions(connection)
		);

		try {
			const columns = await this.listColumnsWithConnection(
				runtimeConnection,
				schemaName,
				tableName
			);
			const normalizedPageIndex = Math.max(pageIndex, 0);
			const rowPageQuery = this.createRowPageQuery(
				schemaName,
				tableName,
				columns,
				normalizedPageIndex,
				pageSize,
				options
			);
			const [rows] = await runtimeConnection.query(
				rowPageQuery.sql,
				rowPageQuery.values
			);

			return this.normalizeRowPage(
				rows,
				normalizedPageIndex,
				pageSize,
				rowPageQuery.displaySql
			);
		} finally {
			await runtimeConnection.end();
		}
	}

	/**
	 * 复用已有 mysql2 连接列出字段。
	 *
	 * @param runtimeConnection 当前可用的 mysql2 连接。
	 * @param schemaName 表所属的 schema。
	 * @param tableName 需要加载字段的表。
	 * @returns 归一化后的字段元数据。
	 */
	private async listColumnsWithConnection(
		runtimeConnection: {
			query(sql: string, values?: readonly unknown[]): Promise<[unknown, unknown]>;
		},
		schemaName: string,
		tableName: string
	): Promise<readonly MySqlTableColumnMetadata[]> {
		const [rows] = await runtimeConnection.query(
			[
				'SELECT column_name, data_type, is_nullable, column_key, extra',
				'FROM information_schema.columns',
				'WHERE table_schema = ? AND table_name = ?',
				'ORDER BY ordinal_position',
			].join(' '),
			[schemaName, tableName]
		);

		return this.normalizeColumnRows(rows);
	}

	/**
	 * 将 information_schema 行归一化为字段元数据。
	 *
	 * @param rows mysql2 返回的原始行值。
	 * @returns 归一化后的字段元数据。
	 */
	private normalizeColumnRows(
		rows: unknown
	): readonly MySqlTableColumnMetadata[] {
		if (!Array.isArray(rows)) {
			return [];
		}

		return rows
			.map((row) => {
				if (!row || typeof row !== 'object') {
					return undefined;
				}

				const name = Reflect.get(row, 'column_name');
				const dataType = Reflect.get(row, 'data_type');
				const isNullable = Reflect.get(row, 'is_nullable');
				const columnKey = Reflect.get(row, 'column_key');
				const extra = Reflect.get(row, 'extra');

				if (typeof name !== 'string' || typeof dataType !== 'string') {
					return undefined;
				}

				return {
					name,
					dataType,
					nullable: isNullable === 'YES',
					isPrimaryKey: columnKey === 'PRI',
					extra: typeof extra === 'string' ? extra : '',
				};
			})
			.filter(
				(column): column is MySqlTableColumnMetadata => column !== undefined
			);
	}

	/**
	 * 将 mysql2 行数据归一化为可序列化的分页载荷。
	 *
	 * @param rows mysql2 返回的原始行值。
	 * @param pageIndex 从 0 开始的页码。
	 * @param pageSize 请求的分页大小。
	 * @returns 归一化后的分页行数据。
	 */
	private normalizeRowPage(
		rows: unknown,
		pageIndex: number,
		pageSize: number,
		sql: string
	): MySqlTableRowPage {
		if (!Array.isArray(rows)) {
			return {
				pageIndex,
				pageSize,
				hasNextPage: false,
				sql,
				rows: [],
			};
		}

		const normalizedRows = rows
			.filter(
				(row): row is Record<string, unknown> =>
					Boolean(row) && typeof row === 'object' && !Array.isArray(row)
			)
			.slice(0, pageSize)
			.map((row) => this.normalizeRow(row));

		return {
			pageIndex,
			pageSize,
			hasNextPage: rows.length > pageSize,
			sql,
			rows: normalizedRows,
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
	} {
		const offset = pageIndex * pageSize;
		const tableSql = this.escapeQualifiedTableName(schemaName, tableName);
		const filterClause = this.createFilterClause(columns, options);
		const orderByClause = this.createOrderByClause(columns, options);
		const executableParts = [
			`SELECT * FROM ${tableSql}`,
			filterClause.sql,
			orderByClause,
			'LIMIT ? OFFSET ?',
		].filter((part) => part.length > 0);
		const displayParts = [
			`SELECT * FROM ${tableSql}`,
			filterClause.displaySql,
			orderByClause,
			`LIMIT ${pageSize + 1} OFFSET ${offset}`,
		].filter((part) => part.length > 0);

		return {
			sql: executableParts.join(' '),
			values: [...filterClause.values, pageSize + 1, offset],
			displaySql: displayParts.join(' '),
		};
	}

	/**
	 * 创建关键词过滤 SQL 片段。
	 *
	 * @param columns 当前表字段元数据。
	 * @param options 查询选项。
	 * @returns 过滤 SQL、展示 SQL 和参数。
	 */
	private createFilterClause(
		columns: readonly MySqlTableColumnMetadata[],
		options?: MySqlTableQueryOptions
	): {
		readonly sql: string;
		readonly displaySql: string;
		readonly values: readonly unknown[];
	} {
		const keyword = options?.filter?.keyword.trim() ?? '';
		if (keyword.length === 0 || columns.length === 0) {
			return {
				sql: '',
				displaySql: '',
				values: [],
			};
		}

		const searchableColumnsSql = columns
			.map(
				(column) =>
					`CAST(${this.escapeIdentifier(column.name)} AS CHAR)`
			)
			.join(', ');
		const pattern = `%${keyword}%`;

		return {
			sql: `WHERE CONCAT_WS('\\n', ${searchableColumnsSql}) LIKE ?`,
			displaySql: `WHERE CONCAT_WS('\\n', ${searchableColumnsSql}) LIKE '${this.escapeSqlString(pattern)}'`,
			values: [pattern],
		};
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
			return `ORDER BY ${this.escapeIdentifier(requestedSortColumn.name)} ${options?.sort?.direction === 'desc' ? 'DESC' : 'ASC'}`;
		}

		const primaryKeyColumns = columns
			.filter((column) => column.isPrimaryKey)
			.map((column) => column.name);

		return primaryKeyColumns.length > 0
			? `ORDER BY ${primaryKeyColumns
					.map((columnName) => this.escapeIdentifier(columnName))
					.join(', ')}`
			: '';
	}

	/**
	 * 将单条 mysql2 行归一化为可序列化的单元格值。
	 *
	 * @param row mysql2 返回的原始行。
	 * @returns 归一化后的行对象。
	 */
	private normalizeRow(
		row: Record<string, unknown>
	): Record<string, MySqlTableCellValue> {
		return Object.fromEntries(
			Object.entries(row).map(([key, value]) => [
				key,
				this.normalizeCellValue(value),
			])
		);
	}

	/**
	 * 将单个单元格值归一化为可安全 JSON 渲染的值。
	 *
	 * @param value 原始单元格值。
	 * @returns 归一化后的单元格值。
	 */
	private normalizeCellValue(value: unknown): MySqlTableCellValue {
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
			return value.toISOString();
		}

		if (Buffer.isBuffer(value)) {
			return `0x${value.toString('hex')}`;
		}

		if (ArrayBuffer.isView(value)) {
			return `0x${Buffer.from(
				value.buffer,
				value.byteOffset,
				value.byteLength
			).toString('hex')}`;
		}

		if (value && typeof value === 'object') {
			try {
				return JSON.stringify(value) ?? String(value);
			} catch {
				return String(value);
			}
		}

		return String(value);
	}

	/**
	 * 转义 MySQL 字符串字面量内容。
	 *
	 * @param value 待转义的字符串。
	 * @returns 转义后的字符串字面量内容。
	 */
	private escapeSqlString(value: string): string {
		return value
			.replaceAll('\\', '\\\\')
			.replaceAll('\0', '\\0')
			.replaceAll('\n', '\\n')
			.replaceAll('\r', '\\r')
			.replaceAll('\b', '\\b')
			.replaceAll('\t', '\\t')
			.replaceAll('\u001a', '\\Z')
			.replaceAll("'", "\\'");
	}

	/**
	 * 转义 MySQL 标识符以便放入原始 SQL 字符串。
	 *
	 * @param identifier 待转义的标识符。
	 * @returns 转义后的标识符。
	 */
	private escapeIdentifier(identifier: string): string {
		return `\`${identifier.replaceAll('`', '``')}\``;
	}

	/**
	 * 转义完整 schema.table 引用以便用于原始 SQL。
	 *
	 * @param schemaName 表所属的 schema。
	 * @param tableName 选中的表名。
	 * @returns 转义后的完整表名。
	 */
	private escapeQualifiedTableName(
		schemaName: string,
		tableName: string
	): string {
		return `${this.escapeIdentifier(schemaName)}.${this.escapeIdentifier(tableName)}`;
	}
}
