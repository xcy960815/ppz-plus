import type { MySqlSqlExecutor } from '../../application/mysql/MySqlSqlExecutor';
import type { MysqlConnectionConfig } from '../../domain/connections/ConnectionConfig';
import type {
	SqlExecutionCellValue,
	SqlExecutionField,
	SqlExecutionResult,
	SqlExecutionResultMetadataEntry,
	SqlExecutionResultSet,
} from '../../domain/query/SqlExecutionResult';
import { MySqlConnectionAdapter } from './MySqlConnectionAdapter';
import type { MySqlDriverOptions } from './MySqlConnectionAdapter';
import { MySqlRuntimeLoader } from './MySqlRuntimeLoader';
import type {
	MySqlField,
	MySqlQueryResultRow,
	MySqlQueryRows,
	MySqlQueryResultFields,
	MySqlRuntimeClient,
	MySqlStatementResult,
} from './MySqlRuntimeTypes';
import { formatDateCellValue } from '../shared/formatDateCellValue';
import { stringifyObjectValue } from '../shared/stringifyObjectValue';

/**
 * 通过 mysql2 promise 驱动执行 MySQL SQL。
 */
export class Mysql2SqlExecutor implements MySqlSqlExecutor {
	/** 保存数据库连接适配器以便创建运行时连接选项。 */
	public constructor(
		private readonly mySqlConnectionAdapter: MySqlConnectionAdapter,
		private readonly mySqlRuntimeLoader: MySqlRuntimeLoader
	) {}

	/**
	 * 执行 MySQL SQL 并返回统一结果模型。
	 *
	 * @param connection MySQL 连接配置。
	 * @param sql 用户输入的 SQL 文本。
	 * @returns 统一 SQL 执行结果。
	 */
	public async executeSql(
		connection: MysqlConnectionConfig,
		sql: string
	): Promise<SqlExecutionResult> {
		const startedAt = Date.now();
		let runtimeConnection: MySqlRuntimeClient | undefined;

		try {
			const mysql = await this.mySqlRuntimeLoader.loadMySqlPromiseModule();
			runtimeConnection = await mysql.createConnection(
				this.resolveSqlTerminalDriverOptions(connection)
			);
			const [rows, fields] = await runtimeConnection.query(sql);
			const durationMs = Date.now() - startedAt;
			const resultSets = this.normalizeResultSets(rows, fields);
			const primaryResultSet =
				resultSets[0] ?? this.createEmptyStatementResultSet();

			return {
				sql,
				success: true,
				isQuery: primaryResultSet.isQuery,
				fields: primaryResultSet.fields,
				rows: primaryResultSet.rows,
				affectedRows: primaryResultSet.affectedRows,
				durationMs,
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
			if (runtimeConnection) {
				try {
					await runtimeConnection.end();
				} catch {
					/** SQL 执行结果优先，关闭连接失败不覆盖主要结果。 */
				}
			}
		}
	}

	/**
	 * 为 SQL 终端开启 mysql2 多语句执行选项。
	 *
	 * @param connection MySQL 连接配置。
	 * @returns mysql2 可接收的 SQL 终端连接选项。
	 */
	private resolveSqlTerminalDriverOptions(
		connection: MysqlConnectionConfig
	): string | (MySqlDriverOptions & { readonly multipleStatements: true }) {
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

	/**
	 * 将 mysql2 rows/fields 返回值归一化为一个或多个 SQL 结果集。
	 *
	 * @param rows mysql2 返回的原始 rows。
	 * @param fields mysql2 返回的原始 fields。
	 * @returns 可供 SQL 终端渲染的结果集列表。
	 */
	private normalizeResultSets(
		rows: MySqlQueryRows,
		fields: MySqlQueryResultFields
	): readonly SqlExecutionResultSet[] {
		if (this.isMultipleStatementResult(rows, fields)) {
			return (rows as readonly (
				| MySqlQueryResultRow[]
				| MySqlStatementResult
			)[]).map((rowSet, index) =>
				this.normalizeResultSet(
					rowSet,
					Array.isArray(fields)
						? (fields as readonly (readonly MySqlField[] | undefined)[])[index]
						: (fields as readonly MySqlField[] | undefined)
				)
			);
		}

		return [
			this.normalizeResultSet(
				rows as MySqlQueryResultRow[],
				fields as readonly MySqlField[]
			),
		];
	}

	/**
	 * 判断 mysql2 返回值是否为多语句结果。
	 *
	 * @param rows mysql2 返回的原始 rows。
	 * @param fields mysql2 返回的原始 fields。
	 * @returns 是否包含多个结果集。
	 */
	private isMultipleStatementResult(
		rows: MySqlQueryRows,
		fields: MySqlQueryResultFields
	): boolean {
		if (!Array.isArray(rows)) {
			return false;
		}

		// 多语句时，rows 或 fields 的每个元素可能都是数组（每个语句一组结果）
		if (Array.isArray(fields)) {
			return fields.some(
				(fieldSet) => Array.isArray(fieldSet) || fieldSet === undefined
			);
		}

		return (
			fields === undefined &&
			rows.some((row) => !Array.isArray(row) && this.isStatementResult(row))
		);
	}

	/**
	 * 判断返回值是否更像 mysql2 的 StatementResult。
	 *
	 * @param value mysql2 返回的单个结果。
	 * @returns 是否包含非查询结果标志字段。
	 */
	private isStatementResult(
		value: unknown
	): value is MySqlStatementResult {
		return (
			value !== null &&
			typeof value === 'object' &&
			(
				'affectedRows' in value ||
				'insertId' in value ||
				'serverStatus' in value ||
				'warningStatus' in value
			)
		);
	}

	/**
	 * 归一化单个 SQL 结果集。
	 *
	 * @param rows mysql2 返回的单个 rows 或 StatementResult。
	 * @param fields mysql2 返回的单个 fields。
	 * @returns 单个 SQL 结果集。
	 */
	private normalizeResultSet(
		rows: readonly MySqlQueryResultRow[] | MySqlStatementResult,
		fields: readonly MySqlField[] | undefined
	): SqlExecutionResultSet {
		if (Array.isArray(rows)) {
			return {
				isQuery: true,
				fields: this.normalizeFields(fields, rows),
				rows: this.normalizeRows(rows),
				affectedRows: null,
				metadata: [],
			};
		}

		return {
			isQuery: false,
			fields: [],
			rows: [],
			affectedRows: this.extractAffectedRows(rows as MySqlStatementResult),
			metadata: this.normalizeMetadataFromStatementResult(
				rows as MySqlStatementResult
			),
		};
	}

	/**
	 * 创建空的语句结果集兜底。
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
	 * 将 mysql2 字段对象归一化为领域字段。
	 *
	 * @param fields mysql2 返回的字段元数据。
	 * @param rows mysql2 返回的原始行集合。
	 * @returns 可供 UI 和导出功能复用的字段列表。
	 */
	private normalizeFields(
		fields: readonly MySqlField[] | undefined,
		rows: readonly MySqlQueryResultRow[]
	): readonly SqlExecutionField[] {
		if (Array.isArray(fields)) {
			const fieldNames = this.normalizeFieldNames(fields);

			if (fieldNames.length > 0) {
				return fieldNames.map((name) => ({ name }));
			}
		}

		const firstRow = rows[0];
		return firstRow
			? Object.keys(firstRow).map((name) => ({ name }))
			: [];
	}

	/**
	 * 将 mysql2 字段数组归一化为字段名列表。
	 *
	 * @param fields mysql2 返回的字段元数据。
	 * @returns 字段名列表。
	 */
	private normalizeFieldNames(fields: readonly MySqlField[]): readonly string[] {
		return fields.map((field) => field.name);
	}

	/**
	 * 将 mysql2 行集合归一化为可安全渲染的记录数组。
	 *
	 * @param rows mysql2 返回的原始行集合。
	 * @returns 可序列化的 SQL 行数据。
	 */
	private normalizeRows(
		rows: readonly MySqlQueryResultRow[]
	): readonly Record<string, SqlExecutionCellValue>[] {
		return rows
			.filter(
				(row): row is Record<string, unknown> =>
					row !== null && typeof row === 'object' && !Array.isArray(row)
			)
			.map((row) => this.normalizeRow(row));
	}

	/**
	 * 将单条 mysql2 行归一化为可序列化对象。
	 *
	 * @param row mysql2 返回的原始行。
	 * @returns 可渲染的行对象。
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
	 * 将 mysql2 单元格值归一化为 Webview 可安全展示的值。
	 *
	 * @param value 原始单元格值。
	 * @returns 可序列化单元格值。
	 */
	private normalizeCellValue(value: unknown): SqlExecutionCellValue {
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
			return formatDateCellValue(value);
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

		if (value !== null && typeof value === 'object') {
			return stringifyObjectValue(value);
		}

		return String(value);
	}

	/**
	 * 从非查询结果中提取影响行数。
	 *
	 * @param result mysql2 返回的非查询执行结果。
	 * @returns 影响行数；无法识别时返回 null。
	 */
	private extractAffectedRows(
		result: MySqlStatementResult
	): number | null {
		return typeof result.affectedRows === 'number' ? result.affectedRows : null;
	}

	/**
	 * 将 mysql2 非查询执行摘要归一化为 key/value 列表。
	 *
	 * @param result mysql2 返回的非查询执行结果。
	 * @returns 可供旧 PPZ 风格 key/value 表格展示的执行摘要。
	 */
	private normalizeMetadataFromStatementResult(
		result: MySqlStatementResult
	): readonly SqlExecutionResultMetadataEntry[] {
		// mysql2 非查询结果字段随驱动版本可能扩展，这里保留旧 PPZ 的全量摘要展示策略。
		return Object.entries(result).map(([key, value]) => ({
			key,
			value: this.normalizeCellValue(value),
		}));
	}

	/**
	 * 在执行失败时根据 SQL 起始关键字粗略判断是否为查询。
	 *
	 * @param sql 用户输入的 SQL 文本。
	 * @returns 是否看起来像查询 SQL。
	 */
	private inferQuerySql(sql: string): boolean {
		const firstKeyword = sql.trimStart().match(/^[a-z]+/i)?.[0].toUpperCase();
		return [
			'SELECT',
			'SHOW',
			'DESCRIBE',
			'DESC',
			'EXPLAIN',
			'WITH',
			'TABLE',
			'VALUES',
		].includes(firstKeyword ?? '');
	}
}
