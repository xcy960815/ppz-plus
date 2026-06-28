import type * as vscode from 'vscode';

import { CsvDocumentParser } from '../../application/import/CsvDocumentParser';
import { JsonDocumentParser } from '../../application/import/JsonDocumentParser';
import { CheckSqlExportCapabilityUseCase } from '../../application/useCases/CheckSqlExportCapabilityUseCase';
import { GetBootstrapStatusUseCase } from '../../application/useCases/GetBootstrapStatusUseCase';
import { DeleteMySqlTableRowUseCase } from '../../application/useCases/DeleteMySqlTableRowUseCase';
import { DeleteStoredConnectionUseCase } from '../../application/useCases/DeleteStoredConnectionUseCase';
import { ImportMySqlCsvFileUseCase } from '../../application/useCases/ImportMySqlCsvFileUseCase';
import { ImportMySqlJsonFileUseCase } from '../../application/useCases/ImportMySqlJsonFileUseCase';
import { ImportMySqlSqlFileUseCase } from '../../application/useCases/ImportMySqlSqlFileUseCase';
import { ListStoredConnectionsUseCase } from '../../application/useCases/ListStoredConnectionsUseCase';
import { ListMySqlSchemasUseCase } from '../../application/useCases/ListMySqlSchemasUseCase';
import { ListMySqlTableColumnsUseCase } from '../../application/useCases/ListMySqlTableColumnsUseCase';
import { ListMySqlTableRowPageUseCase } from '../../application/useCases/ListMySqlTableRowPageUseCase';
import { ListMySqlTablesUseCase } from '../../application/useCases/ListMySqlTablesUseCase';
import { ExecuteMySqlSqlUseCase } from '../../application/useCases/ExecuteMySqlSqlUseCase';
import { ExportMySqlSchemaUseCase } from '../../application/useCases/ExportMySqlSchemaUseCase';
import { ExportMySqlTableUseCase } from '../../application/useCases/ExportMySqlTableUseCase';
import { InsertMySqlTableRowUseCase } from '../../application/useCases/InsertMySqlTableRowUseCase';
import { PreviewMySqlCsvFileImportUseCase } from '../../application/useCases/PreviewMySqlCsvFileImportUseCase';
import { PreviewMySqlJsonFileImportUseCase } from '../../application/useCases/PreviewMySqlJsonFileImportUseCase';
import { PreviewMySqlSqlFileImportUseCase } from '../../application/useCases/PreviewMySqlSqlFileImportUseCase';
import { SaveConnectionConfigUseCase } from '../../application/useCases/SaveConnectionConfigUseCase';
import { TestConnectionUseCase } from '../../application/useCases/TestConnectionUseCase';
import { UpdateMySqlTableRowUseCase } from '../../application/useCases/UpdateMySqlTableRowUseCase';
import {
	MYSQL_MVP_CAPABILITY_DECLARATION,
} from '../../domain/capabilities/DatabaseCapabilityDeclaration';
import { InMemoryDatabaseCapabilityCatalog } from '../../infrastructure/capabilities/InMemoryDatabaseCapabilityCatalog';
import { NodeCsvFileReader } from '../../infrastructure/files/NodeCsvFileReader';
import { NodeJsonFileReader } from '../../infrastructure/files/NodeJsonFileReader';
import { NodeSqlFileReader } from '../../infrastructure/files/NodeSqlFileReader';
import { MySqlConnectionAdapter } from '../../infrastructure/mysql/MySqlConnectionAdapter';
import { Mysql2ExportProvider } from '../../infrastructure/mysql/Mysql2ExportProvider';
import { Mysql2MetadataProvider } from '../../infrastructure/mysql/Mysql2MetadataProvider';
import { Mysql2SqlFileImportProvider } from '../../infrastructure/mysql/Mysql2SqlFileImportProvider';
import { MySqlRuntimeLoader } from '../../infrastructure/mysql/MySqlRuntimeLoader';
import { Mysql2SqlExecutor } from '../../infrastructure/mysql/Mysql2SqlExecutor';
import { Mysql2TableImportProvider } from '../../infrastructure/mysql/Mysql2TableImportProvider';
import { Mysql2TableDataProvider } from '../../infrastructure/mysql/Mysql2TableDataProvider';
import { TcpMySqlConnectionTester } from '../../infrastructure/mysql/TcpMySqlConnectionTester';
import { GlobalStateConnectionRepository } from '../../infrastructure/storage/GlobalStateConnectionRepository';
import { AddMySqlConnectionCommand } from '../commands/AddMySqlConnectionCommand';
import { ExportMySqlSchemaSqlCommand } from '../commands/ExportMySqlSchemaSqlCommand';
import { ExportMySqlTableSqlCommand } from '../commands/ExportMySqlTableSqlCommand';
import { ImportMySqlCsvFileCommand } from '../commands/ImportMySqlCsvFileCommand';
import { ImportMySqlJsonFileCommand } from '../commands/ImportMySqlJsonFileCommand';
import { ImportMySqlSqlFileCommand } from '../commands/ImportMySqlSqlFileCommand';
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
	const sqlFileReader = new NodeSqlFileReader();
	const csvFileReader = new NodeCsvFileReader();
	const jsonFileReader = new NodeJsonFileReader();
	const csvDocumentParser = new CsvDocumentParser();
	const jsonDocumentParser = new JsonDocumentParser();
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
	const executeMySqlSqlUseCase = new ExecuteMySqlSqlUseCase(
		mySqlSqlExecutor
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
	const importMySqlSqlFileUseCase = new ImportMySqlSqlFileUseCase(
		sqlFileReader,
		mySqlSqlFileImportProvider
	);
	const previewMySqlSqlFileImportUseCase =
		new PreviewMySqlSqlFileImportUseCase(sqlFileReader);
	const importMySqlCsvFileUseCase = new ImportMySqlCsvFileUseCase(
		csvFileReader,
		csvDocumentParser,
		mySqlTableDataProvider,
		mySqlTableImportProvider
	);
	const previewMySqlCsvFileImportUseCase =
		new PreviewMySqlCsvFileImportUseCase(
			csvFileReader,
			csvDocumentParser,
			mySqlTableDataProvider
		);
	const importMySqlJsonFileUseCase = new ImportMySqlJsonFileUseCase(
		jsonFileReader,
		jsonDocumentParser,
		mySqlTableDataProvider,
		mySqlTableImportProvider
	);
	const previewMySqlJsonFileImportUseCase =
		new PreviewMySqlJsonFileImportUseCase(
			jsonFileReader,
			jsonDocumentParser,
			mySqlTableDataProvider
		);
	const mySqlConnectionsTreeDataProvider =
		new MySqlConnectionsTreeDataProvider(
			listStoredConnectionsUseCase,
			listMySqlSchemasUseCase,
			listMySqlTablesUseCase
		);
	const mySqlTableDataPanel = new MySqlTableDataPanel(
		listMySqlTableColumnsUseCase,
		listMySqlTableRowPageUseCase,
		insertMySqlTableRowUseCase,
		updateMySqlTableRowUseCase,
		deleteMySqlTableRowUseCase
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
		new ImportMySqlSqlFileCommand(
			listStoredConnectionsUseCase,
			previewMySqlSqlFileImportUseCase,
			importMySqlSqlFileUseCase
		),
		new ImportMySqlCsvFileCommand(
			listStoredConnectionsUseCase,
			listMySqlSchemasUseCase,
			listMySqlTablesUseCase,
			previewMySqlCsvFileImportUseCase,
			importMySqlCsvFileUseCase
		),
		new ImportMySqlJsonFileCommand(
			listStoredConnectionsUseCase,
			listMySqlSchemasUseCase,
			listMySqlTablesUseCase,
			previewMySqlJsonFileImportUseCase,
			importMySqlJsonFileUseCase
		),
		new ExportMySqlTableSqlCommand(
			{
				id: ExportMySqlTableSqlCommand.exportDdlId,
				kind: 'ddl',
			},
			checkSqlExportCapabilityUseCase,
			exportMySqlTableUseCase
		),
		new ExportMySqlTableSqlCommand(
			{
				id: ExportMySqlTableSqlCommand.exportDmlId,
				kind: 'dml',
			},
			checkSqlExportCapabilityUseCase,
			exportMySqlTableUseCase
		),
		new ExportMySqlTableSqlCommand(
			{
				id: ExportMySqlTableSqlCommand.exportBothId,
				kind: 'both',
			},
			checkSqlExportCapabilityUseCase,
			exportMySqlTableUseCase
		),
		new ExportMySqlSchemaSqlCommand(
			{
				id: ExportMySqlSchemaSqlCommand.exportDdlId,
				kind: 'ddl',
			},
			checkSqlExportCapabilityUseCase,
			exportMySqlSchemaUseCase
		),
		new ExportMySqlSchemaSqlCommand(
			{
				id: ExportMySqlSchemaSqlCommand.exportDmlId,
				kind: 'dml',
			},
			checkSqlExportCapabilityUseCase,
			exportMySqlSchemaUseCase
		),
		new ExportMySqlSchemaSqlCommand(
			{
				id: ExportMySqlSchemaSqlCommand.exportBothId,
				kind: 'both',
			},
			checkSqlExportCapabilityUseCase,
			exportMySqlSchemaUseCase
		),
		new ShowProjectStatusCommand(getBootstrapStatusUseCase),
	], [
		new MySqlConnectionsView(mySqlConnectionsTreeDataProvider),
	]);
}
