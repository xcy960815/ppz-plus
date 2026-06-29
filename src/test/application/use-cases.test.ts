import * as assert from 'assert';

import { InMemoryDatabaseCapabilityCatalog } from '../../infrastructure/capabilities/InMemoryDatabaseCapabilityCatalog';
import {
	MYSQL_MVP_CAPABILITY_DECLARATION,
	POSTGRESQL_TREE_CAPABILITY_DECLARATION,
} from '../../domain/capabilities/DatabaseCapabilityDeclaration';
import type { ConnectionRepository } from '../../application/connections/ConnectionRepository';
import type { ConnectionTester } from '../../application/connections/ConnectionTester';
import type {
	ConnectionConfig,
	MysqlConnectionConfig,
} from '../../domain/connections/ConnectionConfig';
import { ListStoredConnectionsUseCase } from '../../application/useCases/ListStoredConnectionsUseCase';
import { DeleteStoredConnectionUseCase } from '../../application/useCases/DeleteStoredConnectionUseCase';
import { SaveConnectionConfigUseCase } from '../../application/useCases/SaveConnectionConfigUseCase';
import { TestConnectionUseCase } from '../../application/useCases/TestConnectionUseCase';
import { GetBootstrapStatusUseCase } from '../../application/useCases/GetBootstrapStatusUseCase';
import { CheckSqlExportCapabilityUseCase } from '../../application/useCases/CheckSqlExportCapabilityUseCase';
import { ExecuteMySqlSqlUseCase } from '../../application/useCases/ExecuteMySqlSqlUseCase';
import type { MySqlSqlExecutor } from '../../application/mysql/MySqlSqlExecutor';
import { ExportMySqlTableUseCase } from '../../application/useCases/ExportMySqlTableUseCase';
import { ExportMySqlSchemaUseCase } from '../../application/useCases/ExportMySqlSchemaUseCase';
import type { MySqlExportProvider } from '../../application/mysql/MySqlExportProvider';
import { SaveSqlExportDocumentUseCase } from '../../application/useCases/SaveSqlExportDocumentUseCase';
import type { SqlExportFileWriter } from '../../application/export/SqlExportFileWriter';
import type { SqlExportDocument, SqlExportTableTarget } from '../../domain/export/SqlExportDocument';
import { RecordSqlExportTaskLogUseCase } from '../../application/useCases/RecordSqlExportTaskLogUseCase';
import { ListSqlExportTaskLogsUseCase } from '../../application/useCases/ListSqlExportTaskLogsUseCase';
import type { SqlExportTaskLogRepository } from '../../application/export/SqlExportTaskLogRepository';
import type { SqlExportTaskLogEntry, SqlExportTaskLogInput } from '../../domain/export/SqlExportTaskLog';

/**
 * 构建测试用的 MySQL 参数连接配置。
 */
function makeMysqlConfig(overrides: Partial<MysqlConnectionConfig> = {}): MysqlConnectionConfig {
	return {
		id: 'test-conn-1',
		name: '测试连接',
		engine: 'mysql',
		mode: 'parameters',
		host: '127.0.0.1',
		port: 3306,
		username: 'root',
		...overrides,
	} as MysqlConnectionConfig;
}

/**
 * 构建测试用的 SQL 导出文档。
 */
function makeSqlExportDocument(overrides: Partial<SqlExportDocument> = {}): SqlExportDocument {
	return {
		title: 'test_table.ddl.sql',
		format: 'sql',
		kind: 'ddl',
		target: { schemaName: 'test_db', tableName: 'test_table' },
		content: 'CREATE TABLE test_table (id INT PRIMARY KEY);\n',
		...overrides,
	};
}

// ---------------------------------------------------------------------------
// ConnectionRepository / ConnectionTester mock 工厂
// ---------------------------------------------------------------------------

function createMockConnectionRepository(saved: ConnectionConfig[] = []) {
	const state = [...saved];
	const deleteCalls: string[] = [];
	const saveCalls: ConnectionConfig[] = [];

	const repo: ConnectionRepository = {
		async list() {
			return [...state];
		},
		async find(id: string) {
			return state.find((c) => c.id === id);
		},
		async save(config) {
			saveCalls.push(config);
			const idx = state.findIndex((c) => c.id === config.id);
			if (idx === -1) {
				state.push(config);
			} else {
				state[idx] = config;
			}
		},
		async delete(id) {
			deleteCalls.push(id);
			const idx = state.findIndex((c) => c.id === id);
			if (idx !== -1) {
				state.splice(idx, 1);
			}
		},
	};

	return {
		repo,
		get saved() {
			return state;
		},
		get deleteCalls() {
			return deleteCalls;
		},
		get saveCalls() {
			return saveCalls;
		},
	};
}

// ---------------------------------------------------------------------------
// 用例测试
// ---------------------------------------------------------------------------

suite('Application — ListStoredConnectionsUseCase', () => {
	test('返回 mock 仓储中的连接列表', async () => {
		const config = makeMysqlConfig();
		const { repo } = createMockConnectionRepository([config]);
		const useCase = new ListStoredConnectionsUseCase(repo);

		const result = await useCase.execute();

		assert.strictEqual(result.length, 1);
		assert.strictEqual(result[0].id, config.id);
	});

	test('无连接时返回空列表', async () => {
		const { repo } = createMockConnectionRepository();
		const useCase = new ListStoredConnectionsUseCase(repo);

		const result = await useCase.execute();

		assert.strictEqual(result.length, 0);
	});
});

suite('Application — DeleteStoredConnectionUseCase', () => {
	test('根据 id 删除连接', async () => {
		const config = makeMysqlConfig();
		const { repo, deleteCalls, saved } = createMockConnectionRepository([config]);
		const useCase = new DeleteStoredConnectionUseCase(repo);

		await useCase.execute(config.id);

		assert.strictEqual(deleteCalls.length, 1);
		assert.strictEqual(deleteCalls[0], config.id);
		assert.strictEqual(saved.length, 0);
	});
});

suite('Application — SaveConnectionConfigUseCase', () => {
	test('保存连接配置', async () => {
		const { repo, saveCalls } = createMockConnectionRepository();
		const useCase = new SaveConnectionConfigUseCase(repo);
		const config = makeMysqlConfig();

		await useCase.execute(config);

		assert.strictEqual(saveCalls.length, 1);
		assert.strictEqual(saveCalls[0].id, config.id);
	});

	test('更新已有连接配置', async () => {
		const configV1 = makeMysqlConfig({ name: '原始' });
		const { repo, saved } = createMockConnectionRepository([configV1]);
		const useCase = new SaveConnectionConfigUseCase(repo);

		const configV2 = makeMysqlConfig({ name: '更新后' });
		await useCase.execute(configV2);

		assert.strictEqual(saved.length, 1);
		assert.strictEqual(saved[0].name, '更新后');
	});
});

suite('Application — TestConnectionUseCase', () => {
	test('调用 ConnectionTester.test', async () => {
		let calledWith: unknown = null;
		const tester: ConnectionTester = {
			async test(config) {
				calledWith = config;
			},
		};
		const useCase = new TestConnectionUseCase(tester);
		const config = makeMysqlConfig();

		await useCase.execute(config);

		assert.strictEqual(calledWith, config);
	});

	test('ConnectionTester 抛错时向上传播', async () => {
		const tester: ConnectionTester = {
			async test(_config) {
				throw new Error('连接超时');
			},
		};
		const useCase = new TestConnectionUseCase(tester);

		await assert.rejects(
			() => useCase.execute(makeMysqlConfig()),
			/连接超时/
		);
	});
});

suite('Application — GetBootstrapStatusUseCase', () => {
	test('MySQL MVP 启动状态', () => {
		const catalog = new InMemoryDatabaseCapabilityCatalog([
			MYSQL_MVP_CAPABILITY_DECLARATION,
			POSTGRESQL_TREE_CAPABILITY_DECLARATION,
		]);
		const useCase = new GetBootstrapStatusUseCase(catalog);

		const status = useCase.execute();

		assert.strictEqual(status.focusEngine, 'mysql');
		assert.ok(status.supportedCapabilities.includes('connectionManagement'));
		assert.ok(status.supportedCapabilities.includes('exportDdl'));
		assert.ok(status.supportedCapabilities.includes('exportDml'));
		assert.deepStrictEqual(status.plannedEngines, ['postgresql']);
	});

	test('无 MySQL 声明时 supportedCapabilities 为空', () => {
		const catalog = new InMemoryDatabaseCapabilityCatalog([
			POSTGRESQL_TREE_CAPABILITY_DECLARATION,
		]);
		const useCase = new GetBootstrapStatusUseCase(catalog);

		const status = useCase.execute();

		assert.strictEqual(status.supportedCapabilities.length, 0);
		assert.deepStrictEqual(status.plannedEngines, ['postgresql']);
	});
});

suite('Application — CheckSqlExportCapabilityUseCase', () => {
	function createUseCase() {
		const catalog = new InMemoryDatabaseCapabilityCatalog([
			MYSQL_MVP_CAPABILITY_DECLARATION,
			POSTGRESQL_TREE_CAPABILITY_DECLARATION,
		]);
		return new CheckSqlExportCapabilityUseCase(catalog);
	}

	test('MySQL + ddl 为 supported', () => {
		const useCase = createUseCase();
		const result = useCase.execute('mysql', 'ddl');
		assert.strictEqual(result.supported, true);
		assert.strictEqual(result.engine, 'mysql');
		assert.strictEqual(result.declarationFound, true);
		assert.strictEqual(result.requirements.length, 1);
		assert.strictEqual(result.requirements[0].key, 'exportDdl');
		assert.strictEqual(result.requirements[0].support, 'supported');
	});

	test('MySQL + dml 为 supported', () => {
		const useCase = createUseCase();
		const result = useCase.execute('mysql', 'dml');
		assert.strictEqual(result.supported, true);
	});

	test('MySQL + both 为 supported', () => {
		const useCase = createUseCase();
		const result = useCase.execute('mysql', 'both');
		assert.strictEqual(result.supported, true);
		assert.strictEqual(result.requirements.length, 2);
	});

	test('PostgreSQL + ddl 不为 supported', () => {
		const useCase = createUseCase();
		const result = useCase.execute('postgresql', 'ddl');
		assert.strictEqual(result.supported, false);
		assert.strictEqual(result.declarationFound, true);
		assert.strictEqual(result.requirements[0].support, 'planned');
	});

	test('不存在的 engine declarationFound 为 false', () => {
		const useCase = createUseCase();
		const result = useCase.execute('mssql', 'ddl');
		assert.strictEqual(result.declarationFound, false);
		assert.strictEqual(result.supported, false);
	});
});

suite('Application — ExecuteMySqlSqlUseCase', () => {
	function createMockExecutor(): MySqlSqlExecutor & { executedSqls: string[] } {
		return {
			executedSqls: [],
			async executeSql(_connection, sql) {
				this.executedSqls.push(sql);
				return {
					sql,
					success: true,
					isQuery: true,
					fields: [{ name: 'id' }],
					rows: [{ id: 1 }],
					affectedRows: null,
					durationMs: 12,
					resultSets: [],
				};
			},
		};
	}

	test('空 SQL 返回错误结果，不调 executor', async () => {
		const executor = createMockExecutor();
		const useCase = new ExecuteMySqlSqlUseCase(executor);

		const result = await useCase.execute(makeMysqlConfig(), '   ');

		assert.strictEqual(result.success, false);
		assert.ok(result.errorMessage);
		assert.strictEqual(executor.executedSqls.length, 0);
	});

	test('正常 SQL 透传到 executor', async () => {
		const executor = createMockExecutor();
		const useCase = new ExecuteMySqlSqlUseCase(executor);
		const config = makeMysqlConfig();

		const result = await useCase.execute(config, 'SELECT 1');

		assert.strictEqual(result.success, true);
		assert.strictEqual(executor.executedSqls.length, 1);
		assert.strictEqual(executor.executedSqls[0], 'SELECT 1');
	});
});

suite('Application — ExportMySqlTableUseCase', () => {
	function createMockProvider(): MySqlExportProvider {
		return {
			async exportTable(_conn, target, kind) {
				return {
					title: `${target.schemaName}.${target.tableName}.${kind}.sql`,
					format: 'sql',
					kind,
					target,
					content: '-- export content',
				};
			},
			async exportSchema(_conn, target, kind) {
				return {
					title: `${target.schemaName}.${kind}.sql`,
					format: 'sql',
					kind,
					target,
					content: '-- schema export',
				};
			},
		};
	}

	test('空 schemaName 抛错', async () => {
		const useCase = new ExportMySqlTableUseCase(createMockProvider());

		await assert.rejects(
			() =>
				useCase.execute(makeMysqlConfig(), { schemaName: '  ', tableName: 't' }, 'ddl'),
			/需要提供 schema 名称/
		);
	});

	test('空 tableName 抛错', async () => {
		const useCase = new ExportMySqlTableUseCase(createMockProvider());

		await assert.rejects(
			() =>
				useCase.execute(makeMysqlConfig(), { schemaName: 'db', tableName: '' }, 'ddl'),
			/需要提供表名/
		);
	});

	test('有效参数返回导出文档', async () => {
		const useCase = new ExportMySqlTableUseCase(createMockProvider());

		const doc = await useCase.execute(
			makeMysqlConfig(),
			{ schemaName: 'test_db', tableName: 'users' },
			'dml'
		);

		assert.strictEqual(doc.kind, 'dml');
		assert.strictEqual(doc.target.schemaName, 'test_db');
		if ('tableName' in doc.target) {
			assert.strictEqual((doc.target as SqlExportTableTarget).tableName, 'users');
		}
	});
});

suite('Application — ExportMySqlSchemaUseCase', () => {
	function createMockProvider(): MySqlExportProvider {
		return {
			async exportTable() {
				throw new Error('不应调用');
			},
			async exportSchema(_conn, target, kind) {
				return {
					title: `${target.schemaName}.${kind}.sql`,
					format: 'sql',
					kind,
					target,
					content: '-- schema export',
				};
			},
		};
	}

	test('空 schemaName 抛错', async () => {
		const useCase = new ExportMySqlSchemaUseCase(createMockProvider());

		await assert.rejects(
			() => useCase.execute(makeMysqlConfig(), { schemaName: '  ' }, 'ddl'),
			/需要提供 schema 名称/
		);
	});

	test('有效参数返回导出文档', async () => {
		const useCase = new ExportMySqlSchemaUseCase(createMockProvider());

		const doc = await useCase.execute(
			makeMysqlConfig(),
			{ schemaName: 'test_db' },
			'ddl'
		);

		assert.strictEqual(doc.kind, 'ddl');
		assert.strictEqual(doc.target.schemaName, 'test_db');
	});
});

suite('Application — SaveSqlExportDocumentUseCase', () => {
	function createMockWriter(): SqlExportFileWriter & { writtenFiles: { path: string; content: string }[] } {
		return {
			writtenFiles: [],
			async writeText(filePath, content) {
				this.writtenFiles.push({ path: filePath, content });
			},
		};
	}

	test('空文件路径返回失败', async () => {
		const writer = createMockWriter();
		const useCase = new SaveSqlExportDocumentUseCase(writer);

		const result = await useCase.execute(makeSqlExportDocument(), '  ');

		assert.strictEqual(result.success, false);
		assert.ok(result.errorMessage?.includes('文件路径'));
	});

	test('空导出内容返回失败', async () => {
		const writer = createMockWriter();
		const useCase = new SaveSqlExportDocumentUseCase(writer);

		const result = await useCase.execute(
			makeSqlExportDocument({ content: '  ' }),
			'/tmp/export.sql'
		);

		assert.strictEqual(result.success, false);
		assert.ok(result.errorMessage?.includes('空'));
	});

	test('正常文档写入成功', async () => {
		const writer = createMockWriter();
		const useCase = new SaveSqlExportDocumentUseCase(writer);

		const result = await useCase.execute(
			makeSqlExportDocument(),
			'/tmp/export.sql'
		);

		assert.strictEqual(result.success, true);
		assert.strictEqual(result.filePath, '/tmp/export.sql');
		assert.strictEqual(writer.writtenFiles.length, 1);
	});

	test('writer 抛错时返回失败', async () => {
		const writer: SqlExportFileWriter = {
			async writeText() {
				throw new Error('磁盘已满');
			},
		};
		const useCase = new SaveSqlExportDocumentUseCase(writer);

		const result = await useCase.execute(makeSqlExportDocument(), '/tmp/export.sql');

		assert.strictEqual(result.success, false);
		assert.ok(result.errorMessage?.includes('磁盘已满'));
	});
});

suite('Application — RecordSqlExportTaskLogUseCase', () => {
	test('记录并返回带有 UUID 的完整日志', async () => {
		const appended: SqlExportTaskLogEntry[] = [];
		const repo: SqlExportTaskLogRepository = {
			async append(entry) {
				appended.push(entry);
			},
			async listRecent() {
				return [...appended];
			},
		};
		const useCase = new RecordSqlExportTaskLogUseCase(repo);

		const input: SqlExportTaskLogInput = {
			engine: 'mysql',
			connectionName: '测试连接',
			targetType: 'table',
			targetName: 'test_db.users',
			kind: 'ddl',
			status: 'success',
			startedAt: '2026-01-01T00:00:00Z',
			endedAt: '2026-01-01T00:00:01Z',
			durationMs: 1000,
			filePath: '/tmp/users.ddl.sql',
		};

		const entry = await useCase.execute(input);

		assert.ok(entry.id);
		assert.strictEqual(typeof entry.id, 'string');
		assert.ok(entry.id.length > 0);
		assert.strictEqual(entry.engine, 'mysql');
		assert.strictEqual(entry.status, 'success');
		assert.strictEqual(appended.length, 1);
	});
});

suite('Application — ListSqlExportTaskLogsUseCase', () => {
	test('返回仓储中的日志列表', async () => {
		const saved: SqlExportTaskLogEntry[] = [
			{
				id: 'log-1',
				engine: 'mysql',
				connectionName: 'test',
				targetType: 'table',
				targetName: 'db.t1',
				kind: 'ddl',
				status: 'success',
				startedAt: '2026-01-01T00:00:00Z',
				endedAt: '2026-01-01T00:00:01Z',
				durationMs: 1000,
			},
		];
		const repo: SqlExportTaskLogRepository = {
			async append() {},
			async listRecent() {
				return [...saved];
			},
		};
		const useCase = new ListSqlExportTaskLogsUseCase(repo);

		const result = await useCase.execute();

		assert.strictEqual(result.length, 1);
		assert.strictEqual(result[0].id, 'log-1');
	});

	test('无日志时返回空列表', async () => {
		const repo: SqlExportTaskLogRepository = {
			async append() {},
			async listRecent() {
				return [];
			},
		};
		const useCase = new ListSqlExportTaskLogsUseCase(repo);

		const result = await useCase.execute();

		assert.strictEqual(result.length, 0);
	});
});
