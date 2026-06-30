import type {
	PostgreSqlExportDatabaseTarget,
	PostgreSqlExportProvider,
	PostgreSqlExportSchemaTarget,
	PostgreSqlExportTableTarget,
} from '../../application/postgresql/PostgreSqlExportProvider';
import type { PostgreSqlConnectionConfig } from '../../domain/connections/ConnectionConfig';
import type {
	SqlExportDocument,
	SqlExportKind,
	SqlExportSchemaTarget,
	SqlExportTableTarget,
} from '../../domain/export/SqlExportDocument';
import { SQL_EXPORT_FORMAT } from '../../domain/export/SqlExportFormat';
import { PostgreSqlConnectionAdapter } from './PostgreSqlConnectionAdapter';
import type { PgRuntimeClient } from './PgRuntimeTypes';
import { PostgreSqlRuntimeLoader } from './PostgreSqlRuntimeLoader';

/**
 * 描述 PostgreSQL 字段 DDL 元数据。
 */
interface PostgreSqlColumnDefinition {
	readonly columnName: string;
	readonly dataType: string;
	readonly notNull: boolean;
	readonly defaultExpression: string | null;
	readonly identityKind: string;
	readonly generatedKind: string;
}

/**
 * 描述 PostgreSQL 约束 DDL 元数据。
 */
interface PostgreSqlConstraintDefinition {
	readonly constraintName: string;
	readonly constraintDefinition: string;
}

/**
 * 描述 PostgreSQL 索引 DDL 元数据。
 */
interface PostgreSqlIndexDefinition {
	readonly indexName: string;
	readonly indexDefinition: string;
}

/**
 * 描述 PostgreSQL 字段拥有的 sequence DDL 元数据。
 */
interface PostgreSqlSequenceDefinition {
	readonly sequenceSchemaName: string;
	readonly sequenceName: string;
	readonly columnName: string;
	readonly dataType: string;
	readonly startValue: string;
	readonly incrementValue: string;
	readonly minimumValue: string;
	readonly maximumValue: string;
	readonly cacheSize: string;
	readonly cycle: boolean;
}

/**
 * 描述 schema/database 导出时的 DDL 组织选项。
 */
interface PostgreSqlDdlBlockOptions {
	readonly includeForeignKeys: boolean;
}

/**
 * 通过 pg 驱动生成 PostgreSQL DDL/DML。
 */
export class PgPostgreSqlExportProvider implements PostgreSqlExportProvider {
	/**
	 * 创建基于 pg 的导出提供者。
	 *
	 * @param postgreSqlConnectionAdapter 用于归一化连接选项的适配器。
	 * @param postgreSqlRuntimeLoader 用于延迟解析 pg 运行时的加载器。
	 */
	public constructor(
		private readonly postgreSqlConnectionAdapter: PostgreSqlConnectionAdapter,
		private readonly postgreSqlRuntimeLoader: PostgreSqlRuntimeLoader
	) {}

	/**
	 * 导出指定 PostgreSQL 表的 SQL 文档。
	 *
	 * @param connection PostgreSQL 连接配置。
	 * @param target 表级导出目标。
	 * @param kind 导出的 SQL 内容类型。
	 * @returns 生成后的 SQL 导出文档。
	 */
	public async exportTable(
		connection: PostgreSqlConnectionConfig,
		target: PostgreSqlExportTableTarget,
		kind: SqlExportKind
	): Promise<SqlExportDocument> {
		const client = await this.openClient(connection, target.databaseName);

		try {
			const blocks: string[] = [
				this.renderTableHeader(connection.name, target, kind),
			];

			if (kind === 'ddl' || kind === 'both') {
				blocks.push(this.renderCreateSchemaStatement(target.schemaName));
				blocks.push(this.renderSetSearchPathStatement(target.schemaName));
				blocks.push(
					await this.exportDdl(client, target, {
						includeForeignKeys: true,
					})
				);
			}

			if (kind === 'dml' || kind === 'both') {
				blocks.push(await this.exportDml(client, target));
			}

			blocks.push(this.renderFooter());

			return {
				title: `${target.databaseName}.${target.schemaName}.${target.tableName}.${kind}.sql`,
				format: SQL_EXPORT_FORMAT.id,
				kind,
				target,
				content: `${blocks.join('\n\n')}\n`,
			};
		} finally {
			await this.closeClient(client);
		}
	}

	/**
	 * 导出指定 PostgreSQL schema 的 SQL 文档。
	 *
	 * @param connection PostgreSQL 连接配置。
	 * @param target schema 级导出目标。
	 * @param kind 导出的 SQL 内容类型。
	 * @returns 生成后的 SQL 导出文档。
	 */
	public async exportSchema(
		connection: PostgreSqlConnectionConfig,
		target: PostgreSqlExportSchemaTarget,
		kind: SqlExportKind
	): Promise<SqlExportDocument> {
		const client = await this.openClient(connection, target.databaseName);

		try {
			const schemaName = target.schemaName;
			const tableTargets = (await this.listSchemaTables(client, target)).map(
				(tableName) => ({
					databaseName: target.databaseName,
					schemaName,
					tableName,
				})
			);
			const blocks: string[] = [
				this.renderSchemaHeader(connection.name, target, kind),
			];

			if (kind === 'ddl' || kind === 'both') {
				blocks.push(this.renderCreateSchemaStatement(schemaName));
				blocks.push(this.renderSetSearchPathStatement(schemaName));
			}

			if (tableTargets.length === 0) {
				blocks.push(
					`-- ${target.databaseName}.${target.schemaName} 中未找到基础表。`
				);
			}

			for (const tableTarget of tableTargets) {
				blocks.push(
					await this.exportTableBlock(client, tableTarget, kind, {
						includeForeignKeys: false,
					})
				);
			}

			if ((kind === 'ddl' || kind === 'both') && tableTargets.length > 0) {
				blocks.push(await this.exportForeignKeys(client, tableTargets));
			}

			blocks.push(this.renderFooter());

			return {
				title: `${target.databaseName}.${target.schemaName}.${kind}.sql`,
				format: SQL_EXPORT_FORMAT.id,
				kind,
				target,
				content: `${blocks.join('\n\n')}\n`,
			};
		} finally {
			await this.closeClient(client);
		}
	}

	/**
	 * 导出指定 PostgreSQL database 的 SQL 文档。
	 *
	 * @param connection PostgreSQL 连接配置。
	 * @param target database 级导出目标。
	 * @param kind 导出的 SQL 内容类型。
	 * @returns 生成后的 SQL 导出文档。
	 */
	public async exportDatabase(
		connection: PostgreSqlConnectionConfig,
		target: PostgreSqlExportDatabaseTarget,
		kind: SqlExportKind
	): Promise<SqlExportDocument> {
		const client = await this.openClient(connection, target.databaseName);

		try {
			const tables = await this.listDatabaseTables(client);
			const tableTargets = tables.map((table) => ({
				databaseName: target.databaseName,
				schemaName: table.schemaName,
				tableName: table.tableName,
			}));
			const blocks: string[] = [
				this.renderDatabaseHeader(connection.name, target, kind),
			];

			if (kind === 'ddl' || kind === 'both') {
				const schemaNames = await this.listDatabaseSchemas(client);
				if (schemaNames.length === 0) {
					blocks.push(`-- ${target.databaseName} 中未找到可导出的 schema。`);
				}

				blocks.push(...schemaNames.map((schemaName) => (
					this.renderCreateSchemaStatement(schemaName)
				)));
			}

			if (tableTargets.length === 0) {
				blocks.push(`-- ${target.databaseName} 中未找到基础表。`);
			}

			for (const tableTarget of tableTargets) {
				blocks.push(
					await this.exportTableBlock(client, tableTarget, kind, {
						includeForeignKeys: false,
					})
				);
			}

			if ((kind === 'ddl' || kind === 'both') && tableTargets.length > 0) {
				blocks.push(await this.exportForeignKeys(client, tableTargets));
			}

			blocks.push(this.renderFooter());

			return {
				title: `${target.databaseName}.${kind}.sql`,
				format: SQL_EXPORT_FORMAT.id,
				kind,
				target,
				content: `${blocks.join('\n\n')}\n`,
			};
		} finally {
			await this.closeClient(client);
		}
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
	): Promise<PgRuntimeClient> {
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
	 * 关闭 pg 客户端连接。
	 *
	 * @param client 当前可用的 pg 客户端。
	 */
	private async closeClient(client: PgRuntimeClient): Promise<void> {
		try {
			await client.end();
		} catch {
			/**
			 * 导出内容生成结果优先，关闭连接失败不覆盖主要结果。
			 */
		}
	}

	/**
	 * 生成表级导出文档头部注释。
	 *
	 * @param connectionName 当前连接显示名。
	 * @param target 表级导出目标。
	 * @param kind 导出的 SQL 内容类型。
	 * @returns SQL 注释头。
	 */
	private renderTableHeader(
		connectionName: string,
		target: PostgreSqlExportTableTarget,
		kind: SqlExportKind
	): string {
		return [
			`-- PPZ Plus PostgreSQL ${kind.toUpperCase()} export`,
			`-- Connection: ${connectionName}`,
			`-- Database: ${target.databaseName}`,
			`-- Table: ${this.renderQualifiedTableLabel(target)}`,
		].join('\n');
	}

	/**
	 * 生成 schema 级导出文档头部注释。
	 *
	 * @param connectionName 当前连接显示名。
	 * @param target schema 级导出目标。
	 * @param kind 导出的 SQL 内容类型。
	 * @returns SQL 注释头。
	 */
	private renderSchemaHeader(
		connectionName: string,
		target: PostgreSqlExportSchemaTarget,
		kind: SqlExportKind
	): string {
		return [
			`-- PPZ Plus PostgreSQL ${kind.toUpperCase()} export`,
			`-- Connection: ${connectionName}`,
			`-- Database: ${target.databaseName}`,
			`-- Schema: ${target.schemaName}`,
		].join('\n');
	}

	/**
	 * 生成 database 级导出文档头部注释。
	 *
	 * @param connectionName 当前连接显示名。
	 * @param target database 级导出目标。
	 * @param kind 导出的 SQL 内容类型。
	 * @returns SQL 注释头。
	 */
	private renderDatabaseHeader(
		connectionName: string,
		target: PostgreSqlExportDatabaseTarget,
		kind: SqlExportKind
	): string {
		return [
			`-- PPZ Plus PostgreSQL ${kind.toUpperCase()} export`,
			`-- Connection: ${connectionName}`,
			`-- Database: ${target.databaseName}`,
		].join('\n');
	}

	/**
	 * 生成 PostgreSQL schema 创建语句。
	 *
	 * @param schemaName schema 名称。
	 * @returns CREATE SCHEMA SQL。
	 */
	private renderCreateSchemaStatement(schemaName: string): string {
		return `CREATE SCHEMA IF NOT EXISTS ${this.escapeIdentifier(schemaName)};`;
	}

	/**
	 * 生成 PostgreSQL search_path 设置语句。
	 *
	 * 确保后续 DDL 语句（CREATE TABLE / CREATE INDEX / ALTER TABLE）
	 * 作用于目标 schema，而不是默认的 public 或用户同名 schema。
	 *
	 * @param schemaName schema 名称。
	 * @returns SET search_path SQL。
	 */
	private renderSetSearchPathStatement(schemaName: string): string {
		return `SET search_path TO ${this.escapeIdentifier(schemaName)};`;
	}

	/**
	 * 生成导出文件尾部注释。
	 *
	 * @returns 导出文件尾部 SQL。
	 */
	private renderFooter(): string {
		return '-- PPZ Plus PostgreSQL export completed.';
	}

	/**
	 * 导出单个表在聚合导出文档中的 SQL 块。
	 *
	 * @param client 当前可用的 pg 客户端。
	 * @param target 表级导出目标。
	 * @param kind 导出的 SQL 内容类型。
	 * @param options DDL 块组织选项。
	 * @returns 单表 SQL 文本块。
	 */
	private async exportTableBlock(
		client: PgRuntimeClient,
		target: PostgreSqlExportTableTarget,
		kind: SqlExportKind,
		options: PostgreSqlDdlBlockOptions
	): Promise<string> {
		const blocks = [
			`-- Table: ${this.renderQualifiedTableLabel(target)}`,
			this.renderSetSearchPathStatement(target.schemaName),
		];

		if (kind === 'ddl' || kind === 'both') {
			blocks.push(await this.exportDdl(client, target, options));
		}

		if (kind === 'dml' || kind === 'both') {
			blocks.push(await this.exportDml(client, target));
		}

		return blocks.join('\n\n');
	}

	/**
	 * 列出 schema 下可导出的基础表。
	 *
	 * @param client 当前可用的 pg 客户端。
	 * @param target schema 级导出目标。
	 * @returns 表名列表。
	 */
	private async listSchemaTables(
		client: PgRuntimeClient,
		target: PostgreSqlExportSchemaTarget
	): Promise<readonly string[]> {
		const result = await client.query(
			[
				'SELECT table_name AS name',
				'FROM information_schema.tables',
				'WHERE table_schema = $1',
				"AND table_type = 'BASE TABLE'",
				'ORDER BY table_name',
			].join(' '),
			[target.schemaName]
		);

		return result.rows
			.map((row) => (typeof row.name === 'string' ? row.name : undefined))
			.filter((tableName): tableName is string => tableName !== undefined);
	}

	/**
	 * 列出 database 下所有可导出的用户 schema。
	 *
	 * @param client 当前可用的 pg 客户端。
	 * @returns 按名称排序的 schema 名称列表。
	 */
	private async listDatabaseSchemas(
		client: PgRuntimeClient
	): Promise<readonly string[]> {
		const result = await client.query(
			[
				'SELECT nspname AS "schemaName"',
				'FROM pg_catalog.pg_namespace',
				"WHERE nspname <> 'information_schema'",
				"AND nspname NOT LIKE 'pg_%'",
				'ORDER BY nspname',
			].join(' ')
		);

		return result.rows
			.map((row) => (
				typeof row.schemaName === 'string' ? row.schemaName : undefined
			))
			.filter((schemaName): schemaName is string => schemaName !== undefined);
	}

	/**
	 * 列出 database 下所有可导出的基础表。
	 *
	 * @param client 当前可用的 pg 客户端。
	 * @returns 按 schema/table 排序的表目标列表。
	 */
	private async listDatabaseTables(
		client: PgRuntimeClient
	): Promise<readonly SqlExportTableTarget[]> {
		const result = await client.query(
			[
				'SELECT table_schema AS "schemaName",',
				'table_name AS "tableName"',
				'FROM information_schema.tables',
				"WHERE table_type = 'BASE TABLE'",
				"AND table_schema NOT IN ('pg_catalog', 'information_schema')",
				"AND table_schema NOT LIKE 'pg_toast%'",
				"AND table_schema NOT LIKE 'pg_%'",
				'ORDER BY table_schema, table_name',
			].join(' ')
		);

		return result.rows
			.map((row) => {
				const schemaName = row.schemaName;
				const tableName = row.tableName;

				return typeof schemaName === 'string' && typeof tableName === 'string'
					? { schemaName, tableName }
					: undefined;
			})
			.filter((
				table
			): table is SqlExportTableTarget => table !== undefined);
	}

	/**
	 * 导出指定表的 DDL。
	 *
	 * @param client 当前可用的 pg 客户端。
	 * @param target 表级导出目标。
	 * @param options DDL 块组织选项。
	 * @returns DDL SQL 文本。
	 */
	private async exportDdl(
		client: PgRuntimeClient,
		target: PostgreSqlExportTableTarget,
		options: PostgreSqlDdlBlockOptions
	): Promise<string> {
		const sequences = await this.listOwnedSequences(client, target);
		const columns = await this.listColumns(client, target);
		const primaryKeys = await this.listPrimaryKeys(client, target);
		const indexes = await this.listIndexes(client, target);
		const blocks = [];

		if (sequences.length > 0) {
			blocks.push(sequences.map((sequence) => (
				this.renderCreateSequenceStatement(sequence)
			)).join('\n'));
		}

		blocks.push(this.renderCreateTableStatement(target, columns, primaryKeys));

		if (sequences.length > 0) {
			blocks.push(sequences.map((sequence) => (
				this.renderSequenceOwnershipStatement(target, sequence)
			)).join('\n'));
		}

		if (indexes.length > 0) {
			blocks.push(indexes.map((index) => (
				this.renderIndexStatement(index)
			)).join('\n'));
		}

		if (options.includeForeignKeys) {
			const foreignKeys = await this.listForeignKeys(client, target);
			if (foreignKeys.length > 0) {
				blocks.push(this.renderForeignKeyStatements(target, foreignKeys));
			}
		}

		return blocks.join('\n\n');
	}

	/**
	 * 读取 PostgreSQL 表字段元数据。
	 *
	 * @param client 当前可用的 pg 客户端。
	 * @param target 表级导出目标。
	 * @returns 字段定义列表。
	 */
	private async listColumns(
		client: PgRuntimeClient,
		target: PostgreSqlExportTableTarget
	): Promise<readonly PostgreSqlColumnDefinition[]> {
		const result = await client.query(
			[
				'SELECT a.attname AS "columnName",',
				'pg_catalog.format_type(a.atttypid, a.atttypmod) AS "dataType",',
				'a.attnotnull AS "notNull",',
				'pg_catalog.pg_get_expr(ad.adbin, ad.adrelid) AS "defaultExpression",',
				'a.attidentity AS "identityKind",',
				'a.attgenerated AS "generatedKind"',
				'FROM pg_catalog.pg_attribute a',
				'JOIN pg_catalog.pg_class c ON c.oid = a.attrelid',
				'JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace',
				'LEFT JOIN pg_catalog.pg_attrdef ad',
				'ON ad.adrelid = a.attrelid AND ad.adnum = a.attnum',
				'WHERE n.nspname = $1',
				'AND c.relname = $2',
				"AND c.relkind IN ('r', 'p')",
				'AND a.attnum > 0',
				'AND NOT a.attisdropped',
				'ORDER BY a.attnum',
			].join(' '),
			[target.schemaName, target.tableName]
		);

		return result.rows
			.map((row) => this.normalizeColumnDefinition(row))
			.filter((
				column
			): column is PostgreSqlColumnDefinition => column !== undefined);
	}

	/**
	 * 读取 PostgreSQL 表主键约束。
	 *
	 * @param client 当前可用的 pg 客户端。
	 * @param target 表级导出目标。
	 * @returns 主键约束定义列表。
	 */
	private async listPrimaryKeys(
		client: PgRuntimeClient,
		target: PostgreSqlExportTableTarget
	): Promise<readonly PostgreSqlConstraintDefinition[]> {
		return this.listConstraints(client, target, 'p');
	}

	/**
	 * 读取 PostgreSQL 表外键约束。
	 *
	 * @param client 当前可用的 pg 客户端。
	 * @param target 表级导出目标。
	 * @returns 外键约束定义列表。
	 */
	private async listForeignKeys(
		client: PgRuntimeClient,
		target: PostgreSqlExportTableTarget
	): Promise<readonly PostgreSqlConstraintDefinition[]> {
		return this.listConstraints(client, target, 'f');
	}

	/**
	 * 读取 PostgreSQL 表约束定义。
	 *
	 * @param client 当前可用的 pg 客户端。
	 * @param target 表级导出目标。
	 * @param constraintType PostgreSQL 约束类型标识。
	 * @returns 约束定义列表。
	 */
	private async listConstraints(
		client: PgRuntimeClient,
		target: PostgreSqlExportTableTarget,
		constraintType: 'p' | 'f'
	): Promise<readonly PostgreSqlConstraintDefinition[]> {
		const result = await client.query(
			[
				'SELECT con.conname AS "constraintName",',
				'pg_catalog.pg_get_constraintdef(con.oid, true) AS "constraintDefinition"',
				'FROM pg_catalog.pg_constraint con',
				'JOIN pg_catalog.pg_class c ON c.oid = con.conrelid',
				'JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace',
				'WHERE n.nspname = $1',
				'AND c.relname = $2',
				'AND con.contype = $3',
				'ORDER BY con.conname',
			].join(' '),
			[target.schemaName, target.tableName, constraintType]
		);

		return result.rows
			.map((row) => this.normalizeConstraintDefinition(row))
			.filter((
				constraint
			): constraint is PostgreSqlConstraintDefinition => (
				constraint !== undefined
			));
	}

	/**
	 * 读取 PostgreSQL 表索引定义。
	 *
	 * @param client 当前可用的 pg 客户端。
	 * @param target 表级导出目标。
	 * @returns 索引定义列表。
	 */
	private async listIndexes(
		client: PgRuntimeClient,
		target: PostgreSqlExportTableTarget
	): Promise<readonly PostgreSqlIndexDefinition[]> {
		const result = await client.query(
			[
				'SELECT ci.relname AS "indexName",',
				'pg_catalog.pg_get_indexdef(idx.indexrelid) AS "indexDefinition"',
				'FROM pg_catalog.pg_index idx',
				'JOIN pg_catalog.pg_class ct ON ct.oid = idx.indrelid',
				'JOIN pg_catalog.pg_namespace n ON n.oid = ct.relnamespace',
				'JOIN pg_catalog.pg_class ci ON ci.oid = idx.indexrelid',
				'LEFT JOIN pg_catalog.pg_constraint con',
				"ON con.conindid = idx.indexrelid AND con.contype = 'p'",
				'WHERE n.nspname = $1',
				'AND ct.relname = $2',
				'AND con.oid IS NULL',
				'ORDER BY ci.relname',
			].join(' '),
			[target.schemaName, target.tableName]
		);

		return result.rows
			.map((row) => this.normalizeIndexDefinition(row))
			.filter((
				index
			): index is PostgreSqlIndexDefinition => index !== undefined);
	}

	/**
	 * 读取 PostgreSQL 表字段拥有的 sequence 定义。
	 *
	 * @param client 当前可用的 pg 客户端。
	 * @param target 表级导出目标。
	 * @returns sequence 定义列表。
	 */
	private async listOwnedSequences(
		client: PgRuntimeClient,
		target: PostgreSqlExportTableTarget
	): Promise<readonly PostgreSqlSequenceDefinition[]> {
		const result = await client.query(
			[
				'SELECT seq_ns.nspname AS "sequenceSchemaName",',
				'seq.relname AS "sequenceName",',
				'attr.attname AS "columnName",',
				'pg_catalog.format_type(pgseq.seqtypid, NULL) AS "dataType",',
				'pgseq.seqstart AS "startValue",',
				'pgseq.seqincrement AS "incrementValue",',
				'pgseq.seqmin AS "minimumValue",',
				'pgseq.seqmax AS "maximumValue",',
				'pgseq.seqcache AS "cacheSize",',
				'pgseq.seqcycle AS "cycle"',
				'FROM pg_catalog.pg_sequence pgseq',
				'JOIN pg_catalog.pg_class seq ON seq.oid = pgseq.seqrelid',
				'JOIN pg_catalog.pg_namespace seq_ns ON seq_ns.oid = seq.relnamespace',
				'JOIN pg_catalog.pg_depend dep ON dep.objid = seq.oid',
				'JOIN pg_catalog.pg_class tbl ON tbl.oid = dep.refobjid',
				'JOIN pg_catalog.pg_namespace tbl_ns ON tbl_ns.oid = tbl.relnamespace',
				'JOIN pg_catalog.pg_attribute attr',
				'ON attr.attrelid = tbl.oid AND attr.attnum = dep.refobjsubid',
				'WHERE tbl_ns.nspname = $1',
				'AND tbl.relname = $2',
				"AND dep.deptype IN ('a', 'i')",
				// identity columns 内部管理 sequence，不需要显式导出
				"AND attr.attidentity = ''",
				'ORDER BY seq_ns.nspname, seq.relname',
			].join(' '),
			[target.schemaName, target.tableName]
		);

		return result.rows
			.map((row) => this.normalizeSequenceDefinition(row))
			.filter((
				sequence
			): sequence is PostgreSqlSequenceDefinition => (
				sequence !== undefined
			));
	}

	/**
	 * 导出多个表的外键约束语句。
	 *
	 * @param client 当前可用的 pg 客户端。
	 * @param targets 表级导出目标列表。
	 * @returns 外键 SQL 文本。
	 */
	private async exportForeignKeys(
		client: PgRuntimeClient,
		targets: readonly PostgreSqlExportTableTarget[]
	): Promise<string> {
		const statements: string[] = [];

		for (const target of targets) {
			const foreignKeys = await this.listForeignKeys(client, target);
			if (foreignKeys.length > 0) {
				statements.push(this.renderForeignKeyStatements(target, foreignKeys));
			}
		}

		return statements.length > 0
			? statements.join('\n')
			: '-- 未找到外键约束。';
	}

	/**
	 * 生成 CREATE TABLE 语句。
	 *
	 * @param target 表级导出目标。
	 * @param columns 字段定义列表。
	 * @param primaryKeys 主键约束列表。
	 * @returns CREATE TABLE SQL。
	 */
	private renderCreateTableStatement(
		target: PostgreSqlExportTableTarget,
		columns: readonly PostgreSqlColumnDefinition[],
		primaryKeys: readonly PostgreSqlConstraintDefinition[]
	): string {
		if (columns.length === 0) {
			throw new Error(
				`PostgreSQL 未返回 ${target.databaseName}.${this.renderQualifiedTableLabel(target)} 的字段定义。`
			);
		}

		const tableElements = [
			...columns.map((column) => this.renderColumnDefinition(column)),
			...primaryKeys.map((primaryKey) => this.renderTableConstraint(primaryKey)),
		];

		return [
			`CREATE TABLE IF NOT EXISTS ${this.escapeQualifiedTableName(target)} (`,
			`${tableElements.map((element) => `\t${element}`).join(',\n')}`,
			');',
		].join('\n');
	}

	/**
	 * 生成单个字段定义。
	 *
	 * @param column 字段 DDL 元数据。
	 * @returns 字段定义 SQL 片段。
	 */
	private renderColumnDefinition(column: PostgreSqlColumnDefinition): string {
		const fragments = [
			this.escapeIdentifier(column.columnName),
			column.dataType,
		];

		if (column.identityKind === 'a') {
			fragments.push('GENERATED ALWAYS AS IDENTITY');
		} else if (column.identityKind === 'd') {
			fragments.push('GENERATED BY DEFAULT AS IDENTITY');
		} else if (column.generatedKind === 's' && column.defaultExpression) {
			fragments.push(`GENERATED ALWAYS AS (${column.defaultExpression}) STORED`);
		} else if (column.defaultExpression) {
			fragments.push(`DEFAULT ${column.defaultExpression}`);
		}

		if (column.notNull) {
			fragments.push('NOT NULL');
		}

		return fragments.join(' ');
	}

	/**
	 * 生成表内约束定义。
	 *
	 * @param constraint 约束 DDL 元数据。
	 * @returns 表内约束 SQL 片段。
	 */
	private renderTableConstraint(
		constraint: PostgreSqlConstraintDefinition
	): string {
		return `CONSTRAINT ${this.escapeIdentifier(constraint.constraintName)} ${constraint.constraintDefinition}`;
	}

	/**
	 * 生成索引创建语句。
	 *
	 * @param index 索引 DDL 元数据。
	 * @returns 索引 SQL。
	 */
	private renderIndexStatement(index: PostgreSqlIndexDefinition): string {
		return `${index.indexDefinition};`;
	}

	/**
	 * 生成 sequence 创建语句。
	 *
	 * @param sequence sequence DDL 元数据。
	 * @returns CREATE SEQUENCE SQL。
	 */
	private renderCreateSequenceStatement(
		sequence: PostgreSqlSequenceDefinition
	): string {
		return [
			`CREATE SEQUENCE IF NOT EXISTS ${this.escapeQualifiedSequenceName(sequence)}`,
			`\tAS ${sequence.dataType}`,
			`\tSTART WITH ${sequence.startValue}`,
			`\tINCREMENT BY ${sequence.incrementValue}`,
			`\tMINVALUE ${sequence.minimumValue}`,
			`\tMAXVALUE ${sequence.maximumValue}`,
			`\tCACHE ${sequence.cacheSize}`,
			sequence.cycle ? '\tCYCLE;' : '\tNO CYCLE;',
		].join('\n');
	}

	/**
	 * 生成 sequence 字段归属语句。
	 *
	 * @param target 表级导出目标。
	 * @param sequence sequence DDL 元数据。
	 * @returns ALTER SEQUENCE OWNED BY SQL。
	 */
	private renderSequenceOwnershipStatement(
		target: PostgreSqlExportTableTarget,
		sequence: PostgreSqlSequenceDefinition
	): string {
		return [
			`ALTER SEQUENCE ${this.escapeQualifiedSequenceName(sequence)}`,
			`OWNED BY ${this.escapeQualifiedTableName(target)}.${this.escapeIdentifier(sequence.columnName)};`,
		].join(' ');
	}

	/**
	 * 生成外键约束创建语句。
	 *
	 * @param target 表级导出目标。
	 * @param foreignKeys 外键约束列表。
	 * @returns 外键 SQL。
	 */
	private renderForeignKeyStatements(
		target: PostgreSqlExportTableTarget,
		foreignKeys: readonly PostgreSqlConstraintDefinition[]
	): string {
		return foreignKeys.map((foreignKey) => [
			`ALTER TABLE ${this.escapeQualifiedTableName(target)}`,
			`ADD CONSTRAINT ${this.escapeIdentifier(foreignKey.constraintName)}`,
			`${foreignKey.constraintDefinition};`,
		].join(' ')).join('\n');
	}

	/**
	 * 将查询结果行归一化为字段定义。
	 *
	 * @param row pg 查询返回的原始行。
	 * @returns 字段定义；无法识别时为空。
	 */
	private normalizeColumnDefinition(
		row: Record<string, unknown>
	): PostgreSqlColumnDefinition | undefined {
		const columnName = row.columnName;
		const dataType = row.dataType;
		const notNull = row.notNull;
		const defaultExpression = row.defaultExpression;
		const identityKind = row.identityKind;
		const generatedKind = row.generatedKind;

		if (
			typeof columnName !== 'string' ||
			typeof dataType !== 'string' ||
			typeof notNull !== 'boolean' ||
			(defaultExpression !== null && typeof defaultExpression !== 'string') ||
			typeof identityKind !== 'string' ||
			typeof generatedKind !== 'string'
		) {
			return undefined;
		}

		return {
			columnName,
			dataType,
			notNull,
			defaultExpression,
			identityKind,
			generatedKind,
		};
	}

	/**
	 * 将查询结果行归一化为约束定义。
	 *
	 * @param row pg 查询返回的原始行。
	 * @returns 约束定义；无法识别时为空。
	 */
	private normalizeConstraintDefinition(
		row: Record<string, unknown>
	): PostgreSqlConstraintDefinition | undefined {
		const constraintName = row.constraintName;
		const constraintDefinition = row.constraintDefinition;

		if (
			typeof constraintName !== 'string' ||
			typeof constraintDefinition !== 'string'
		) {
			return undefined;
		}

		return {
			constraintName,
			constraintDefinition,
		};
	}

	/**
	 * 将查询结果行归一化为索引定义。
	 *
	 * @param row pg 查询返回的原始行。
	 * @returns 索引定义；无法识别时为空。
	 */
	private normalizeIndexDefinition(
		row: Record<string, unknown>
	): PostgreSqlIndexDefinition | undefined {
		const indexName = row.indexName;
		const indexDefinition = row.indexDefinition;

		if (typeof indexName !== 'string' || typeof indexDefinition !== 'string') {
			return undefined;
		}

		return {
			indexName,
			indexDefinition,
		};
	}

	/**
	 * 将查询结果行归一化为 sequence 定义。
	 *
	 * @param row pg 查询返回的原始行。
	 * @returns sequence 定义；无法识别时为空。
	 */
	private normalizeSequenceDefinition(
		row: Record<string, unknown>
	): PostgreSqlSequenceDefinition | undefined {
		const sequenceSchemaName = row.sequenceSchemaName;
		const sequenceName = row.sequenceName;
		const columnName = row.columnName;
		const dataType = row.dataType;
		const startValue = this.normalizeIntegerText(row.startValue);
		const incrementValue = this.normalizeIntegerText(row.incrementValue);
		const minimumValue = this.normalizeIntegerText(row.minimumValue);
		const maximumValue = this.normalizeIntegerText(row.maximumValue);
		const cacheSize = this.normalizeIntegerText(row.cacheSize);
		const cycle = row.cycle;

		if (
			typeof sequenceSchemaName !== 'string' ||
			typeof sequenceName !== 'string' ||
			typeof columnName !== 'string' ||
			typeof dataType !== 'string' ||
			startValue === undefined ||
			incrementValue === undefined ||
			minimumValue === undefined ||
			maximumValue === undefined ||
			cacheSize === undefined ||
			typeof cycle !== 'boolean'
		) {
			return undefined;
		}

		return {
			sequenceSchemaName,
			sequenceName,
			columnName,
			dataType,
			startValue,
			incrementValue,
			minimumValue,
			maximumValue,
			cacheSize,
			cycle,
		};
	}

	/**
	 * 将 PostgreSQL 整数值归一化为 SQL 可写文本。
	 *
	 * @param value pg 返回的整数值。
	 * @returns 整数字符串；无法识别时为空。
	 */
	private normalizeIntegerText(value: unknown): string | undefined {
		if (typeof value === 'number') {
			return Number.isSafeInteger(value) ? String(value) : undefined;
		}

		if (typeof value === 'bigint') {
			return value.toString();
		}

		if (typeof value === 'string' && /^-?\d+$/.test(value)) {
			return value;
		}

		return undefined;
	}

	/**
	 * 导出指定表的 DML。
	 *
	 * @param client 当前可用的 pg 客户端。
	 * @param target 表级导出目标。
	 * @returns DML SQL 文本。
	 */
	private async exportDml(
		client: PgRuntimeClient,
		target: PostgreSqlExportTableTarget
	): Promise<string> {
		const result = await client.query(
			`SELECT * FROM ${this.escapeQualifiedTableName(target)}`
		);
		const columnNames = this.normalizeFieldNames(result);

		if (columnNames.length === 0) {
			return `-- ${this.renderQualifiedTableLabel(target)} 未找到字段。`;
		}

		if (result.rows.length === 0) {
			return `-- ${this.renderQualifiedTableLabel(target)} 中未找到数据。`;
		}

		return result.rows
			.map((row) => this.renderInsertStatement(target, columnNames, row))
			.join('\n');
	}

	/**
	 * 将 pg 字段元数据归一化为字段名列表。
	 *
	 * @param result pg 查询结果。
	 * @returns 字段名列表。
	 */
	private normalizeFieldNames(result: {
		readonly rows: readonly Record<string, unknown>[];
		readonly fields?: readonly unknown[];
	}): readonly string[] {
		if (Array.isArray(result.fields)) {
			const fieldNames = result.fields
				.map((field) => {
					if (!field || typeof field !== 'object') {
						return undefined;
					}

					const name = (field as Record<string, unknown>).name;
					return typeof name === 'string' ? name : undefined;
				})
				.filter((name): name is string => name !== undefined);

			if (fieldNames.length > 0) {
				return fieldNames;
			}
		}

		return result.rows[0] ? Object.keys(result.rows[0]) : [];
	}

	/**
	 * 渲染单行 INSERT 语句。
	 *
	 * @param target 表级导出目标。
	 * @param columnNames 字段名列表。
	 * @param row pg 返回的原始行。
	 * @returns INSERT SQL 文本。
	 */
	private renderInsertStatement(
		target: SqlExportTableTarget,
		columnNames: readonly string[],
		row: Record<string, unknown>
	): string {
		const columnsSql = columnNames
			.map((columnName) => this.escapeIdentifier(columnName))
			.join(', ');
		const valuesSql = columnNames
			.map((columnName) => this.formatSqlValue(row[columnName]))
			.join(', ');

		return `INSERT INTO ${this.escapeQualifiedTableName(target)} (${columnsSql}) VALUES (${valuesSql});`;
	}

	/**
	 * 将 JavaScript 值格式化为 PostgreSQL 字面量。
	 *
	 * @param value 原始字段值。
	 * @returns PostgreSQL SQL 字面量。
	 */
	private formatSqlValue(value: unknown): string {
		if (value === null || value === undefined) {
			return 'NULL';
		}

		if (typeof value === 'number') {
			return Number.isFinite(value) ? String(value) : 'NULL';
		}

		if (typeof value === 'bigint') {
			return value.toString();
		}

		if (typeof value === 'boolean') {
			return value ? 'TRUE' : 'FALSE';
		}

		if (value instanceof Date) {
			return `'${this.escapeSqlString(value.toISOString())}'`;
		}

		if (Buffer.isBuffer(value)) {
			return `decode('${value.toString('hex')}', 'hex')`;
		}

		if (ArrayBuffer.isView(value)) {
			return `decode('${Buffer.from(
				value.buffer,
				value.byteOffset,
				value.byteLength
			).toString('hex')}', 'hex')`;
		}

		if (typeof value === 'object') {
			return `'${this.escapeSqlString(this.stringifyObjectValue(value))}'`;
		}

		return `'${this.escapeSqlString(String(value))}'`;
	}

	/**
	 * 将对象值转换为可导出的字符串。
	 *
	 * @param value 原始对象值。
	 * @returns 可写入 SQL 字面量的字符串。
	 */
	private stringifyObjectValue(value: object): string {
		try {
			return JSON.stringify(value) ?? String(value);
		} catch {
			return String(value);
		}
	}

	/**
	 * 转义 PostgreSQL 字符串字面量内容。
	 *
	 * @param value 待转义的字符串。
	 * @returns 转义后的字符串字面量内容。
	 */
	private escapeSqlString(value: string): string {
		return value.replaceAll("'", "''");
	}

	/**
	 * 转义 PostgreSQL 标识符。
	 *
	 * @param identifier 待转义的标识符。
	 * @returns 转义后的标识符。
	 */
	private escapeIdentifier(identifier: string): string {
		return `"${identifier.replaceAll('"', '""')}"`;
	}

	/**
	 * 转义完整 schema.table 引用。
	 *
	 * @param target 表级导出目标。
	 * @returns 转义后的完整表名。
	 */
	private escapeQualifiedTableName(target: SqlExportTableTarget): string {
		return `${this.escapeIdentifier(target.schemaName)}.${this.escapeIdentifier(target.tableName)}`;
	}

	/**
	 * 转义完整 schema.sequence 引用。
	 *
	 * @param sequence sequence DDL 元数据。
	 * @returns 转义后的完整 sequence 名称。
	 */
	private escapeQualifiedSequenceName(
		sequence: PostgreSqlSequenceDefinition
	): string {
		return `${this.escapeIdentifier(sequence.sequenceSchemaName)}.${this.escapeIdentifier(sequence.sequenceName)}`;
	}

	/**
	 * 渲染日志和注释中使用的完整表名。
	 *
	 * @param target 表级导出目标。
	 * @returns 可读的 schema.table 标签。
	 */
	private renderQualifiedTableLabel(target: SqlExportTableTarget): string {
		return `${target.schemaName}.${target.tableName}`;
	}
}
