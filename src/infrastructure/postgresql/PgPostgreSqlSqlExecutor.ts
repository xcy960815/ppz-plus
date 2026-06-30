import type { PostgreSqlSqlExecutor } from '../../application/postgresql/PostgreSqlSqlExecutor';
import type { PostgreSqlConnectionConfig } from '../../domain/connections/ConnectionConfig';
import type {
	SqlExecutionCellValue,
	SqlExecutionField,
	SqlExecutionResult,
	SqlExecutionResultMetadataEntry,
	SqlExecutionResultSet,
} from '../../domain/query/SqlExecutionResult';
import { PostgreSqlConnectionAdapter } from './PostgreSqlConnectionAdapter';
import type { PgRuntimeClient, PgQueryResult } from './PgRuntimeTypes';
import { PostgreSqlRuntimeLoader } from './PostgreSqlRuntimeLoader';

/**
 * 通过 pg 驱动执行 PostgreSQL SQL。
 */
export class PgPostgreSqlSqlExecutor implements PostgreSqlSqlExecutor {
	/**
	 * 创建基于 pg 的 SQL 执行器。
	 *
	 * @param postgreSqlConnectionAdapter 用于归一化连接选项的适配器。
	 * @param postgreSqlRuntimeLoader 用于延迟解析 pg 运行时的加载器。
	 */
	public constructor(
		private readonly postgreSqlConnectionAdapter: PostgreSqlConnectionAdapter,
		private readonly postgreSqlRuntimeLoader: PostgreSqlRuntimeLoader
	) {}

	/**
	 * 执行 PostgreSQL SQL 并返回统一结果模型。
	 *
	 * @param connection PostgreSQL 连接配置。
	 * @param databaseName 本次执行要连接的 database。
	 * @param sql 用户输入的 SQL 文本。
	 * @returns 统一 SQL 执行结果。
	 */
	public async executeSql(
		connection: PostgreSqlConnectionConfig,
		databaseName: string | undefined,
		sql: string
	): Promise<SqlExecutionResult> {
		const startedAt = Date.now();
		let runtimeClient: PgRuntimeClient | undefined;

		try {
			const postgreSql = this.postgreSqlRuntimeLoader.loadPostgreSqlModule();
			runtimeClient = new postgreSql.Client(
				this.postgreSqlConnectionAdapter.resolveDriverOptions(
					connection,
					databaseName
				)
			);
			await runtimeClient.connect();

			const rawResult: PgQueryResult | readonly PgQueryResult[] = await runtimeClient.query(sql) as PgQueryResult | readonly PgQueryResult[];
			const durationMs = Date.now() - startedAt;
			const resultSets = this.normalizeResultSets(rawResult);
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
			if (runtimeClient) {
				try {
					await runtimeClient.end();
				} catch {
					/**
					 * SQL 执行结果优先，关闭连接失败不覆盖主要结果。
					 */
				}
			}
		}
	}

	/**
	 * 将 pg 返回值归一化为一个或多个 SQL 结果集。
	 *
	 * 单语句时返回 PgQueryResult，
	 * 多语句时 pg 的 query 方法返回 PgQueryResult[]。
	 *
	 * @param rawResult pg 返回的原始结果。
	 * @returns 可供 SQL 终端渲染的结果集列表。
	 */
	private normalizeResultSets(
		rawResult: PgQueryResult | readonly PgQueryResult[]
	): readonly SqlExecutionResultSet[] {
		if (Array.isArray(rawResult)) {
			return rawResult.map((result) => this.normalizeResultSet(result));
		}

		return [this.normalizeResultSet(rawResult as PgQueryResult)];
	}

	/**
	 * 归一化单个 pg 执行结果。
	 *
	 * @param rawResult pg 返回的单个结果。
	 * @returns 单个 SQL 结果集。
	 */
	private normalizeResultSet(rawResult: PgQueryResult): SqlExecutionResultSet {
		const rows = this.readRows(rawResult);
		const fields = this.normalizeFields(rawResult.fields, rows);
		const isQuery = fields.length > 0;

		if (isQuery) {
			return {
				isQuery: true,
				fields,
				rows: this.normalizeRows(rows),
				affectedRows: null,
				metadata: [],
			};
		}

		return {
			isQuery: false,
			fields: [],
			rows: [],
			affectedRows: this.normalizeAffectedRows(rawResult),
			metadata: this.normalizeMetadata(rawResult),
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
	 * 从 pg 结果中读取原始行集合。
	 *
	 * @param rawResult pg 返回的单个结果。
	 * @returns 原始行集合。
	 */
	private readRows(
		rawResult: PgQueryResult
	): readonly Record<string, unknown>[] {
		return Array.isArray(rawResult.rows)
			? (rawResult.rows as readonly Record<string, unknown>[])
			: [];
	}

	/**
	 * 将 pg 字段对象归一化为领域字段。
	 *
	 * @param rawFields pg 返回的字段定义。
	 * @param rows pg 返回的原始行集合。
	 * @returns 可供 UI 和导出功能复用的字段列表。
	 */
	private normalizeFields(
		rawFields: readonly { name: string }[],
		rows: readonly Record<string, unknown>[]
	): readonly SqlExecutionField[] {
		if (Array.isArray(rawFields)) {
			const fieldNames = rawFields
				.map((field) => (typeof field.name === 'string' ? field.name : undefined))
				.filter((name): name is string => name !== undefined);

			if (fieldNames.length > 0) {
				return fieldNames.map((name) => ({ name }));
			}
		}

		const firstRow = rows[0];
		return firstRow ? Object.keys(firstRow).map((name) => ({ name })) : [];
	}

	/**
	 * 将 pg 行集合归一化为可安全渲染的记录数组。
	 *
	 * @param rows pg 返回的原始行集合。
	 * @returns 可序列化的 SQL 行数据。
	 */
	private normalizeRows(
		rows: readonly Record<string, unknown>[]
	): readonly Record<string, SqlExecutionCellValue>[] {
		return rows.map((row) => this.normalizeRow(row));
	}

	/**
	 * 将单条 pg 行归一化为可序列化对象。
	 *
	 * @param row pg 返回的原始行。
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
	 * 将 pg 单元格值归一化为 Webview 可安全展示的值。
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
			return this.formatDateCellValue(value);
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
				return JSON.stringify(value);
			} catch {
				return String(value);
			}
		}

		return String(value);
	}

	/**
	 * 按旧 PPZ 的本地时间展示规则格式化 SQL 执行结果中的 Date。
	 *
	 * @param value pg 返回的 Date 值。
	 * @returns 面向 SQL 结果表展示的本地时间字符串。
	 */
	private formatDateCellValue(value: Date): string {
		return [
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
	}

	/**
	 * 将日期时间数字补齐到固定宽度。
	 *
	 * @param value 日期时间数字片段。
	 * @param width 目标宽度。
	 * @returns 补零后的数字片段。
	 */
	private padDatePart(value: number, width: number): string {
		return String(value).padStart(width, '0');
	}

	/**
	 * 从非查询结果中提取影响行数。
	 *
	 * @param rawResult pg 返回的非查询执行结果。
	 * @returns 影响行数；无法识别时返回 null。
	 */
	private normalizeAffectedRows(rawResult: PgQueryResult): number | null {
		return typeof rawResult.rowCount === 'number' ? rawResult.rowCount : null;
	}

	/**
	 * 将 pg 非查询执行摘要归一化为 key/value 列表。
	 *
	 * @param rawResult pg 返回的非查询执行结果。
	 * @returns 可供旧 PPZ 风格 key/value 表格展示的执行摘要。
	 */
	private normalizeMetadata(
		rawResult: PgQueryResult
	): readonly SqlExecutionResultMetadataEntry[] {
		return ['command', 'rowCount', 'oid']
			.map((key) => {
				const value = (rawResult as unknown as Record<string, unknown>)[key];
				return value === undefined
					? undefined
					: {
							key,
							value: this.normalizeCellValue(value),
						};
			})
			.filter(
				(
					entry
				): entry is SqlExecutionResultMetadataEntry =>
					entry !== undefined
			);
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
			'EXPLAIN',
			'WITH',
			'TABLE',
			'VALUES',
		].includes(firstKeyword ?? '');
	}
}
