import type { MysqlConnectionConfig } from '../../domain/connections/ConnectionConfig';
import type {
	MySqlTableCellValue,
	MySqlTableColumnMetadata,
	MySqlTableDataProvider,
	MySqlTableDeleteResult,
	MySqlTableFilterCondition,
	MySqlTableInsertResult,
	MySqlTableInsertValues,
	MySqlTableQueryOptions,
	MySqlTableRowPage,
	MySqlTableRowIdentityValues,
	MySqlTableUpdateResult,
	MySqlTableUpdateValues,
} from '../../application/mysql/MySqlTableDataProvider';
import { MySqlConnectionAdapter } from './MySqlConnectionAdapter';
import { MySqlRuntimeLoader } from './MySqlRuntimeLoader';
import type { MySqlRuntimeClient, MySqlQueryRows } from './MySqlRuntimeTypes';

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
	 * @param {MysqlConnectionConfig} connection MySQL 连接配置。
	 * @param {string} schemaName 表所属的 schema。
	 * @param {string} tableName 需要加载字段的表。
	 * @returns {Promise<readonly MySqlTableColumnMetadata[]>} 归一化后的字段元数据。
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
	 * @param {MysqlConnectionConfig} connection MySQL 连接配置。
	 * @param {string} schemaName 表所属的 schema。
	 * @param {string} tableName 需要加载行数据的表。
	 * @param {number} pageIndex 从 0 开始的页码。
	 * @param {number} pageSize 每页请求的行数。
	 * @returns {Promise<MySqlTableRowPage>} 分页行数据。
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
			const rowCountQuery = this.createRowCountQuery(
				schemaName,
				tableName,
				columns,
				options
			);
			const [[rows], [countRows]] = await Promise.all([
				runtimeConnection.query(rowPageQuery.sql, rowPageQuery.values),
				runtimeConnection.query(rowCountQuery.sql, rowCountQuery.values),
			]);
			const totalRowCount = this.readTotalRowCount(countRows);

			return this.normalizeRowPage(
				rows,
				columns,
				normalizedPageIndex,
				pageSize,
				totalRowCount,
				rowPageQuery.displaySql,
				rowPageQuery.displaySqlWithoutPagination
			);
		} finally {
			await runtimeConnection.end();
		}
	}

	/**
	 * 向指定 MySQL 表新增一条记录。
	 *
	 * @param {MysqlConnectionConfig} connection MySQL 连接配置。
	 * @param {string} schemaName 表所属的 schema。
	 * @param {string} tableName 需要新增记录的表。
	 * @param {MySqlTableInsertValues} values 需要显式写入的字段值。
	 * @returns {Promise<MySqlTableInsertResult>} 单行新增结果。
	 */
	public async insertRow(
		connection: MysqlConnectionConfig,
		schemaName: string,
		tableName: string,
		values: MySqlTableInsertValues
	): Promise<MySqlTableInsertResult> {
		const mysql = await this.mySqlRuntimeLoader.loadMySqlPromiseModule();
		const runtimeConnection = await mysql.createConnection(
			this.mySqlConnectionAdapter.resolveDriverOptions(connection)
		);

		try {
			const insertQuery = this.createInsertRowQuery(
				schemaName,
				tableName,
				values
			);
			const [result] = await runtimeConnection.query(
				insertQuery.sql,
				insertQuery.values
			);

			return {
				affectedRows: this.readNumberProperty(result, 'affectedRows'),
				insertId: this.readInsertId(result),
				sql: insertQuery.displaySql,
			};
		} finally {
			await runtimeConnection.end();
		}
	}

	/**
	 * 更新指定 MySQL 表中的一条记录。
	 *
	 * @param {MysqlConnectionConfig} connection MySQL 连接配置。
	 * @param {string} schemaName 表所属的 schema。
	 * @param {string} tableName 需要更新记录的表。
	 * @param {MySqlTableRowIdentityValues} identityValues 用于定位原行的字段值。
	 * @param {MySqlTableUpdateValues} values 需要更新的新字段值。
	 * @returns {Promise<MySqlTableUpdateResult>} 单行更新结果。
	 */
	public async updateRow(
		connection: MysqlConnectionConfig,
		schemaName: string,
		tableName: string,
		identityValues: MySqlTableRowIdentityValues,
		values: MySqlTableUpdateValues
	): Promise<MySqlTableUpdateResult> {
		const mysql = await this.mySqlRuntimeLoader.loadMySqlPromiseModule();
		const runtimeConnection = await mysql.createConnection(
			this.mySqlConnectionAdapter.resolveDriverOptions(connection)
		);

		try {
			const updateQuery = this.createUpdateRowQuery(
				schemaName,
				tableName,
				identityValues,
				values
			);
			const [result] = await runtimeConnection.query(
				updateQuery.sql,
				updateQuery.values
			);

			return {
				affectedRows: this.readNumberProperty(result, 'affectedRows'),
				sql: updateQuery.displaySql,
			};
		} finally {
			await runtimeConnection.end();
		}
	}

	/**
	 * 删除指定 MySQL 表中的一条记录。
	 *
	 * @param {MysqlConnectionConfig} connection MySQL 连接配置。
	 * @param {string} schemaName 表所属的 schema。
	 * @param {string} tableName 需要删除记录的表。
	 * @param {MySqlTableRowIdentityValues} identityValues 用于定位原行的字段值。
	 * @returns {Promise<MySqlTableDeleteResult>} 单行删除结果。
	 */
	public async deleteRow(
		connection: MysqlConnectionConfig,
		schemaName: string,
		tableName: string,
		identityValues: MySqlTableRowIdentityValues
	): Promise<MySqlTableDeleteResult> {
		const mysql = await this.mySqlRuntimeLoader.loadMySqlPromiseModule();
		const runtimeConnection = await mysql.createConnection(
			this.mySqlConnectionAdapter.resolveDriverOptions(connection)
		);

		try {
			const deleteQuery = this.createDeleteRowQuery(
				schemaName,
				tableName,
				identityValues
			);
			const [result] = await runtimeConnection.query(
				deleteQuery.sql,
				deleteQuery.values
			);

			return {
				affectedRows: this.readNumberProperty(result, 'affectedRows'),
				sql: deleteQuery.displaySql,
			};
		} finally {
			await runtimeConnection.end();
		}
	}

	/**
	 * 复用已有 mysql2 连接列出字段。
	 *
	 * @param {MySqlRuntimeClient} runtimeConnection 当前可用的 mysql2 连接。
	 * @param {string} schemaName 表所属的 schema。
	 * @param {string} tableName 需要加载字段的表。
	 * @returns {Promise<readonly MySqlTableColumnMetadata[]>} 归一化后的字段元数据。
	 */
	private async listColumnsWithConnection(
		runtimeConnection: MySqlRuntimeClient,
		schemaName: string,
		tableName: string
	): Promise<readonly MySqlTableColumnMetadata[]> {
		const [rows] = await runtimeConnection.query(
			[
				'SELECT',
				'COLUMN_NAME AS columnName,',
				'DATA_TYPE AS dataType,',
				'DATETIME_PRECISION AS dateTimePrecision,',
				'IS_NULLABLE AS isNullable,',
				'COLUMN_KEY AS columnKey,',
				'EXTRA AS extra',
				'FROM information_schema.columns',
				'WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?',
				'ORDER BY ORDINAL_POSITION',
			].join(' '),
			[schemaName, tableName]
		);

		return this.normalizeColumnRows(rows);
	}

	/**
	 * 将 information_schema 行归一化为字段元数据。
	 *
	 * @param {MySqlQueryRows} rows mysql2 返回的原始行值。
	 * @returns {readonly MySqlTableColumnMetadata[]} 归一化后的字段元数据。
	 */
	private normalizeColumnRows(
		rows: MySqlQueryRows
	): readonly MySqlTableColumnMetadata[] {
		if (!Array.isArray(rows)) {
			return [];
		}

		return rows
			.map((row) => {
				if (!row || typeof row !== 'object') {
					return undefined;
				}

				const rowRecord = row as Record<string, unknown>;
				const name = rowRecord.columnName;
				const dataType = rowRecord.dataType;
				const dateTimePrecision = rowRecord.dateTimePrecision;
				const isNullable = rowRecord.isNullable;
				const columnKey = rowRecord.columnKey;
				const extra = rowRecord.extra;

				if (typeof name !== 'string' || typeof dataType !== 'string') {
					return undefined;
				}

				return {
					name,
					dataType,
					dateTimePrecision: this.normalizeDateTimePrecision(
						dateTimePrecision
					),
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
	 * 归一化 MySQL 返回的日期时间小数秒精度。
	 *
	 * @param {unknown} value information_schema 中的 DATETIME_PRECISION 值。
	 * @returns {number | null} 可用于展示截断的小数秒精度。
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
	 * 将 mysql2 行数据归一化为可序列化的分页载荷。
	 *
	 * @param {MySqlQueryRows} rows mysql2 返回的原始行值。
	 * @param {readonly MySqlTableColumnMetadata[]} columns 当前表字段元数据。
	 * @param {number} pageIndex 从 0 开始的页码。
	 * @param {number} pageSize 请求的分页大小。
	 * @returns {MySqlTableRowPage} 归一化后的分页行数据。
	 */
	private normalizeRowPage(
		rows: MySqlQueryRows,
		columns: readonly MySqlTableColumnMetadata[],
		pageIndex: number,
		pageSize: number,
		totalRowCount: number,
		sql: string,
		sqlWithoutPagination: string
	): MySqlTableRowPage {
		if (!Array.isArray(rows)) {
			return {
				pageIndex,
				pageSize,
				totalRowCount,
				hasNextPage: false,
				sql,
				sqlWithoutPagination,
				rows: [],
			};
		}

		const normalizedRows = rows
			.filter(
				(row): row is Record<string, unknown> =>
					Boolean(row) && typeof row === 'object' && !Array.isArray(row)
			)
			.slice(0, pageSize)
			.map((row) => this.normalizeRow(row, columns));

		return {
			pageIndex,
			pageSize,
			totalRowCount,
			hasNextPage: rows.length > pageSize,
			sql,
			sqlWithoutPagination,
			rows: normalizedRows,
		};
	}

	/**
	 * 创建表数据总数查询。
	 *
	 * @param {string} schemaName 表所属的 schema。
	 * @param {string} tableName 需要统计的表。
	 * @param {readonly MySqlTableColumnMetadata[]} columns 当前表字段元数据。
	 * @param {MySqlTableQueryOptions} options 过滤查询选项。
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
		const tableSql = this.escapeQualifiedTableName(schemaName, tableName);
		const filterClause = this.createFilterClause(columns, options);
		const executableParts = [
			`SELECT COUNT(*) AS totalRowCount FROM ${tableSql}`,
			filterClause.sql,
		].filter((part) => part.length > 0);

		return {
			sql: executableParts.join(' '),
			values: filterClause.values,
		};
	}

	/**
	 * 创建分页行数据查询。
	 *
	 * @param {string} schemaName 表所属的 schema。
	 * @param {string} tableName 需要加载行数据的表。
	 * @param {readonly MySqlTableColumnMetadata[]} columns 当前表字段元数据。
	 * @param {number} pageIndex 从 0 开始的页码。
	 * @param {number} pageSize 每页请求的行数。
	 * @param {MySqlTableQueryOptions} options 排序和过滤等查询选项。
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
		const displayPartsWithoutPagination = [
			`SELECT * FROM ${tableSql}`,
			filterClause.displaySql,
			orderByClause,
		].filter((part) => part.length > 0);

		return {
			sql: executableParts.join(' '),
			values: [...filterClause.values, pageSize + 1, offset],
			displaySql: displayParts.join(' '),
			displaySqlWithoutPagination: displayPartsWithoutPagination.join(' '),
		};
	}

	/**
	 * 创建单行新增 SQL。
	 *
	 * @param {string} schemaName 表所属的 schema。
	 * @param {string} tableName 需要新增记录的表。
	 * @param {MySqlTableInsertValues} values 需要显式写入的字段值。
	 * @returns 可执行 SQL、参数和展示 SQL。
	 */
	private createInsertRowQuery(
		schemaName: string,
		tableName: string,
		values: MySqlTableInsertValues
	): {
		readonly sql: string;
		readonly values: readonly unknown[];
		readonly displaySql: string;
	} {
		const tableSql = this.escapeQualifiedTableName(schemaName, tableName);
		const entries = Object.entries(values);

		if (entries.length === 0) {
			return {
				sql: `INSERT INTO ${tableSql} () VALUES ()`,
				values: [],
				displaySql: `INSERT INTO ${tableSql} () VALUES ()`,
			};
		}

		const columnSql = entries
			.map(([columnName]) => this.escapeIdentifier(columnName))
			.join(', ');
		const placeholderSql = entries.map(() => '?').join(', ');
		const executableValues = entries.map(([, value]) => value);
		const displayValues = entries
			.map(([, value]) => this.formatSqlLiteral(value))
			.join(', ');

		return {
			sql: `INSERT INTO ${tableSql} (${columnSql}) VALUES (${placeholderSql})`,
			values: executableValues,
			displaySql: `INSERT INTO ${tableSql} (${columnSql}) VALUES (${displayValues})`,
		};
	}

	/**
	 * 创建单行更新 SQL。
	 *
	 * @param {string} schemaName 表所属的 schema。
	 * @param {string} tableName 需要更新记录的表。
	 * @param {MySqlTableRowIdentityValues} identityValues 用于定位原行的字段值。
	 * @param {MySqlTableUpdateValues} values 需要更新的新字段值。
	 * @returns 可执行 SQL、参数和展示 SQL。
	 */
	private createUpdateRowQuery(
		schemaName: string,
		tableName: string,
		identityValues: MySqlTableRowIdentityValues,
		values: MySqlTableUpdateValues
	): {
		readonly sql: string;
		readonly values: readonly unknown[];
		readonly displaySql: string;
	} {
		const tableSql = this.escapeQualifiedTableName(schemaName, tableName);
		const valueEntries = Object.entries(values);
		const identityEntries = Object.entries(identityValues);
		const setSql = valueEntries
			.map(([columnName]) => `${this.escapeIdentifier(columnName)} = ?`)
			.join(', ');
		const whereSql = identityEntries
			.map(([columnName]) => `${this.escapeIdentifier(columnName)} <=> ?`)
			.join(' AND ');
		const displaySetSql = valueEntries
			.map(
				([columnName, value]) =>
					`${this.escapeIdentifier(columnName)} = ${this.formatSqlLiteral(value)}`
			)
			.join(', ');
		const displayWhereSql = identityEntries
			.map(
				([columnName, value]) =>
					`${this.escapeIdentifier(columnName)} <=> ${this.formatSqlLiteral(value)}`
			)
			.join(' AND ');

		return {
			sql: `UPDATE ${tableSql} SET ${setSql} WHERE ${whereSql} LIMIT 1`,
			values: [
				...valueEntries.map(([, value]) => value),
				...identityEntries.map(([, value]) => value),
			],
			displaySql: `UPDATE ${tableSql} SET ${displaySetSql} WHERE ${displayWhereSql} LIMIT 1`,
		};
	}

	/**
	 * 创建单行删除 SQL。
	 *
	 * @param {string} schemaName 表所属的 schema。
	 * @param {string} tableName 需要删除记录的表。
	 * @param {MySqlTableRowIdentityValues} identityValues 用于定位原行的字段值。
	 * @returns 可执行 SQL、参数和展示 SQL。
	 */
	private createDeleteRowQuery(
		schemaName: string,
		tableName: string,
		identityValues: MySqlTableRowIdentityValues
	): {
		readonly sql: string;
		readonly values: readonly unknown[];
		readonly displaySql: string;
	} {
		const tableSql = this.escapeQualifiedTableName(schemaName, tableName);
		const identityEntries = Object.entries(identityValues);
		const whereSql = identityEntries
			.map(([columnName]) => `${this.escapeIdentifier(columnName)} <=> ?`)
			.join(' AND ');
		const displayWhereSql = identityEntries
			.map(
				([columnName, value]) =>
					`${this.escapeIdentifier(columnName)} <=> ${this.formatSqlLiteral(value)}`
			)
			.join(' AND ');

		return {
			sql: `DELETE FROM ${tableSql} WHERE ${whereSql} LIMIT 1`,
			values: identityEntries.map(([, value]) => value),
			displaySql: `DELETE FROM ${tableSql} WHERE ${displayWhereSql} LIMIT 1`,
		};
	}

	/**
	 * 创建关键词过滤 SQL 片段。
	 *
	 * @param {readonly MySqlTableColumnMetadata[]} columns 当前表字段元数据。
	 * @param {MySqlTableQueryOptions} options 查询选项。
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
		const keyword = options?.filter?.keyword?.trim() ?? '';
		if (columns.length === 0) {
			return {
				sql: '',
				displaySql: '',
				values: [],
			};
		}

		const clauses: {
			readonly sql: string;
			readonly displaySql: string;
			readonly values: readonly unknown[];
		}[] = [];

		if (keyword.length > 0) {
			const searchableColumnsSql = columns
				.map(
					(column) =>
						`CAST(${this.escapeIdentifier(column.name)} AS CHAR)`
				)
				.join(', ');
			const pattern = `%${keyword}%`;

			clauses.push({
				sql: `CONCAT_WS('\\n', ${searchableColumnsSql}) LIKE ?`,
				displaySql: `CONCAT_WS('\\n', ${searchableColumnsSql}) LIKE '${this.escapeSqlString(pattern)}'`,
				values: [pattern],
			});
		}

		for (const condition of options?.filter?.conditions ?? []) {
			const clause = this.createFilterConditionClause(columns, condition);
			if (clause) {
				clauses.push(clause);
			}
		}

		if (clauses.length === 0) {
			return {
				sql: '',
				displaySql: '',
				values: [],
			};
		}

		return {
			sql: `WHERE ${clauses.map((clause) => clause.sql).join(' AND ')}`,
			displaySql: `WHERE ${clauses
				.map((clause) => clause.displaySql)
				.join(' AND ')}`,
			values: clauses.flatMap((clause) => clause.values),
		};
	}

	/**
	 * 创建单条字段过滤条件 SQL 片段。
	 *
	 * @param {readonly MySqlTableColumnMetadata[]} columns 当前表字段元数据。
	 * @param {MySqlTableFilterCondition} condition Webview 提交的字段过滤条件。
	 * @returns {|} 可拼接到 WHERE 中的条件片段；字段无效时为空。
	 */
	private createFilterConditionClause(
		columns: readonly MySqlTableColumnMetadata[],
		condition: MySqlTableFilterCondition
	):
		| {
				readonly sql: string;
				readonly displaySql: string;
				readonly values: readonly unknown[];
		  }
		| undefined {
		const column = columns.find(
			(item) => item.name === condition.columnName
		);

		if (!column) {
			return undefined;
		}

		const columnSql = this.escapeIdentifier(column.name);

		switch (condition.operator) {
			case 'null':
				return {
					sql: `${columnSql} IS NULL`,
					displaySql: `${columnSql} IS NULL`,
					values: [],
				};
			case 'not null':
				return {
					sql: `${columnSql} IS NOT NULL`,
					displaySql: `${columnSql} IS NOT NULL`,
					values: [],
				};
			case 'in':
			case 'not in':
				return this.createSetFilterConditionClause(
					columnSql,
					condition.operator,
					condition.value
				);
			case '=':
			case '!=':
			case '>':
			case '>=':
			case '<':
			case '<=':
			case 'like':
				return this.createScalarFilterConditionClause(
					columnSql,
					condition.operator,
					condition.value
				);
		}

		return undefined;
	}

	/**
	 * 创建单值字段过滤条件 SQL 片段。
	 *
	 * @param {string} columnSql 已转义的字段名。
	 * @param {'} operator 字段过滤操作符。
	 * @param {MySqlTableFilterCondition['value']} value 字段过滤值。
	 * @returns 可拼接到 WHERE 中的条件片段。
	 */
	private createScalarFilterConditionClause(
		columnSql: string,
		operator: '=' | '!=' | '>' | '>=' | '<' | '<=' | 'like',
		value: MySqlTableFilterCondition['value']
	): {
		readonly sql: string;
		readonly displaySql: string;
		readonly values: readonly unknown[];
	} {
		const normalizedValue = Array.isArray(value) ? value[0] ?? '' : value ?? '';
		const sqlOperator = operator === '!=' ? '<>' : operator.toUpperCase();

		return {
			sql: `${columnSql} ${sqlOperator} ?`,
			displaySql: `${columnSql} ${sqlOperator} ${this.formatSqlLiteral(
				normalizedValue
			)}`,
			values: [normalizedValue],
		};
	}

	/**
	 * 创建集合字段过滤条件 SQL 片段。
	 *
	 * @param {string} columnSql 已转义的字段名。
	 * @param {'in' | 'not in'} operator 集合过滤操作符。
	 * @param {MySqlTableFilterCondition['value']} value 字段过滤值。
	 * @returns {|} 可拼接到 WHERE 中的条件片段；集合为空时为空。
	 */
	private createSetFilterConditionClause(
		columnSql: string,
		operator: 'in' | 'not in',
		value: MySqlTableFilterCondition['value']
	):
		| {
				readonly sql: string;
				readonly displaySql: string;
				readonly values: readonly unknown[];
		  }
		| undefined {
		const values = (Array.isArray(value) ? value : String(value ?? '').split(','))
			.map((item) => item.trim())
			.filter((item) => item.length > 0);

		if (values.length === 0) {
			return undefined;
		}

		const placeholders = values.map(() => '?').join(', ');
		const displayValues = values
			.map((item) => this.formatSqlLiteral(item))
			.join(', ');
		const sqlOperator = operator === 'not in' ? 'NOT IN' : 'IN';

		return {
			sql: `${columnSql} ${sqlOperator} (${placeholders})`,
			displaySql: `${columnSql} ${sqlOperator} (${displayValues})`,
			values,
		};
	}

	/**
	 * 创建排序 SQL 片段。
	 *
	 * @param {readonly MySqlTableColumnMetadata[]} columns 当前表字段元数据。
	 * @param {MySqlTableQueryOptions} options 查询选项。
	 * @returns {string} ORDER BY SQL 片段。
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
	 * @param {Record<string, unknown>} row mysql2 返回的原始行。
	 * @returns {Record<string, MySqlTableCellValue>} 归一化后的行对象。
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
	 * @param {unknown} value 原始单元格值。
	 * @returns {MySqlTableCellValue} 归一化后的单元格值。
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
	 * 按旧 PPZ 的 Date 展示规则格式化 MySQL 日期时间值。
	 *
	 * @param {Date} value mysql2 返回的 Date 值。
	 * @param {MySqlTableColumnMetadata} column 当前字段元数据。
	 * @returns {string} 面向表数据页展示的本地时间字符串。
	 */
	private formatDateCellValue(
		value: Date,
		column?: MySqlTableColumnMetadata
	): string {
		const formattedValue = [
			this.padDatePart(value.getFullYear(), 4),
			'-',
			this.padDatePart(value.getMonth() + 1, 2),
			'-',
			this.padDatePart(value.getDate(), 2),
			' ',
			this.padDatePart(value.getHours(), 2),
			':',
			this.padDatePart(value.getMinutes(), 2),
			':',
			this.padDatePart(value.getSeconds(), 2),
			'.',
			this.padDatePart(value.getMilliseconds(), 3),
		].join('');
		const dataType = column?.dataType.toLowerCase();

		if (dataType === 'date') {
			return formattedValue.slice(0, 10);
		}

		if (dataType === 'datetime' || dataType === 'timestamp') {
			const precision = Math.min(
				Math.max(column?.dateTimePrecision ?? 0, 0),
				3
			);
			return formattedValue.slice(0, precision === 0 ? 19 : 20 + precision);
		}

		return formattedValue.slice(0, 19);
	}

	/**
	 * 将日期时间数字补齐到固定宽度。
	 *
	 * @param {number} value 日期时间数字片段。
	 * @param {number} width 目标宽度。
	 * @returns {string} 补零后的数字片段。
	 */
	private padDatePart(value: number, width: number): string {
		return String(value).padStart(width, '0');
	}

	/**
	 * 转义 MySQL 字符串字面量内容。
	 *
	 * @param {string} value 待转义的字符串。
	 * @returns {string} 转义后的字符串字面量内容。
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
	 * 将单个值格式化为展示 SQL 使用的字面量。
	 *
	 * @param {MySqlTableCellValue} value 待格式化的字段值。
	 * @returns {string} 仅用于展示的 SQL 字面量。
	 */
	private formatSqlLiteral(value: MySqlTableCellValue): string {
		if (value === null) {
			return 'NULL';
		}

		if (typeof value === 'number') {
			return String(value);
		}

		if (typeof value === 'boolean') {
			return value ? 'TRUE' : 'FALSE';
		}

		return `'${this.escapeSqlString(value)}'`;
	}

	/**
	 * 从 mysql2 执行结果中读取数字属性。
	 *
	 * @param {unknown} result mysql2 返回的执行结果。
	 * @param {string} propertyName 需要读取的属性名。
	 * @returns {number} 可用数字，不存在时返回 0。
	 */
	private readNumberProperty(result: unknown, propertyName: string): number {
		if (!result || typeof result !== 'object') {
			return 0;
		}

		const value = Reflect.get(result, propertyName);
		return typeof value === 'number' ? value : 0;
	}

	/**
	 * 从 COUNT 查询结果中读取总行数。
	 *
	 * @param {MySqlQueryRows} rows mysql2 返回的 COUNT 查询行。
	 * @returns {number} 当前查询条件下的总行数。
	 */
	private readTotalRowCount(rows: MySqlQueryRows): number {
		if (!Array.isArray(rows) || rows.length === 0) {
			return 0;
		}

		const firstRow = rows[0];
		if (!firstRow || typeof firstRow !== 'object') {
			return 0;
		}

		const value = Reflect.get(firstRow, 'totalRowCount');
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
	 * 从 mysql2 执行结果中读取 insertId。
	 *
	 * @param {unknown} result mysql2 返回的执行结果。
	 * @returns {string | number | null} 新增记录标识，不存在时返回 null。
	 */
	private readInsertId(result: unknown): string | number | null {
		if (!result || typeof result !== 'object') {
			return null;
		}

		const value = Reflect.get(result, 'insertId');
		if (typeof value === 'number' || typeof value === 'string') {
			return value;
		}

		if (typeof value === 'bigint') {
			return value.toString();
		}

		return null;
	}

	/**
	 * 转义 MySQL 标识符以便放入原始 SQL 字符串。
	 *
	 * @param {string} identifier 待转义的标识符。
	 * @returns {string} 转义后的标识符。
	 */
	private escapeIdentifier(identifier: string): string {
		return `\`${identifier.replaceAll('`', '``')}\``;
	}

	/**
	 * 转义完整 schema.table 引用以便用于原始 SQL。
	 *
	 * @param {string} schemaName 表所属的 schema。
	 * @param {string} tableName 选中的表名。
	 * @returns {string} 转义后的完整表名。
	 */
	private escapeQualifiedTableName(
		schemaName: string,
		tableName: string
	): string {
		return `${this.escapeIdentifier(schemaName)}.${this.escapeIdentifier(tableName)}`;
	}
}
