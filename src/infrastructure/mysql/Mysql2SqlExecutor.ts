import type { MySqlSqlExecutor } from '../../application/mysql/MySqlSqlExecutor';
import type { MysqlConnectionConfig } from '../../domain/connections/ConnectionConfig';
import type {
	SqlExecutionCellValue,
	SqlExecutionField,
	SqlExecutionResult,
} from '../../domain/query/SqlExecutionResult';
import { MySqlConnectionAdapter } from './MySqlConnectionAdapter';
import { MySqlRuntimeLoader } from './MySqlRuntimeLoader';

/**
 * 通过 mysql2 promise 驱动执行 MySQL SQL。
 */
export class Mysql2SqlExecutor implements MySqlSqlExecutor {
	/**
	 * 创建基于 mysql2 的 SQL 执行器。
	 *
	 * @param mySqlConnectionAdapter 用于归一化连接选项的适配器。
	 * @param mySqlRuntimeLoader 用于延迟解析 mysql2 运行时的加载器。
	 */
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
		let runtimeConnection:
			| {
					query(
						sql: string,
						values?: readonly unknown[]
					): Promise<[unknown, unknown]>;
					end(): Promise<void>;
			  }
			| undefined;

		try {
			const mysql = await this.mySqlRuntimeLoader.loadMySqlPromiseModule();
			runtimeConnection = await mysql.createConnection(
				this.mySqlConnectionAdapter.resolveDriverOptions(connection)
			);
			const [rows, fields] = await runtimeConnection.query(sql);
			const durationMs = Date.now() - startedAt;
			const isQuery = Array.isArray(rows);

			return {
				sql,
				success: true,
				isQuery,
				fields: isQuery ? this.normalizeFields(fields, rows) : [],
				rows: isQuery ? this.normalizeRows(rows) : [],
				affectedRows: isQuery ? null : this.normalizeAffectedRows(rows),
				durationMs,
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
				errorMessage: error instanceof Error ? error.message : String(error),
			};
		} finally {
			if (runtimeConnection) {
				try {
					await runtimeConnection.end();
				} catch {
					/**
					 * SQL 执行结果优先，关闭连接失败不覆盖主要结果。
					 */
				}
			}
		}
	}

	/**
	 * 将 mysql2 字段对象归一化为领域字段。
	 *
	 * @param fields mysql2 返回的字段元数据。
	 * @param rows mysql2 返回的原始行集合。
	 * @returns 可供 UI 和导出功能复用的字段列表。
	 */
	private normalizeFields(
		fields: unknown,
		rows: unknown
	): readonly SqlExecutionField[] {
		if (Array.isArray(fields)) {
			const fieldNames = fields
				.map((field) => {
					if (!field || typeof field !== 'object') {
						return undefined;
					}

					const name = Reflect.get(field, 'name');
					return typeof name === 'string' ? name : undefined;
				})
				.filter((name): name is string => name !== undefined);

			if (fieldNames.length > 0) {
				return fieldNames.map((name) => ({ name }));
			}
		}

		const firstRow = Array.isArray(rows) ? rows[0] : undefined;
		if (firstRow && typeof firstRow === 'object' && !Array.isArray(firstRow)) {
			return Object.keys(firstRow).map((name) => ({ name }));
		}

		return [];
	}

	/**
	 * 将 mysql2 行集合归一化为可安全渲染的记录数组。
	 *
	 * @param rows mysql2 返回的原始行集合。
	 * @returns 可序列化的 SQL 行数据。
	 */
	private normalizeRows(
		rows: unknown
	): readonly Record<string, SqlExecutionCellValue>[] {
		if (!Array.isArray(rows)) {
			return [];
		}

		return rows
			.filter(
				(row): row is Record<string, unknown> =>
					Boolean(row) && typeof row === 'object' && !Array.isArray(row)
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
				return JSON.stringify(value);
			} catch {
				return String(value);
			}
		}

		return String(value);
	}

	/**
	 * 从非查询结果中提取影响行数。
	 *
	 * @param result mysql2 返回的非查询执行结果。
	 * @returns 影响行数；无法识别时返回 null。
	 */
	private normalizeAffectedRows(result: unknown): number | null {
		if (!result || typeof result !== 'object') {
			return null;
		}

		const affectedRows = Reflect.get(result, 'affectedRows');
		return typeof affectedRows === 'number' ? affectedRows : null;
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
