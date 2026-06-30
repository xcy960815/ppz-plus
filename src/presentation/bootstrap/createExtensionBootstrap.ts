import type * as vscode from 'vscode';

import type { ConnectionTester } from '../../application/connections/ConnectionTester';
import { CsvDocumentParser } from '../../application/import/CsvDocumentParser';
import { ImportColumnMapper } from '../../application/import/ImportColumnMapper';
import { JsonDocumentParser } from '../../application/import/JsonDocumentParser';
import { CheckSqlExportCapabilityUseCase } from '../../application/useCases/CheckSqlExportCapabilityUseCase';
import { ClearPpzStateUseCase } from '../../application/useCases/ClearPpzStateUseCase';
import { GetBootstrapStatusUseCase } from '../../application/useCases/GetBootstrapStatusUseCase';
import { DeleteMySqlTableRowUseCase } from '../../application/useCases/DeleteMySqlTableRowUseCase';
import { DeleteSqlite3TableRowUseCase } from '../../application/useCases/DeleteSqlite3TableRowUseCase';
import { DeleteStoredConnectionUseCase } from '../../application/useCases/DeleteStoredConnectionUseCase';
import { ImportMySqlCsvFileUseCase } from '../../application/useCases/ImportMySqlCsvFileUseCase';
import { ImportMySqlJsonFileUseCase } from '../../application/useCases/ImportMySqlJsonFileUseCase';
import { ImportMySqlSqlFileUseCase } from '../../application/useCases/ImportMySqlSqlFileUseCase';
import { ListStoredConnectionsUseCase } from '../../application/useCases/ListStoredConnectionsUseCase';
import { ListMySqlSchemasUseCase } from '../../application/useCases/ListMySqlSchemasUseCase';
import { ListMySqlTableColumnsUseCase } from '../../application/useCases/ListMySqlTableColumnsUseCase';
import { ListMySqlTableRowPageUseCase } from '../../application/useCases/ListMySqlTableRowPageUseCase';
import { ListMySqlTablesUseCase } from '../../application/useCases/ListMySqlTablesUseCase';
import { ListPostgreSqlDatabasesUseCase } from '../../application/useCases/ListPostgreSqlDatabasesUseCase';
import { ListPostgreSqlSchemasUseCase } from '../../application/useCases/ListPostgreSqlSchemasUseCase';
import { ListPostgreSqlTableColumnsUseCase } from '../../application/useCases/ListPostgreSqlTableColumnsUseCase';
import { ListPostgreSqlTableRowPageUseCase } from '../../application/useCases/ListPostgreSqlTableRowPageUseCase';
import { ListPostgreSqlTablesUseCase } from '../../application/useCases/ListPostgreSqlTablesUseCase';
import { ListSqlite3TableColumnsUseCase } from '../../application/useCases/ListSqlite3TableColumnsUseCase';
import { ListSqlite3TableRowPageUseCase } from '../../application/useCases/ListSqlite3TableRowPageUseCase';
import { ListSqlite3TablesUseCase } from '../../application/useCases/ListSqlite3TablesUseCase';
import { ListSqlExportTaskLogsUseCase } from '../../application/useCases/ListSqlExportTaskLogsUseCase';
import { CreateImportErrorReportUseCase } from '../../application/useCases/CreateImportErrorReportUseCase';
import { ExecuteMySqlSqlUseCase } from '../../application/useCases/ExecuteMySqlSqlUseCase';
import { ExecutePostgreSqlSqlUseCase } from '../../application/useCases/ExecutePostgreSqlSqlUseCase';
import { ExecuteSqlite3SqlUseCase } from '../../application/useCases/ExecuteSqlite3SqlUseCase';
import { ExportMySqlSchemaUseCase } from '../../application/useCases/ExportMySqlSchemaUseCase';
import { ExportMySqlTableUseCase } from '../../application/useCases/ExportMySqlTableUseCase';
import { ExportMySqlTablesBatchUseCase } from '../../application/useCases/ExportMySqlTablesBatchUseCase';
import { ExportPostgreSqlDatabaseUseCase } from '../../application/useCases/ExportPostgreSqlDatabaseUseCase';
import { ExportPostgreSqlSchemaUseCase } from '../../application/useCases/ExportPostgreSqlSchemaUseCase';
import { ExportPostgreSqlTableUseCase } from '../../application/useCases/ExportPostgreSqlTableUseCase';
import { ExportSqlite3TableUseCase } from '../../application/useCases/ExportSqlite3TableUseCase';
import { InsertMySqlTableRowUseCase } from '../../application/useCases/InsertMySqlTableRowUseCase';
import { InsertSqlite3TableRowUseCase } from '../../application/useCases/InsertSqlite3TableRowUseCase';
import { PrepareMySqlCsvImportMappingUseCase } from '../../application/useCases/PrepareMySqlCsvImportMappingUseCase';
import { PrepareMySqlJsonImportMappingUseCase } from '../../application/useCases/PrepareMySqlJsonImportMappingUseCase';
import { PreviewMySqlCsvFileImportUseCase } from '../../application/useCases/PreviewMySqlCsvFileImportUseCase';
import { PreviewMySqlJsonFileImportUseCase } from '../../application/useCases/PreviewMySqlJsonFileImportUseCase';
import { PreviewMySqlSqlFileImportUseCase } from '../../application/useCases/PreviewMySqlSqlFileImportUseCase';
import { RecordSqlExportTaskLogUseCase } from '../../application/useCases/RecordSqlExportTaskLogUseCase';
import { SaveConnectionConfigUseCase } from '../../application/useCases/SaveConnectionConfigUseCase';
import { SaveSqlExportDocumentUseCase } from '../../application/useCases/SaveSqlExportDocumentUseCase';
import { TestConnectionUseCase } from '../../application/useCases/TestConnectionUseCase';
import { UpdateMySqlTableRowUseCase } from '../../application/useCases/UpdateMySqlTableRowUseCase';
import { UpdateSqlite3TableRowUseCase } from '../../application/useCases/UpdateSqlite3TableRowUseCase';
import {
	MYSQL_MVP_CAPABILITY_DECLARATION,
	POSTGRESQL_TREE_CAPABILITY_DECLARATION,
	SQLITE3_MVP_CAPABILITY_DECLARATION,
} from '../../domain/capabilities/DatabaseCapabilityDeclaration';
import { InMemoryDatabaseCapabilityCatalog } from '../../infrastructure/capabilities/InMemoryDatabaseCapabilityCatalog';
import { CompositeDatabaseConnectionTester } from '../../infrastructure/connections/CompositeDatabaseConnectionTester';
import { TcpDatabaseConnectionTester } from '../../infrastructure/connections/TcpDatabaseConnectionTester';
import { NodeCsvFileReader } from '../../infrastructure/files/NodeCsvFileReader';
import { NodeJsonFileReader } from '../../infrastructure/files/NodeJsonFileReader';
import { NodeSqlExportFileWriter } from '../../infrastructure/files/NodeSqlExportFileWriter';
import { NodeSqlFileReader } from '../../infrastructure/files/NodeSqlFileReader';
import { MySqlConnectionAdapter } from '../../infrastructure/mysql/MySqlConnectionAdapter';
import { Mysql2ExportProvider } from '../../infrastructure/mysql/Mysql2ExportProvider';
import { Mysql2MetadataProvider } from '../../infrastructure/mysql/Mysql2MetadataProvider';
import { Mysql2SqlFileImportProvider } from '../../infrastructure/mysql/Mysql2SqlFileImportProvider';
import { MySqlRuntimeLoader } from '../../infrastructure/mysql/MySqlRuntimeLoader';
import { Mysql2SqlExecutor } from '../../infrastructure/mysql/Mysql2SqlExecutor';
import { Mysql2TableImportProvider } from '../../infrastructure/mysql/Mysql2TableImportProvider';
import { Mysql2TableDataProvider } from '../../infrastructure/mysql/Mysql2TableDataProvider';
import { PgPostgreSqlExportProvider } from '../../infrastructure/postgresql/PgPostgreSqlExportProvider';
import { PgPostgreSqlMetadataProvider } from '../../infrastructure/postgresql/PgPostgreSqlMetadataProvider';
import { PgPostgreSqlSqlExecutor } from '../../infrastructure/postgresql/PgPostgreSqlSqlExecutor';
import { PgPostgreSqlTableDataProvider } from '../../infrastructure/postgresql/PgPostgreSqlTableDataProvider';
import { PostgreSqlConnectionAdapter } from '../../infrastructure/postgresql/PostgreSqlConnectionAdapter';
import { PostgreSqlRuntimeLoader } from '../../infrastructure/postgresql/PostgreSqlRuntimeLoader';
import { Sqlite3ConnectionAdapter } from '../../infrastructure/sqlite3/Sqlite3ConnectionAdapter';
import { Sqlite3DatabaseConnectionTester } from '../../infrastructure/sqlite3/Sqlite3DatabaseConnectionTester';
import { Sqlite3ExportProvider } from '../../infrastructure/sqlite3/Sqlite3ExportProvider';
import { Sqlite3MetadataProvider } from '../../infrastructure/sqlite3/Sqlite3MetadataProvider';
import { Sqlite3RuntimeLoader } from '../../infrastructure/sqlite3/Sqlite3RuntimeLoader';
import { Sqlite3SqlExecutor } from '../../infrastructure/sqlite3/Sqlite3SqlExecutor';
import { Sqlite3TableDataProvider } from '../../infrastructure/sqlite3/Sqlite3TableDataProvider';
import { GlobalStateConnectionRepository } from '../../infrastructure/storage/GlobalStateConnectionRepository';
import { GlobalStateSqlExportTaskLogRepository } from '../../infrastructure/storage/GlobalStateSqlExportTaskLogRepository';
import { AddMySqlConnectionCommand } from '../commands/AddMySqlConnectionCommand';
import { AddSqlite3ConnectionCommand } from '../commands/AddSqlite3ConnectionCommand';
import { ClearPpzStateCommand } from '../commands/ClearPpzStateCommand';
import { ExportMySqlSchemaSqlCommand } from '../commands/ExportMySqlSchemaSqlCommand';
import { ExportMySqlTableSqlCommand } from '../commands/ExportMySqlTableSqlCommand';
import { ExportMySqlTablesBatchSqlCommand } from '../commands/ExportMySqlTablesBatchSqlCommand';
import { ExportPostgreSqlDatabaseSqlCommand } from '../commands/ExportPostgreSqlDatabaseSqlCommand';
import { ExportPostgreSqlSchemaSqlCommand } from '../commands/ExportPostgreSqlSchemaSqlCommand';
import { ExportPostgreSqlTableSqlCommand } from '../commands/ExportPostgreSqlTableSqlCommand';
import { ExportSqlite3TableSqlCommand } from '../commands/ExportSqlite3TableSqlCommand';
import { ImportMySqlCsvFileCommand } from '../commands/ImportMySqlCsvFileCommand';
import { ImportMySqlJsonFileCommand } from '../commands/ImportMySqlJsonFileCommand';
import { ImportMySqlSqlFileCommand } from '../commands/ImportMySqlSqlFileCommand';
import { ManageMySqlConnectionsCommand } from '../commands/ManageMySqlConnectionsCommand';
import { ManageSqlite3ConnectionsCommand } from '../commands/ManageSqlite3ConnectionsCommand';
import { OpenMySqlTableDataCommand } from '../commands/OpenMySqlTableDataCommand';
import { OpenMySqlSqlTerminalCommand } from '../commands/OpenMySqlSqlTerminalCommand';
import { OpenPostgreSqlSqlTerminalCommand } from '../commands/OpenPostgreSqlSqlTerminalCommand';
import { OpenSqlite3SqlTerminalCommand } from '../commands/OpenSqlite3SqlTerminalCommand';
import { RefreshMySqlConnectionsTreeCommand } from '../commands/RefreshMySqlConnectionsTreeCommand';
import { RefreshSqlite3ConnectionsTreeCommand } from '../commands/RefreshSqlite3ConnectionsTreeCommand';
import { ShowSqlExportTaskLogsCommand } from '../commands/ShowSqlExportTaskLogsCommand';
import { ShowProjectStatusCommand } from '../commands/ShowProjectStatusCommand';
import { TestStoredMySqlConnectionCommand } from '../commands/TestStoredMySqlConnectionCommand';
import { TestStoredSqlite3ConnectionCommand } from '../commands/TestStoredSqlite3ConnectionCommand';
import { ExtensionBootstrap } from './ExtensionBootstrap';
import { MySqlConnectionsTreeDataProvider } from '../explorer/MySqlConnectionsTreeDataProvider';
import { MySqlConnectionsView } from '../explorer/MySqlConnectionsView';
import { Sqlite3ConnectionsTreeDataProvider } from '../explorer/Sqlite3ConnectionsTreeDataProvider';
import { MySqlSqlTerminalPanel } from '../sql/MySqlSqlTerminalPanel';
import { PostgreSqlSqlTerminalPanel } from '../sql/PostgreSqlSqlTerminalPanel';
import { Sqlite3SqlTerminalPanel } from '../sql/Sqlite3SqlTerminalPanel';
import { MySqlTableDataPanel } from '../tableData/MySqlTableDataPanel';

/**
 * 组装初始扩展启动对象图。
 *
 * @param {vscode.ExtensionContext} context VS Code 扩展生命周期上下文。
 * @returns {ExtensionBootstrap} 可用于扩展激活的启动实例。
 */
export function createExtensionBootstrap(
	context: vscode.ExtensionContext
): ExtensionBootstrap {
	/**
	 * 保存启动阶段可用的能力声明。
	 */
	const capabilityCatalog = new InMemoryDatabaseCapabilityCatalog([
		MYSQL_MVP_CAPABILITY_DECLARATION,
		POSTGRESQL_TREE_CAPABILITY_DECLARATION,
		SQLITE3_MVP_CAPABILITY_DECLARATION,
	]);

	/**
	 * 将连接配置保存到 VS Code 全局状态中。
	 */
	const connectionRepository = new GlobalStateConnectionRepository(
		context.globalState
	);
	const sqlExportTaskLogRepository = new GlobalStateSqlExportTaskLogRepository(
		context.globalState
	);

	/**
	 * 归一化 MySQL 相关基础设施细节。
	 */
	const mySqlConnectionAdapter = new MySqlConnectionAdapter();
	const postgreSqlConnectionAdapter = new PostgreSqlConnectionAdapter();
	const sqlite3ConnectionAdapter = new Sqlite3ConnectionAdapter();

	/**
	 * 组合当前支持数据库的连接测试器。
	 */
	const tcpConnectionTester = new TcpDatabaseConnectionTester(
		mySqlConnectionAdapter,
		postgreSqlConnectionAdapter
	);
	const sqlite3RuntimeLoader = new Sqlite3RuntimeLoader();
	const sqlite3ConnectionTester = new Sqlite3DatabaseConnectionTester(
		sqlite3ConnectionAdapter,
		sqlite3RuntimeLoader
	);
	const connectionTester = new CompositeDatabaseConnectionTester(
		new Map<string, ConnectionTester>([
			['mysql', tcpConnectionTester],
			['postgresql', tcpConnectionTester],
			['sqlite3', sqlite3ConnectionTester],
		])
	);

	/**
	 * 为 MySQL 运行时能力延迟加载 mysql2。
	 */
	const mySqlRuntimeLoader = new MySqlRuntimeLoader();
	const postgreSqlRuntimeLoader = new PostgreSqlRuntimeLoader();

	/**
	 * 为资源树读取 MySQL schema 和表元数据。
	 */
	const mySqlMetadataProvider = new Mysql2MetadataProvider(
		mySqlConnectionAdapter,
		mySqlRuntimeLoader
	);
	const postgreSqlMetadataProvider = new PgPostgreSqlMetadataProvider(
		postgreSqlConnectionAdapter,
		postgreSqlRuntimeLoader
	);
	const postgreSqlTableDataProvider = new PgPostgreSqlTableDataProvider(
		postgreSqlConnectionAdapter,
		postgreSqlRuntimeLoader
	);
	const sqlite3MetadataProvider = new Sqlite3MetadataProvider(
		sqlite3ConnectionAdapter,
		sqlite3RuntimeLoader
	);
	const sqlite3TableDataProvider = new Sqlite3TableDataProvider(
		sqlite3ConnectionAdapter,
		sqlite3RuntimeLoader
	);
	const mySqlTableDataProvider = new Mysql2TableDataProvider(
		mySqlConnectionAdapter,
		mySqlRuntimeLoader
	);
	const mySqlSqlExecutor = new Mysql2SqlExecutor(
		mySqlConnectionAdapter,
		mySqlRuntimeLoader
	);
	const postgreSqlSqlExecutor = new PgPostgreSqlSqlExecutor(
		postgreSqlConnectionAdapter,
		postgreSqlRuntimeLoader
	);
	const sqlite3SqlExecutor = new Sqlite3SqlExecutor(
		sqlite3ConnectionAdapter,
		sqlite3RuntimeLoader
	);
	const mySqlExportProvider = new Mysql2ExportProvider(
		mySqlConnectionAdapter,
		mySqlRuntimeLoader
	);
	const postgreSqlExportProvider = new PgPostgreSqlExportProvider(
		postgreSqlConnectionAdapter,
		postgreSqlRuntimeLoader
	);
	const sqlite3ExportProvider = new Sqlite3ExportProvider(
		sqlite3ConnectionAdapter,
		sqlite3RuntimeLoader
	);
	const sqlFileReader = new NodeSqlFileReader();
	const sqlExportFileWriter = new NodeSqlExportFileWriter();
	const csvFileReader = new NodeCsvFileReader();
	const jsonFileReader = new NodeJsonFileReader();
	const csvDocumentParser = new CsvDocumentParser();
	const jsonDocumentParser = new JsonDocumentParser();
	const importColumnMapper = new ImportColumnMapper();
	const mySqlSqlFileImportProvider = new Mysql2SqlFileImportProvider(
		mySqlConnectionAdapter,
		mySqlRuntimeLoader
	);
	const mySqlTableImportProvider = new Mysql2TableImportProvider(
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
	const listPostgreSqlDatabasesUseCase =
		new ListPostgreSqlDatabasesUseCase(postgreSqlMetadataProvider);
	const listPostgreSqlSchemasUseCase =
		new ListPostgreSqlSchemasUseCase(postgreSqlMetadataProvider);
	const listPostgreSqlTablesUseCase =
		new ListPostgreSqlTablesUseCase(postgreSqlMetadataProvider);
	const listSqlite3TablesUseCase = new ListSqlite3TablesUseCase(
		sqlite3MetadataProvider
	);
	const listPostgreSqlTableColumnsUseCase =
		new ListPostgreSqlTableColumnsUseCase(postgreSqlTableDataProvider);
	const listPostgreSqlTableRowPageUseCase =
		new ListPostgreSqlTableRowPageUseCase(postgreSqlTableDataProvider);
	const listSqlite3TableColumnsUseCase =
		new ListSqlite3TableColumnsUseCase(sqlite3TableDataProvider);
	const listSqlite3TableRowPageUseCase =
		new ListSqlite3TableRowPageUseCase(sqlite3TableDataProvider);
	const listMySqlTableColumnsUseCase = new ListMySqlTableColumnsUseCase(
		mySqlTableDataProvider
	);
	const listMySqlTableRowPageUseCase = new ListMySqlTableRowPageUseCase(
		mySqlTableDataProvider
	);
	const insertMySqlTableRowUseCase = new InsertMySqlTableRowUseCase(
		mySqlTableDataProvider
	);
	const updateMySqlTableRowUseCase = new UpdateMySqlTableRowUseCase(
		mySqlTableDataProvider
	);
	const deleteMySqlTableRowUseCase = new DeleteMySqlTableRowUseCase(
		mySqlTableDataProvider
	);
	const insertSqlite3TableRowUseCase = new InsertSqlite3TableRowUseCase(
		sqlite3TableDataProvider
	);
	const updateSqlite3TableRowUseCase = new UpdateSqlite3TableRowUseCase(
		sqlite3TableDataProvider
	);
	const deleteSqlite3TableRowUseCase = new DeleteSqlite3TableRowUseCase(
		sqlite3TableDataProvider
	);
	const createImportErrorReportUseCase =
		new CreateImportErrorReportUseCase();
	const executeMySqlSqlUseCase = new ExecuteMySqlSqlUseCase(
		mySqlSqlExecutor
	);
	const executePostgreSqlSqlUseCase = new ExecutePostgreSqlSqlUseCase(
		postgreSqlSqlExecutor
	);
	const executeSqlite3SqlUseCase = new ExecuteSqlite3SqlUseCase(
		sqlite3SqlExecutor
	);
	const checkSqlExportCapabilityUseCase = new CheckSqlExportCapabilityUseCase(
		capabilityCatalog
	);
	const exportMySqlTableUseCase = new ExportMySqlTableUseCase(
		mySqlExportProvider
	);
	const exportMySqlSchemaUseCase = new ExportMySqlSchemaUseCase(
		mySqlExportProvider
	);
	const exportPostgreSqlDatabaseUseCase =
		new ExportPostgreSqlDatabaseUseCase(postgreSqlExportProvider);
	const exportPostgreSqlTableUseCase = new ExportPostgreSqlTableUseCase(
		postgreSqlExportProvider
	);
	const exportSqlite3TableUseCase = new ExportSqlite3TableUseCase(
		sqlite3ExportProvider
	);
	const exportPostgreSqlSchemaUseCase = new ExportPostgreSqlSchemaUseCase(
		postgreSqlExportProvider
	);
	const saveSqlExportDocumentUseCase = new SaveSqlExportDocumentUseCase(
		sqlExportFileWriter
	);
	const exportMySqlTablesBatchUseCase = new ExportMySqlTablesBatchUseCase(
		exportMySqlTableUseCase,
		saveSqlExportDocumentUseCase
	);
	const recordSqlExportTaskLogUseCase = new RecordSqlExportTaskLogUseCase(
		sqlExportTaskLogRepository
	);
	const listSqlExportTaskLogsUseCase = new ListSqlExportTaskLogsUseCase(
		sqlExportTaskLogRepository
	);
	const clearPpzStateUseCase = new ClearPpzStateUseCase(
		connectionRepository,
		sqlExportTaskLogRepository
	);
	const importMySqlSqlFileUseCase = new ImportMySqlSqlFileUseCase(
		sqlFileReader,
		mySqlSqlFileImportProvider
	);
	const previewMySqlSqlFileImportUseCase =
		new PreviewMySqlSqlFileImportUseCase(sqlFileReader);
	const importMySqlCsvFileUseCase = new ImportMySqlCsvFileUseCase(
		csvFileReader,
		csvDocumentParser,
		importColumnMapper,
		mySqlTableDataProvider,
		mySqlTableImportProvider
	);
	const prepareMySqlCsvImportMappingUseCase =
		new PrepareMySqlCsvImportMappingUseCase(
			csvFileReader,
			csvDocumentParser,
			importColumnMapper,
			mySqlTableDataProvider
		);
	const previewMySqlCsvFileImportUseCase =
		new PreviewMySqlCsvFileImportUseCase(
			csvFileReader,
			csvDocumentParser,
			importColumnMapper,
			mySqlTableDataProvider
		);
	const importMySqlJsonFileUseCase = new ImportMySqlJsonFileUseCase(
		jsonFileReader,
		jsonDocumentParser,
		importColumnMapper,
		mySqlTableDataProvider,
		mySqlTableImportProvider
	);
	const prepareMySqlJsonImportMappingUseCase =
		new PrepareMySqlJsonImportMappingUseCase(
			jsonFileReader,
			jsonDocumentParser,
			importColumnMapper,
			mySqlTableDataProvider
		);
	const previewMySqlJsonFileImportUseCase =
		new PreviewMySqlJsonFileImportUseCase(
			jsonFileReader,
			jsonDocumentParser,
			importColumnMapper,
			mySqlTableDataProvider
		);
	const mySqlConnectionsTreeDataProvider =
		new MySqlConnectionsTreeDataProvider(
			listStoredConnectionsUseCase,
			listMySqlSchemasUseCase,
			listMySqlTablesUseCase,
			listPostgreSqlDatabasesUseCase,
			listPostgreSqlSchemasUseCase,
			listPostgreSqlTablesUseCase,
			listSqlite3TablesUseCase
		);
	const sqlite3ConnectionsTreeDataProvider =
		new Sqlite3ConnectionsTreeDataProvider(
			listStoredConnectionsUseCase,
			listSqlite3TablesUseCase
		);
	const mySqlTableDataPanel = new MySqlTableDataPanel(
		listStoredConnectionsUseCase,
		listMySqlTableColumnsUseCase,
		listMySqlTableRowPageUseCase,
		insertMySqlTableRowUseCase,
		updateMySqlTableRowUseCase,
		deleteMySqlTableRowUseCase,
		listPostgreSqlTableColumnsUseCase,
		listPostgreSqlTableRowPageUseCase,
		listSqlite3TableColumnsUseCase,
		listSqlite3TableRowPageUseCase,
		insertSqlite3TableRowUseCase,
		updateSqlite3TableRowUseCase,
		deleteSqlite3TableRowUseCase
	);
	const mySqlSqlTerminalPanel = new MySqlSqlTerminalPanel(
		listStoredConnectionsUseCase,
		executeMySqlSqlUseCase
	);
	const postgreSqlSqlTerminalPanel = new PostgreSqlSqlTerminalPanel(
		listStoredConnectionsUseCase,
		executePostgreSqlSqlUseCase
	);
	const sqlite3SqlTerminalPanel = new Sqlite3SqlTerminalPanel(
		listStoredConnectionsUseCase,
		executeSqlite3SqlUseCase
	);

	return new ExtensionBootstrap([
		new AddMySqlConnectionCommand(
			saveConnectionConfigUseCase,
			testConnectionUseCase,
			mySqlConnectionsTreeDataProvider
		),
		new AddSqlite3ConnectionCommand(
			saveConnectionConfigUseCase,
			testConnectionUseCase,
			mySqlConnectionsTreeDataProvider,
			sqlite3ConnectionsTreeDataProvider
		),
		new ManageMySqlConnectionsCommand(
			listStoredConnectionsUseCase,
			saveConnectionConfigUseCase,
			deleteStoredConnectionUseCase,
			testConnectionUseCase,
			mySqlConnectionsTreeDataProvider,
			sqlite3ConnectionsTreeDataProvider
		),
		new ManageSqlite3ConnectionsCommand(),
		new RefreshMySqlConnectionsTreeCommand(mySqlConnectionsTreeDataProvider),
		new RefreshSqlite3ConnectionsTreeCommand(
			mySqlConnectionsTreeDataProvider,
			sqlite3ConnectionsTreeDataProvider
		),
		new TestStoredMySqlConnectionCommand(
			listStoredConnectionsUseCase,
			testConnectionUseCase
		),
		new TestStoredSqlite3ConnectionCommand(),
		new ClearPpzStateCommand(
			clearPpzStateUseCase,
			mySqlConnectionsTreeDataProvider,
			sqlite3ConnectionsTreeDataProvider
		),
		new OpenMySqlTableDataCommand(mySqlTableDataPanel),
		new OpenMySqlSqlTerminalCommand(mySqlSqlTerminalPanel),
		new OpenPostgreSqlSqlTerminalCommand(postgreSqlSqlTerminalPanel),
		new OpenSqlite3SqlTerminalCommand(sqlite3SqlTerminalPanel),
		new ImportMySqlSqlFileCommand(
			listStoredConnectionsUseCase,
			createImportErrorReportUseCase,
			previewMySqlSqlFileImportUseCase,
			importMySqlSqlFileUseCase
		),
		new ImportMySqlCsvFileCommand(
			listStoredConnectionsUseCase,
			listMySqlSchemasUseCase,
			listMySqlTablesUseCase,
			createImportErrorReportUseCase,
			prepareMySqlCsvImportMappingUseCase,
			previewMySqlCsvFileImportUseCase,
			importMySqlCsvFileUseCase
		),
		new ImportMySqlJsonFileCommand(
			listStoredConnectionsUseCase,
			listMySqlSchemasUseCase,
			listMySqlTablesUseCase,
			createImportErrorReportUseCase,
			prepareMySqlJsonImportMappingUseCase,
			previewMySqlJsonFileImportUseCase,
			importMySqlJsonFileUseCase
		),
		new ExportMySqlTableSqlCommand(
			{
				id: ExportMySqlTableSqlCommand.exportDdlId,
				kind: 'ddl',
			},
			checkSqlExportCapabilityUseCase,
			exportMySqlTableUseCase,
			saveSqlExportDocumentUseCase,
			recordSqlExportTaskLogUseCase
		),
		new ExportMySqlTableSqlCommand(
			{
				id: ExportMySqlTableSqlCommand.exportDmlId,
				kind: 'dml',
			},
			checkSqlExportCapabilityUseCase,
			exportMySqlTableUseCase,
			saveSqlExportDocumentUseCase,
			recordSqlExportTaskLogUseCase
		),
		new ExportMySqlTableSqlCommand(
			{
				id: ExportMySqlTableSqlCommand.exportBothId,
				kind: 'both',
			},
			checkSqlExportCapabilityUseCase,
			exportMySqlTableUseCase,
			saveSqlExportDocumentUseCase,
			recordSqlExportTaskLogUseCase
		),
		new ExportMySqlSchemaSqlCommand(
			{
				id: ExportMySqlSchemaSqlCommand.exportDdlId,
				kind: 'ddl',
			},
			checkSqlExportCapabilityUseCase,
			exportMySqlSchemaUseCase,
			saveSqlExportDocumentUseCase,
			recordSqlExportTaskLogUseCase
		),
		new ExportMySqlSchemaSqlCommand(
			{
				id: ExportMySqlSchemaSqlCommand.exportDmlId,
				kind: 'dml',
			},
			checkSqlExportCapabilityUseCase,
			exportMySqlSchemaUseCase,
			saveSqlExportDocumentUseCase,
			recordSqlExportTaskLogUseCase
		),
		new ExportMySqlSchemaSqlCommand(
			{
				id: ExportMySqlSchemaSqlCommand.exportBothId,
				kind: 'both',
			},
			checkSqlExportCapabilityUseCase,
			exportMySqlSchemaUseCase,
			saveSqlExportDocumentUseCase,
			recordSqlExportTaskLogUseCase
		),
		new ExportMySqlTablesBatchSqlCommand(
			checkSqlExportCapabilityUseCase,
			listMySqlTablesUseCase,
			exportMySqlTablesBatchUseCase,
			recordSqlExportTaskLogUseCase
		),
		new ExportPostgreSqlDatabaseSqlCommand(
			{
				id: ExportPostgreSqlDatabaseSqlCommand.exportDdlId,
				kind: 'ddl',
			},
			checkSqlExportCapabilityUseCase,
			exportPostgreSqlDatabaseUseCase,
			saveSqlExportDocumentUseCase,
			recordSqlExportTaskLogUseCase
		),
		new ExportPostgreSqlDatabaseSqlCommand(
			{
				id: ExportPostgreSqlDatabaseSqlCommand.exportDmlId,
				kind: 'dml',
			},
			checkSqlExportCapabilityUseCase,
			exportPostgreSqlDatabaseUseCase,
			saveSqlExportDocumentUseCase,
			recordSqlExportTaskLogUseCase
		),
		new ExportPostgreSqlDatabaseSqlCommand(
			{
				id: ExportPostgreSqlDatabaseSqlCommand.exportBothId,
				kind: 'both',
			},
			checkSqlExportCapabilityUseCase,
			exportPostgreSqlDatabaseUseCase,
			saveSqlExportDocumentUseCase,
			recordSqlExportTaskLogUseCase
		),
		new ExportPostgreSqlTableSqlCommand(
			{
				id: ExportPostgreSqlTableSqlCommand.exportDdlId,
				kind: 'ddl',
			},
			checkSqlExportCapabilityUseCase,
			exportPostgreSqlTableUseCase,
			saveSqlExportDocumentUseCase,
			recordSqlExportTaskLogUseCase
		),
		new ExportPostgreSqlTableSqlCommand(
			{
				id: ExportPostgreSqlTableSqlCommand.exportDmlId,
				kind: 'dml',
			},
			checkSqlExportCapabilityUseCase,
			exportPostgreSqlTableUseCase,
			saveSqlExportDocumentUseCase,
			recordSqlExportTaskLogUseCase
		),
		new ExportPostgreSqlTableSqlCommand(
			{
				id: ExportPostgreSqlTableSqlCommand.exportBothId,
				kind: 'both',
			},
			checkSqlExportCapabilityUseCase,
			exportPostgreSqlTableUseCase,
			saveSqlExportDocumentUseCase,
			recordSqlExportTaskLogUseCase
		),
		new ExportPostgreSqlSchemaSqlCommand(
			{
				id: ExportPostgreSqlSchemaSqlCommand.exportDdlId,
				kind: 'ddl',
			},
			checkSqlExportCapabilityUseCase,
			exportPostgreSqlSchemaUseCase,
			saveSqlExportDocumentUseCase,
			recordSqlExportTaskLogUseCase
		),
		new ExportPostgreSqlSchemaSqlCommand(
			{
				id: ExportPostgreSqlSchemaSqlCommand.exportDmlId,
				kind: 'dml',
			},
			checkSqlExportCapabilityUseCase,
			exportPostgreSqlSchemaUseCase,
			saveSqlExportDocumentUseCase,
			recordSqlExportTaskLogUseCase
		),
		new ExportPostgreSqlSchemaSqlCommand(
			{
				id: ExportPostgreSqlSchemaSqlCommand.exportBothId,
				kind: 'both',
			},
			checkSqlExportCapabilityUseCase,
			exportPostgreSqlSchemaUseCase,
			saveSqlExportDocumentUseCase,
			recordSqlExportTaskLogUseCase
		),
		new ExportSqlite3TableSqlCommand(
			{
				id: ExportSqlite3TableSqlCommand.exportDdlId,
				kind: 'ddl',
			},
			checkSqlExportCapabilityUseCase,
			exportSqlite3TableUseCase,
			saveSqlExportDocumentUseCase,
			recordSqlExportTaskLogUseCase
		),
		new ExportSqlite3TableSqlCommand(
			{
				id: ExportSqlite3TableSqlCommand.exportDmlId,
				kind: 'dml',
			},
			checkSqlExportCapabilityUseCase,
			exportSqlite3TableUseCase,
			saveSqlExportDocumentUseCase,
			recordSqlExportTaskLogUseCase
		),
		new ExportSqlite3TableSqlCommand(
			{
				id: ExportSqlite3TableSqlCommand.exportBothId,
				kind: 'both',
			},
			checkSqlExportCapabilityUseCase,
			exportSqlite3TableUseCase,
			saveSqlExportDocumentUseCase,
			recordSqlExportTaskLogUseCase
		),
		new ShowSqlExportTaskLogsCommand(listSqlExportTaskLogsUseCase),
		new ShowProjectStatusCommand(getBootstrapStatusUseCase),
	], [
		new MySqlConnectionsView(mySqlConnectionsTreeDataProvider),
		mySqlTableDataPanel,
		mySqlSqlTerminalPanel,
		postgreSqlSqlTerminalPanel,
		sqlite3SqlTerminalPanel,
	]);
}
