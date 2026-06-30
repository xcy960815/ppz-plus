import * as assert from 'assert';

import {
	DATABASE_CAPABILITY_KEYS,
	MYSQL_MVP_CAPABILITY_DECLARATION,
	POSTGRESQL_TREE_CAPABILITY_DECLARATION,
} from '../../domain/capabilities/DatabaseCapabilityDeclaration';
import type { MysqlParameterConnectionConfig, MysqlUrlConnectionConfig } from '../../domain/connections/ConnectionConfig';
import { DATABASE_ENGINES } from '../../domain/database/DatabaseEngine';
import {
	getSqlExportFormat,
	SQL_EXPORT_FORMAT,
	SQL_EXPORT_FORMATS,
	type SqlExportFormatId,
} from '../../domain/export/SqlExportFormat';
import {
	OperationCanceledError,
	isOperationCanceledError,
	throwIfCancellationRequested,
} from '../../domain/tasks/CancellationSignal';

suite('Domain — ConnectionConfig', () => {
	test('MysqlParameterConnectionConfig 类型约束', () => {
		const config: MysqlParameterConnectionConfig = {
			id: 'conn-1',
			name: '测试连接',
			engine: 'mysql',
			mode: 'parameters',
			host: '127.0.0.1',
			port: 3306,
			username: 'root',
			database: 'test_db',
		};

		assert.strictEqual(config.engine, 'mysql');
		assert.strictEqual(config.mode, 'parameters');
		assert.strictEqual(config.host, '127.0.0.1');
		assert.strictEqual(config.port, 3306);
	});

	test('MysqlUrlConnectionConfig 类型约束', () => {
		const config: MysqlUrlConnectionConfig = {
			id: 'conn-2',
			name: 'URL 连接',
			engine: 'mysql',
			mode: 'url',
			url: 'mysql://root@localhost:3306/test',
		};

		assert.strictEqual(config.engine, 'mysql');
		assert.strictEqual(config.mode, 'url');
		assert.ok(config.url.startsWith('mysql://'));
	});

	test('MysqlParameterConnectionConfig password 和 database 可选', () => {
		const config: MysqlParameterConnectionConfig = {
			id: 'conn-3',
			name: '最小参数',
			engine: 'mysql',
			mode: 'parameters',
			host: 'localhost',
			port: 3306,
			username: 'root',
		};

		assert.strictEqual(config.password, undefined);
		assert.strictEqual(config.database, undefined);
	});
});

suite('Domain — DatabaseCapabilityDeclaration', () => {
	test('DATABASE_CAPABILITY_KEYS 包含所有能力键', () => {
		const expectedKeys = [
			'connectionManagement',
			'connectionTest',
			'treeExplorer',
			'schemaBrowse',
			'tableRead',
			'tablePagination',
			'tableSort',
			'tableFilter',
			'sqlExecute',
			'exportDdl',
			'exportDml',
		];

		assert.strictEqual(DATABASE_CAPABILITY_KEYS.length, expectedKeys.length);
		for (const key of expectedKeys) {
			assert.ok(DATABASE_CAPABILITY_KEYS.includes(key as typeof DATABASE_CAPABILITY_KEYS[number]));
		}
	});

	test('MYSQL_MVP_CAPABILITY_DECLARATION 所有能力均为 supported', () => {
		assert.strictEqual(MYSQL_MVP_CAPABILITY_DECLARATION.engine, 'mysql');

		for (const key of DATABASE_CAPABILITY_KEYS) {
			assert.strictEqual(
				MYSQL_MVP_CAPABILITY_DECLARATION.capabilities[key],
				'supported',
				`MySQL MVP 能力“${key}”应为 supported`
			);
		}
	});

	test('POSTGRESQL_TREE_CAPABILITY_DECLARATION 连接能力为 supported', () => {
		assert.strictEqual(POSTGRESQL_TREE_CAPABILITY_DECLARATION.engine, 'postgresql');
		assert.strictEqual(
			POSTGRESQL_TREE_CAPABILITY_DECLARATION.capabilities.connectionManagement,
			'supported'
		);
		assert.strictEqual(
			POSTGRESQL_TREE_CAPABILITY_DECLARATION.capabilities.connectionTest,
			'supported'
		);
		assert.strictEqual(
			POSTGRESQL_TREE_CAPABILITY_DECLARATION.capabilities.treeExplorer,
			'supported'
		);
		assert.strictEqual(
			POSTGRESQL_TREE_CAPABILITY_DECLARATION.capabilities.schemaBrowse,
			'supported'
		);
	});

	test('POSTGRESQL_TREE_CAPABILITY_DECLARATION 已迁移能力为 supported', () => {
		const supportedCapabilities = ['tableRead', 'tablePagination', 'tableSort', 'tableFilter', 'sqlExecute', 'exportDdl', 'exportDml'] as const;

		for (const key of supportedCapabilities) {
			assert.strictEqual(
				POSTGRESQL_TREE_CAPABILITY_DECLARATION.capabilities[key],
				'supported',
				`PostgreSQL 能力”${key}”应为 supported`
			);
		}
	});

	test('POSTGRESQL_TREE_CAPABILITY_DECLARATION 无 planned 残留能力', () => {
		for (const key of DATABASE_CAPABILITY_KEYS) {
			assert.notStrictEqual(
				POSTGRESQL_TREE_CAPABILITY_DECLARATION.capabilities[key],
				'planned',
				`PostgreSQL 能力”${key}”不应停留在 planned 状态`
			);
		}
	});
});

suite('Domain — DatabaseEngine', () => {
	test('DATABASE_ENGINES 包含所有预期引擎', () => {
		const expected = ['mysql', 'postgresql', 'sqlite3', 'mssql', 'cockroachdb', 'mariadb'];
		assert.strictEqual(DATABASE_ENGINES.length, expected.length);

		for (const engine of expected) {
			assert.ok(DATABASE_ENGINES.includes(engine as typeof DATABASE_ENGINES[number]));
		}
	});
});

suite('Domain — SqlExportFormat', () => {
	test('SQL_EXPORT_FORMAT 为默认 SQL 格式', () => {
		assert.strictEqual(SQL_EXPORT_FORMAT.id, 'sql');
		assert.strictEqual(SQL_EXPORT_FORMAT.fileExtension, 'sql');
		assert.ok(SQL_EXPORT_FORMAT.label.length > 0);
	});

	test('SQL_EXPORT_FORMATS 包含 SQL_EXPORT_FORMAT', () => {
		assert.strictEqual(SQL_EXPORT_FORMATS.length, 1);
		assert.strictEqual(SQL_EXPORT_FORMATS[0], SQL_EXPORT_FORMAT);
	});

	test('getSqlExportFormat 返回正确的格式', () => {
		const format = getSqlExportFormat('sql');
		assert.strictEqual(format, SQL_EXPORT_FORMAT);
	});

	test('getSqlExportFormat 无效格式抛错', () => {
		assert.throws(
			() => getSqlExportFormat('json' as SqlExportFormatId),
			/Unsupported SQL export format/
		);
	});
});

suite('Domain — CancellationSignal', () => {
	test('throwIfCancellationRequested 取消信号为 true 时抛出 OperationCanceledError', () => {
		assert.throws(
			() => throwIfCancellationRequested({ isCancellationRequested: true }),
			OperationCanceledError
		);
	});

	test('throwIfCancellationRequested 取消信号为 false 时不抛错', () => {
		assert.doesNotThrow(() =>
			throwIfCancellationRequested({ isCancellationRequested: false })
		);
	});

	test('throwIfCancellationRequested 无取消信号时不抛错', () => {
		assert.doesNotThrow(() => throwIfCancellationRequested(undefined));
	});

	test('OperationCanceledError 有正确名称和消息', () => {
		const error = new OperationCanceledError();
		assert.strictEqual(error.name, 'OperationCanceledError');
		assert.strictEqual(error.message, '用户已取消操作。');
	});

	test('isOperationCanceledError 正确识别 OperationCanceledError', () => {
		const cancelError = new OperationCanceledError();
		const normalError = new Error('普通错误');

		assert.ok(isOperationCanceledError(cancelError));
		assert.ok(!isOperationCanceledError(normalError));
		assert.ok(!isOperationCanceledError(null));
		assert.ok(!isOperationCanceledError('字符串'));
	});
});
