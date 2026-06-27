import type * as vscode from 'vscode';

import { GetBootstrapStatusUseCase } from '../../application/useCases/GetBootstrapStatusUseCase';
import { DeleteStoredConnectionUseCase } from '../../application/useCases/DeleteStoredConnectionUseCase';
import { ListStoredConnectionsUseCase } from '../../application/useCases/ListStoredConnectionsUseCase';
import { ListMySqlSchemasUseCase } from '../../application/useCases/ListMySqlSchemasUseCase';
import { ListMySqlTableColumnsUseCase } from '../../application/useCases/ListMySqlTableColumnsUseCase';
import { ListMySqlTableRowPageUseCase } from '../../application/useCases/ListMySqlTableRowPageUseCase';
import { ListMySqlTablesUseCase } from '../../application/useCases/ListMySqlTablesUseCase';
import { ExecuteMySqlSqlUseCase } from '../../application/useCases/ExecuteMySqlSqlUseCase';
import { ExportMySqlSchemaUseCase } from '../../application/useCases/ExportMySqlSchemaUseCase';
import { ExportMySqlTableUseCase } from '../../application/useCases/ExportMySqlTableUseCase';
import { SaveConnectionConfigUseCase } from '../../application/useCases/SaveConnectionConfigUseCase';
import { TestConnectionUseCase } from '../../application/useCases/TestConnectionUseCase';
import {
	MYSQL_MVP_CAPABILITY_DECLARATION,
} from '../../domain/capabilities/DatabaseCapabilityDeclaration';
import { InMemoryDatabaseCapabilityCatalog } from '../../infrastructure/capabilities/InMemoryDatabaseCapabilityCatalog';
import { MySqlConnectionAdapter } from '../../infrastructure/mysql/MySqlConnectionAdapter';
import { Mysql2ExportProvider } from '../../infrastructure/mysql/Mysql2ExportProvider';
import { Mysql2MetadataProvider } from '../../infrastructure/mysql/Mysql2MetadataProvider';
import { MySqlRuntimeLoader } from '../../infrastructure/mysql/MySqlRuntimeLoader';
import { Mysql2SqlExecutor } from '../../infrastructure/mysql/Mysql2SqlExecutor';
import { Mysql2TableDataProvider } from '../../infrastructure/mysql/Mysql2TableDataProvider';
import { TcpMySqlConnectionTester } from '../../infrastructure/mysql/TcpMySqlConnectionTester';
import { GlobalStateConnectionRepository } from '../../infrastructure/storage/GlobalStateConnectionRepository';
import { AddMySqlConnectionCommand } from '../commands/AddMySqlConnectionCommand';
import { ExportMySqlSchemaSqlCommand } from '../commands/ExportMySqlSchemaSqlCommand';
import { ExportMySqlTableSqlCommand } from '../commands/ExportMySqlTableSqlCommand';
import { ManageMySqlConnectionsCommand } from '../commands/ManageMySqlConnectionsCommand';
import { OpenMySqlTableDataCommand } from '../commands/OpenMySqlTableDataCommand';
import { OpenMySqlSqlTerminalCommand } from '../commands/OpenMySqlSqlTerminalCommand';
import { RefreshMySqlConnectionsTreeCommand } from '../commands/RefreshMySqlConnectionsTreeCommand';
import { ShowProjectStatusCommand } from '../commands/ShowProjectStatusCommand';
import { TestStoredMySqlConnectionCommand } from '../commands/TestStoredMySqlConnectionCommand';
import { ExtensionBootstrap } from './ExtensionBootstrap';
import { MySqlConnectionsTreeDataProvider } from '../explorer/MySqlConnectionsTreeDataProvider';
import { MySqlConnectionsView } from '../explorer/MySqlConnectionsView';
import { MySqlSqlTerminalPanel } from '../sql/MySqlSqlTerminalPanel';
import { MySqlTableDataPanel } from '../tableData/MySqlTableDataPanel';

/**
 * 组装初始扩展启动对象图。
 *
 * @param context VS Code 扩展生命周期上下文。
 * @returns 可用于扩展激活的启动实例。
 */
export function createExtensionBootstrap(
	context: vscode.ExtensionContext
): ExtensionBootstrap {
	/**
	 * 保存启动阶段可用的能力声明。
	 */
	const capabilityCatalog = new InMemoryDatabaseCapabilityCatalog([
		MYSQL_MVP_CAPABILITY_DECLARATION,
	]);

	/**
	 * 将连接配置保存到 VS Code 全局状态中。
	 */
	const connectionRepository = new GlobalStateConnectionRepository(
		context.globalState
	);

	/**
	 * 归一化 MySQL 相关基础设施细节。
	 */
	const mySqlConnectionAdapter = new MySqlConnectionAdapter();

	/**
	 * 通过 TCP 探测 MySQL 端点，用于首版连接测试 MVP。
	 */
	const connectionTester = new TcpMySqlConnectionTester(mySqlConnectionAdapter);

	/**
	 * 为 MySQL 运行时能力延迟加载 mysql2。
	 */
	const mySqlRuntimeLoader = new MySqlRuntimeLoader();

	/**
	 * 为资源树读取 MySQL schema 和表元数据。
	 */
	const mySqlMetadataProvider = new Mysql2MetadataProvider(
		mySqlConnectionAdapter,
		mySqlRuntimeLoader
	);
	const mySqlTableDataProvider = new Mysql2TableDataProvider(
		mySqlConnectionAdapter,
		mySqlRuntimeLoader
	);
	const mySqlSqlExecutor = new Mysql2SqlExecutor(
		mySqlConnectionAdapter,
		mySqlRuntimeLoader
	);
	const mySqlExportProvider = new Mysql2ExportProvider(
		mySqlConnectionAdapter,
		mySqlRuntimeLoader
	);

	/**
	 * 生成表现层暴露的临时状态数据。
	 */
	const getBootstrapStatusUseCase = new GetBootstrapStatusUseCase(
		capabilityCatalog
	);
	const listStoredConnectionsUseCase = new ListStoredConnectionsUseCase(
		connectionRepository
	);
	const saveConnectionConfigUseCase = new SaveConnectionConfigUseCase(
		connectionRepository
	);
	const deleteStoredConnectionUseCase = new DeleteStoredConnectionUseCase(
		connectionRepository
	);
	const testConnectionUseCase = new TestConnectionUseCase(connectionTester);
	const listMySqlSchemasUseCase = new ListMySqlSchemasUseCase(
		mySqlMetadataProvider
	);
	const listMySqlTablesUseCase = new ListMySqlTablesUseCase(
		mySqlMetadataProvider
	);
	const listMySqlTableColumnsUseCase = new ListMySqlTableColumnsUseCase(
		mySqlTableDataProvider
	);
	const listMySqlTableRowPageUseCase = new ListMySqlTableRowPageUseCase(
		mySqlTableDataProvider
	);
	const executeMySqlSqlUseCase = new ExecuteMySqlSqlUseCase(
		mySqlSqlExecutor
	);
	const exportMySqlTableUseCase = new ExportMySqlTableUseCase(
		mySqlExportProvider
	);
	const exportMySqlSchemaUseCase = new ExportMySqlSchemaUseCase(
		mySqlExportProvider
	);
	const mySqlConnectionsTreeDataProvider =
		new MySqlConnectionsTreeDataProvider(
			listStoredConnectionsUseCase,
			listMySqlSchemasUseCase,
			listMySqlTablesUseCase
		);
	const mySqlTableDataPanel = new MySqlTableDataPanel(
		listMySqlTableColumnsUseCase,
		listMySqlTableRowPageUseCase
	);
	const mySqlSqlTerminalPanel = new MySqlSqlTerminalPanel(
		listStoredConnectionsUseCase,
		executeMySqlSqlUseCase
	);

	return new ExtensionBootstrap([
		new AddMySqlConnectionCommand(
			saveConnectionConfigUseCase,
			mySqlConnectionsTreeDataProvider
		),
		new ManageMySqlConnectionsCommand(
			listStoredConnectionsUseCase,
			saveConnectionConfigUseCase,
			deleteStoredConnectionUseCase,
			testConnectionUseCase,
			mySqlConnectionsTreeDataProvider
		),
		new RefreshMySqlConnectionsTreeCommand(mySqlConnectionsTreeDataProvider),
		new TestStoredMySqlConnectionCommand(
			listStoredConnectionsUseCase,
			testConnectionUseCase
		),
		new OpenMySqlTableDataCommand(mySqlTableDataPanel),
		new OpenMySqlSqlTerminalCommand(mySqlSqlTerminalPanel),
		new ExportMySqlTableSqlCommand(
			{
				id: ExportMySqlTableSqlCommand.exportDdlId,
				kind: 'ddl',
			},
			exportMySqlTableUseCase
		),
		new ExportMySqlTableSqlCommand(
			{
				id: ExportMySqlTableSqlCommand.exportDmlId,
				kind: 'dml',
			},
			exportMySqlTableUseCase
		),
		new ExportMySqlTableSqlCommand(
			{
				id: ExportMySqlTableSqlCommand.exportBothId,
				kind: 'both',
			},
			exportMySqlTableUseCase
		),
		new ExportMySqlSchemaSqlCommand(
			{
				id: ExportMySqlSchemaSqlCommand.exportDdlId,
				kind: 'ddl',
			},
			exportMySqlSchemaUseCase
		),
		new ExportMySqlSchemaSqlCommand(
			{
				id: ExportMySqlSchemaSqlCommand.exportDmlId,
				kind: 'dml',
			},
			exportMySqlSchemaUseCase
		),
		new ExportMySqlSchemaSqlCommand(
			{
				id: ExportMySqlSchemaSqlCommand.exportBothId,
				kind: 'both',
			},
			exportMySqlSchemaUseCase
		),
		new ShowProjectStatusCommand(getBootstrapStatusUseCase),
	], [
		new MySqlConnectionsView(mySqlConnectionsTreeDataProvider),
	]);
}
