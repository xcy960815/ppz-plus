import type * as vscode from "vscode";

import type { ConnectionRepository } from "../../application/connections/ConnectionRepository";
import type { ConnectionTester } from "../../application/connections/ConnectionTester";
import type { SqlExportTaskLogRepository } from "../../application/export/SqlExportTaskLogRepository";
import { CsvDocumentParser } from "../../application/import/CsvDocumentParser";
import { ImportColumnMapper } from "../../application/import/ImportColumnMapper";
import { JsonDocumentParser } from "../../application/import/JsonDocumentParser";
import { CheckSqlExportCapabilityUseCase } from "../../application/useCases/CheckSqlExportCapabilityUseCase";
import { ClearPpzStateUseCase } from "../../application/useCases/ClearPpzStateUseCase";
import { CreateImportErrorReportUseCase } from "../../application/useCases/CreateImportErrorReportUseCase";
import { DeleteMySqlTableRowUseCase } from "../../application/useCases/DeleteMySqlTableRowUseCase";
import { DeleteSqlite3TableRowUseCase } from "../../application/useCases/DeleteSqlite3TableRowUseCase";
import { DeleteStoredConnectionUseCase } from "../../application/useCases/DeleteStoredConnectionUseCase";
import { ExecuteMySqlSqlUseCase } from "../../application/useCases/ExecuteMySqlSqlUseCase";
import { ExecutePostgreSqlSqlUseCase } from "../../application/useCases/ExecutePostgreSqlSqlUseCase";
import { ExecuteSqlite3SqlUseCase } from "../../application/useCases/ExecuteSqlite3SqlUseCase";
import { ExportMySqlSchemaUseCase } from "../../application/useCases/ExportMySqlSchemaUseCase";
import { ExportMySqlTableUseCase } from "../../application/useCases/ExportMySqlTableUseCase";
import { ExportMySqlTablesBatchUseCase } from "../../application/useCases/ExportMySqlTablesBatchUseCase";
import { ExportPostgreSqlDatabaseUseCase } from "../../application/useCases/ExportPostgreSqlDatabaseUseCase";
import { ExportPostgreSqlSchemaUseCase } from "../../application/useCases/ExportPostgreSqlSchemaUseCase";
import { ExportPostgreSqlTableUseCase } from "../../application/useCases/ExportPostgreSqlTableUseCase";
import { ExportSqlite3TableUseCase } from "../../application/useCases/ExportSqlite3TableUseCase";
import { GetBootstrapStatusUseCase } from "../../application/useCases/GetBootstrapStatusUseCase";
import { ImportMySqlCsvFileUseCase } from "../../application/useCases/ImportMySqlCsvFileUseCase";
import { ImportMySqlJsonFileUseCase } from "../../application/useCases/ImportMySqlJsonFileUseCase";
import { ImportMySqlSqlFileUseCase } from "../../application/useCases/ImportMySqlSqlFileUseCase";
import { InsertMySqlTableRowUseCase } from "../../application/useCases/InsertMySqlTableRowUseCase";
import { InsertSqlite3TableRowUseCase } from "../../application/useCases/InsertSqlite3TableRowUseCase";
import { ListMySqlSchemasUseCase } from "../../application/useCases/ListMySqlSchemasUseCase";
import { ListMySqlTableColumnsUseCase } from "../../application/useCases/ListMySqlTableColumnsUseCase";
import { ListMySqlTableRowPageUseCase } from "../../application/useCases/ListMySqlTableRowPageUseCase";
import { ListMySqlTablesUseCase } from "../../application/useCases/ListMySqlTablesUseCase";
import { ListPostgreSqlDatabasesUseCase } from "../../application/useCases/ListPostgreSqlDatabasesUseCase";
import { ListPostgreSqlSchemasUseCase } from "../../application/useCases/ListPostgreSqlSchemasUseCase";
import { ListPostgreSqlTableColumnsUseCase } from "../../application/useCases/ListPostgreSqlTableColumnsUseCase";
import { ListPostgreSqlTableRowPageUseCase } from "../../application/useCases/ListPostgreSqlTableRowPageUseCase";
import { ListPostgreSqlTablesUseCase } from "../../application/useCases/ListPostgreSqlTablesUseCase";
import { ListSqlExportTaskLogsUseCase } from "../../application/useCases/ListSqlExportTaskLogsUseCase";
import { ListSqlite3TableColumnsUseCase } from "../../application/useCases/ListSqlite3TableColumnsUseCase";
import { ListSqlite3TableRowPageUseCase } from "../../application/useCases/ListSqlite3TableRowPageUseCase";
import { ListSqlite3TablesUseCase } from "../../application/useCases/ListSqlite3TablesUseCase";
import { ListStoredConnectionsUseCase } from "../../application/useCases/ListStoredConnectionsUseCase";
import { PrepareMySqlCsvImportMappingUseCase } from "../../application/useCases/PrepareMySqlCsvImportMappingUseCase";
import { PrepareMySqlJsonImportMappingUseCase } from "../../application/useCases/PrepareMySqlJsonImportMappingUseCase";
import { PreviewMySqlCsvFileImportUseCase } from "../../application/useCases/PreviewMySqlCsvFileImportUseCase";
import { PreviewMySqlJsonFileImportUseCase } from "../../application/useCases/PreviewMySqlJsonFileImportUseCase";
import { PreviewMySqlSqlFileImportUseCase } from "../../application/useCases/PreviewMySqlSqlFileImportUseCase";
import { RecordSqlExportTaskLogUseCase } from "../../application/useCases/RecordSqlExportTaskLogUseCase";
import { SaveConnectionConfigUseCase } from "../../application/useCases/SaveConnectionConfigUseCase";
import { SaveSqlExportDocumentUseCase } from "../../application/useCases/SaveSqlExportDocumentUseCase";
import { TestConnectionUseCase } from "../../application/useCases/TestConnectionUseCase";
import { UpdateMySqlTableRowUseCase } from "../../application/useCases/UpdateMySqlTableRowUseCase";
import { UpdateSqlite3TableRowUseCase } from "../../application/useCases/UpdateSqlite3TableRowUseCase";
import {
  MYSQL_MVP_CAPABILITY_DECLARATION,
  POSTGRESQL_TREE_CAPABILITY_DECLARATION,
  SQLITE3_MVP_CAPABILITY_DECLARATION,
} from "../../domain/capabilities/DatabaseCapabilityDeclaration";
import { InMemoryDatabaseCapabilityCatalog } from "../../infrastructure/capabilities/InMemoryDatabaseCapabilityCatalog";
import { CompositeDatabaseConnectionTester } from "../../infrastructure/connections/CompositeDatabaseConnectionTester";
import { TcpDatabaseConnectionTester } from "../../infrastructure/connections/TcpDatabaseConnectionTester";
import { NodeCsvFileReader } from "../../infrastructure/files/NodeCsvFileReader";
import { NodeJsonFileReader } from "../../infrastructure/files/NodeJsonFileReader";
import { NodeSqlExportFileWriter } from "../../infrastructure/files/NodeSqlExportFileWriter";
import { NodeSqlFileReader } from "../../infrastructure/files/NodeSqlFileReader";
import { MySqlConnectionAdapter } from "../../infrastructure/mysql/MySqlConnectionAdapter";
import { MySqlRuntimeLoader } from "../../infrastructure/mysql/MySqlRuntimeLoader";
import { Mysql2ExportProvider } from "../../infrastructure/mysql/Mysql2ExportProvider";
import { Mysql2MetadataProvider } from "../../infrastructure/mysql/Mysql2MetadataProvider";
import { Mysql2SqlExecutor } from "../../infrastructure/mysql/Mysql2SqlExecutor";
import { Mysql2SqlFileImportProvider } from "../../infrastructure/mysql/Mysql2SqlFileImportProvider";
import { Mysql2TableDataProvider } from "../../infrastructure/mysql/Mysql2TableDataProvider";
import { Mysql2TableImportProvider } from "../../infrastructure/mysql/Mysql2TableImportProvider";
import { PgPostgreSqlExportProvider } from "../../infrastructure/postgresql/PgPostgreSqlExportProvider";
import { PgPostgreSqlMetadataProvider } from "../../infrastructure/postgresql/PgPostgreSqlMetadataProvider";
import { PgPostgreSqlSqlExecutor } from "../../infrastructure/postgresql/PgPostgreSqlSqlExecutor";
import { PgPostgreSqlTableDataProvider } from "../../infrastructure/postgresql/PgPostgreSqlTableDataProvider";
import { PostgreSqlConnectionAdapter } from "../../infrastructure/postgresql/PostgreSqlConnectionAdapter";
import { PostgreSqlRuntimeLoader } from "../../infrastructure/postgresql/PostgreSqlRuntimeLoader";
import { Sqlite3ConnectionAdapter } from "../../infrastructure/sqlite3/Sqlite3ConnectionAdapter";
import { Sqlite3DatabaseConnectionTester } from "../../infrastructure/sqlite3/Sqlite3DatabaseConnectionTester";
import { Sqlite3ExportProvider } from "../../infrastructure/sqlite3/Sqlite3ExportProvider";
import { Sqlite3MetadataProvider } from "../../infrastructure/sqlite3/Sqlite3MetadataProvider";
import { Sqlite3RuntimeLoader } from "../../infrastructure/sqlite3/Sqlite3RuntimeLoader";
import { Sqlite3SqlExecutor } from "../../infrastructure/sqlite3/Sqlite3SqlExecutor";
import { Sqlite3TableDataProvider } from "../../infrastructure/sqlite3/Sqlite3TableDataProvider";
import { GlobalStateConnectionRepository } from "../../infrastructure/storage/GlobalStateConnectionRepository";
import { GlobalStateSqlExportTaskLogRepository } from "../../infrastructure/storage/GlobalStateSqlExportTaskLogRepository";

/**
 * 汇总扩展启动阶段会复用的服务与用例。
 */
export interface BootstrapServices {
  readonly getBootstrapStatusUseCase: GetBootstrapStatusUseCase;
  readonly listStoredConnectionsUseCase: ListStoredConnectionsUseCase;
  readonly saveConnectionConfigUseCase: SaveConnectionConfigUseCase;
  readonly deleteStoredConnectionUseCase: DeleteStoredConnectionUseCase;
  readonly testConnectionUseCase: TestConnectionUseCase;
  readonly listMySqlSchemasUseCase: ListMySqlSchemasUseCase;
  readonly listMySqlTablesUseCase: ListMySqlTablesUseCase;
  readonly listPostgreSqlDatabasesUseCase: ListPostgreSqlDatabasesUseCase;
  readonly listPostgreSqlSchemasUseCase: ListPostgreSqlSchemasUseCase;
  readonly listPostgreSqlTablesUseCase: ListPostgreSqlTablesUseCase;
  readonly listSqlite3TablesUseCase: ListSqlite3TablesUseCase;
  readonly listPostgreSqlTableColumnsUseCase: ListPostgreSqlTableColumnsUseCase;
  readonly listPostgreSqlTableRowPageUseCase: ListPostgreSqlTableRowPageUseCase;
  readonly listSqlite3TableColumnsUseCase: ListSqlite3TableColumnsUseCase;
  readonly listSqlite3TableRowPageUseCase: ListSqlite3TableRowPageUseCase;
  readonly listMySqlTableColumnsUseCase: ListMySqlTableColumnsUseCase;
  readonly listMySqlTableRowPageUseCase: ListMySqlTableRowPageUseCase;
  readonly insertMySqlTableRowUseCase: InsertMySqlTableRowUseCase;
  readonly updateMySqlTableRowUseCase: UpdateMySqlTableRowUseCase;
  readonly deleteMySqlTableRowUseCase: DeleteMySqlTableRowUseCase;
  readonly insertSqlite3TableRowUseCase: InsertSqlite3TableRowUseCase;
  readonly updateSqlite3TableRowUseCase: UpdateSqlite3TableRowUseCase;
  readonly deleteSqlite3TableRowUseCase: DeleteSqlite3TableRowUseCase;
  readonly createImportErrorReportUseCase: CreateImportErrorReportUseCase;
  readonly executeMySqlSqlUseCase: ExecuteMySqlSqlUseCase;
  readonly executePostgreSqlSqlUseCase: ExecutePostgreSqlSqlUseCase;
  readonly executeSqlite3SqlUseCase: ExecuteSqlite3SqlUseCase;
  readonly checkSqlExportCapabilityUseCase: CheckSqlExportCapabilityUseCase;
  readonly exportMySqlTableUseCase: ExportMySqlTableUseCase;
  readonly exportMySqlSchemaUseCase: ExportMySqlSchemaUseCase;
  readonly exportPostgreSqlDatabaseUseCase: ExportPostgreSqlDatabaseUseCase;
  readonly exportPostgreSqlTableUseCase: ExportPostgreSqlTableUseCase;
  readonly exportSqlite3TableUseCase: ExportSqlite3TableUseCase;
  readonly exportPostgreSqlSchemaUseCase: ExportPostgreSqlSchemaUseCase;
  readonly saveSqlExportDocumentUseCase: SaveSqlExportDocumentUseCase;
  readonly exportMySqlTablesBatchUseCase: ExportMySqlTablesBatchUseCase;
  readonly recordSqlExportTaskLogUseCase: RecordSqlExportTaskLogUseCase;
  readonly listSqlExportTaskLogsUseCase: ListSqlExportTaskLogsUseCase;
  readonly clearPpzStateUseCase: ClearPpzStateUseCase;
  readonly importMySqlSqlFileUseCase: ImportMySqlSqlFileUseCase;
  readonly previewMySqlSqlFileImportUseCase: PreviewMySqlSqlFileImportUseCase;
  readonly importMySqlCsvFileUseCase: ImportMySqlCsvFileUseCase;
  readonly prepareMySqlCsvImportMappingUseCase: PrepareMySqlCsvImportMappingUseCase;
  readonly previewMySqlCsvFileImportUseCase: PreviewMySqlCsvFileImportUseCase;
  readonly importMySqlJsonFileUseCase: ImportMySqlJsonFileUseCase;
  readonly prepareMySqlJsonImportMappingUseCase: PrepareMySqlJsonImportMappingUseCase;
  readonly previewMySqlJsonFileImportUseCase: PreviewMySqlJsonFileImportUseCase;
}

/**
 * 组装启动期使用的基础设施与应用层服务。
 *
 * @param {vscode.ExtensionContext} context VS Code 扩展生命周期上下文。
 * @returns {BootstrapServices} 已按职责分组完成的服务集合。
 */
export function createBootstrapServices(
  context: vscode.ExtensionContext,
): BootstrapServices {
  const capabilityCatalog = new InMemoryDatabaseCapabilityCatalog([
    MYSQL_MVP_CAPABILITY_DECLARATION,
    POSTGRESQL_TREE_CAPABILITY_DECLARATION,
    SQLITE3_MVP_CAPABILITY_DECLARATION,
  ]);

  const globalStateConnectionRepository = new GlobalStateConnectionRepository(context.globalState);
  const globalStateSqlExportTaskLogRepository = new GlobalStateSqlExportTaskLogRepository(
    context.globalState,
  );

  const connectionRepository: ConnectionRepository = {
    list: () => globalStateConnectionRepository.list(),
    find: (id) => globalStateConnectionRepository.find(id),
    save: (config) => globalStateConnectionRepository.save(config),
    delete: (id) => globalStateConnectionRepository.delete(id),
    clear: () => globalStateConnectionRepository.clear(),
  };
  const sqlExportTaskLogRepository: SqlExportTaskLogRepository = {
    append: (entry) => globalStateSqlExportTaskLogRepository.append(entry),
    listRecent: () => globalStateSqlExportTaskLogRepository.listRecent(),
    clear: () => globalStateSqlExportTaskLogRepository.clear(),
  };

  const mySqlConnectionAdapter = new MySqlConnectionAdapter();
  const postgreSqlConnectionAdapter = new PostgreSqlConnectionAdapter();
  const sqlite3ConnectionAdapter = new Sqlite3ConnectionAdapter();

  const tcpConnectionTester = new TcpDatabaseConnectionTester(
    mySqlConnectionAdapter,
    postgreSqlConnectionAdapter,
  );
  const sqlite3RuntimeLoader = new Sqlite3RuntimeLoader();
  const sqlite3ConnectionTester = new Sqlite3DatabaseConnectionTester(
    sqlite3ConnectionAdapter,
    sqlite3RuntimeLoader,
  );
  const connectionTester = new CompositeDatabaseConnectionTester(
    new Map<string, ConnectionTester>([
      ["mysql", tcpConnectionTester],
      ["postgresql", tcpConnectionTester],
      ["sqlite3", sqlite3ConnectionTester],
    ]),
  );

  const mySqlRuntimeLoader = new MySqlRuntimeLoader();
  const postgreSqlRuntimeLoader = new PostgreSqlRuntimeLoader();

  const mySqlMetadataProvider = new Mysql2MetadataProvider(
    mySqlConnectionAdapter,
    mySqlRuntimeLoader,
  );
  const postgreSqlMetadataProvider = new PgPostgreSqlMetadataProvider(
    postgreSqlConnectionAdapter,
    postgreSqlRuntimeLoader,
  );
  const postgreSqlTableDataProvider = new PgPostgreSqlTableDataProvider(
    postgreSqlConnectionAdapter,
    postgreSqlRuntimeLoader,
  );
  const sqlite3MetadataProvider = new Sqlite3MetadataProvider(
    sqlite3ConnectionAdapter,
    sqlite3RuntimeLoader,
  );
  const sqlite3TableDataProvider = new Sqlite3TableDataProvider(
    sqlite3ConnectionAdapter,
    sqlite3RuntimeLoader,
  );
  const mySqlTableDataProvider = new Mysql2TableDataProvider(
    mySqlConnectionAdapter,
    mySqlRuntimeLoader,
  );
  const mySqlSqlExecutor = new Mysql2SqlExecutor(mySqlConnectionAdapter, mySqlRuntimeLoader);
  const postgreSqlSqlExecutor = new PgPostgreSqlSqlExecutor(
    postgreSqlConnectionAdapter,
    postgreSqlRuntimeLoader,
  );
  const sqlite3SqlExecutor = new Sqlite3SqlExecutor(sqlite3ConnectionAdapter, sqlite3RuntimeLoader);
  const mySqlExportProvider = new Mysql2ExportProvider(mySqlConnectionAdapter, mySqlRuntimeLoader);
  const postgreSqlExportProvider = new PgPostgreSqlExportProvider(
    postgreSqlConnectionAdapter,
    postgreSqlRuntimeLoader,
  );
  const sqlite3ExportProvider = new Sqlite3ExportProvider(
    sqlite3ConnectionAdapter,
    sqlite3RuntimeLoader,
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
    mySqlRuntimeLoader,
  );
  const mySqlTableImportProvider = new Mysql2TableImportProvider(
    mySqlConnectionAdapter,
    mySqlRuntimeLoader,
  );

  const getBootstrapStatusUseCase = new GetBootstrapStatusUseCase(capabilityCatalog);
  const listStoredConnectionsUseCase = new ListStoredConnectionsUseCase(connectionRepository);
  const saveConnectionConfigUseCase = new SaveConnectionConfigUseCase(connectionRepository);
  const deleteStoredConnectionUseCase = new DeleteStoredConnectionUseCase(connectionRepository);
  const testConnectionUseCase = new TestConnectionUseCase(connectionTester);
  const listMySqlSchemasUseCase = new ListMySqlSchemasUseCase(mySqlMetadataProvider);
  const listMySqlTablesUseCase = new ListMySqlTablesUseCase(mySqlMetadataProvider);
  const listPostgreSqlDatabasesUseCase = new ListPostgreSqlDatabasesUseCase(
    postgreSqlMetadataProvider,
  );
  const listPostgreSqlSchemasUseCase = new ListPostgreSqlSchemasUseCase(postgreSqlMetadataProvider);
  const listPostgreSqlTablesUseCase = new ListPostgreSqlTablesUseCase(postgreSqlMetadataProvider);
  const listSqlite3TablesUseCase = new ListSqlite3TablesUseCase(sqlite3MetadataProvider);
  const listPostgreSqlTableColumnsUseCase = new ListPostgreSqlTableColumnsUseCase(
    postgreSqlTableDataProvider,
  );
  const listPostgreSqlTableRowPageUseCase = new ListPostgreSqlTableRowPageUseCase(
    postgreSqlTableDataProvider,
  );
  const listSqlite3TableColumnsUseCase = new ListSqlite3TableColumnsUseCase(
    sqlite3TableDataProvider,
  );
  const listSqlite3TableRowPageUseCase = new ListSqlite3TableRowPageUseCase(
    sqlite3TableDataProvider,
  );
  const listMySqlTableColumnsUseCase = new ListMySqlTableColumnsUseCase(mySqlTableDataProvider);
  const listMySqlTableRowPageUseCase = new ListMySqlTableRowPageUseCase(mySqlTableDataProvider);
  const insertMySqlTableRowUseCase = new InsertMySqlTableRowUseCase(mySqlTableDataProvider);
  const updateMySqlTableRowUseCase = new UpdateMySqlTableRowUseCase(mySqlTableDataProvider);
  const deleteMySqlTableRowUseCase = new DeleteMySqlTableRowUseCase(mySqlTableDataProvider);
  const insertSqlite3TableRowUseCase = new InsertSqlite3TableRowUseCase(sqlite3TableDataProvider);
  const updateSqlite3TableRowUseCase = new UpdateSqlite3TableRowUseCase(sqlite3TableDataProvider);
  const deleteSqlite3TableRowUseCase = new DeleteSqlite3TableRowUseCase(sqlite3TableDataProvider);
  const createImportErrorReportUseCase = new CreateImportErrorReportUseCase();
  const executeMySqlSqlUseCase = new ExecuteMySqlSqlUseCase(mySqlSqlExecutor);
  const executePostgreSqlSqlUseCase = new ExecutePostgreSqlSqlUseCase(postgreSqlSqlExecutor);
  const executeSqlite3SqlUseCase = new ExecuteSqlite3SqlUseCase(sqlite3SqlExecutor);
  const checkSqlExportCapabilityUseCase = new CheckSqlExportCapabilityUseCase(capabilityCatalog);
  const exportMySqlTableUseCase = new ExportMySqlTableUseCase(mySqlExportProvider);
  const exportMySqlSchemaUseCase = new ExportMySqlSchemaUseCase(mySqlExportProvider);
  const exportPostgreSqlDatabaseUseCase = new ExportPostgreSqlDatabaseUseCase(
    postgreSqlExportProvider,
  );
  const exportPostgreSqlTableUseCase = new ExportPostgreSqlTableUseCase(postgreSqlExportProvider);
  const exportSqlite3TableUseCase = new ExportSqlite3TableUseCase(sqlite3ExportProvider);
  const exportPostgreSqlSchemaUseCase = new ExportPostgreSqlSchemaUseCase(postgreSqlExportProvider);
  const saveSqlExportDocumentUseCase = new SaveSqlExportDocumentUseCase(sqlExportFileWriter);
  const exportMySqlTablesBatchUseCase = new ExportMySqlTablesBatchUseCase(
    exportMySqlTableUseCase,
    saveSqlExportDocumentUseCase,
  );
  const recordSqlExportTaskLogUseCase = new RecordSqlExportTaskLogUseCase(
    sqlExportTaskLogRepository,
  );
  const listSqlExportTaskLogsUseCase = new ListSqlExportTaskLogsUseCase(sqlExportTaskLogRepository);
  const clearPpzStateUseCase = new ClearPpzStateUseCase(
    connectionRepository,
    sqlExportTaskLogRepository,
  );
  const importMySqlSqlFileUseCase = new ImportMySqlSqlFileUseCase(
    sqlFileReader,
    mySqlSqlFileImportProvider,
  );
  const previewMySqlSqlFileImportUseCase = new PreviewMySqlSqlFileImportUseCase(sqlFileReader);
  const importMySqlCsvFileUseCase = new ImportMySqlCsvFileUseCase(
    csvFileReader,
    csvDocumentParser,
    importColumnMapper,
    mySqlTableDataProvider,
    mySqlTableImportProvider,
  );
  const prepareMySqlCsvImportMappingUseCase = new PrepareMySqlCsvImportMappingUseCase(
    csvFileReader,
    csvDocumentParser,
    importColumnMapper,
    mySqlTableDataProvider,
  );
  const previewMySqlCsvFileImportUseCase = new PreviewMySqlCsvFileImportUseCase(
    csvFileReader,
    csvDocumentParser,
    importColumnMapper,
    mySqlTableDataProvider,
  );
  const importMySqlJsonFileUseCase = new ImportMySqlJsonFileUseCase(
    jsonFileReader,
    jsonDocumentParser,
    importColumnMapper,
    mySqlTableDataProvider,
    mySqlTableImportProvider,
  );
  const prepareMySqlJsonImportMappingUseCase = new PrepareMySqlJsonImportMappingUseCase(
    jsonFileReader,
    jsonDocumentParser,
    importColumnMapper,
    mySqlTableDataProvider,
  );
  const previewMySqlJsonFileImportUseCase = new PreviewMySqlJsonFileImportUseCase(
    jsonFileReader,
    jsonDocumentParser,
    importColumnMapper,
    mySqlTableDataProvider,
  );

  return {
    getBootstrapStatusUseCase,
    listStoredConnectionsUseCase,
    saveConnectionConfigUseCase,
    deleteStoredConnectionUseCase,
    testConnectionUseCase,
    listMySqlSchemasUseCase,
    listMySqlTablesUseCase,
    listPostgreSqlDatabasesUseCase,
    listPostgreSqlSchemasUseCase,
    listPostgreSqlTablesUseCase,
    listSqlite3TablesUseCase,
    listPostgreSqlTableColumnsUseCase,
    listPostgreSqlTableRowPageUseCase,
    listSqlite3TableColumnsUseCase,
    listSqlite3TableRowPageUseCase,
    listMySqlTableColumnsUseCase,
    listMySqlTableRowPageUseCase,
    insertMySqlTableRowUseCase,
    updateMySqlTableRowUseCase,
    deleteMySqlTableRowUseCase,
    insertSqlite3TableRowUseCase,
    updateSqlite3TableRowUseCase,
    deleteSqlite3TableRowUseCase,
    createImportErrorReportUseCase,
    executeMySqlSqlUseCase,
    executePostgreSqlSqlUseCase,
    executeSqlite3SqlUseCase,
    checkSqlExportCapabilityUseCase,
    exportMySqlTableUseCase,
    exportMySqlSchemaUseCase,
    exportPostgreSqlDatabaseUseCase,
    exportPostgreSqlTableUseCase,
    exportSqlite3TableUseCase,
    exportPostgreSqlSchemaUseCase,
    saveSqlExportDocumentUseCase,
    exportMySqlTablesBatchUseCase,
    recordSqlExportTaskLogUseCase,
    listSqlExportTaskLogsUseCase,
    clearPpzStateUseCase,
    importMySqlSqlFileUseCase,
    previewMySqlSqlFileImportUseCase,
    importMySqlCsvFileUseCase,
    prepareMySqlCsvImportMappingUseCase,
    previewMySqlCsvFileImportUseCase,
    importMySqlJsonFileUseCase,
    prepareMySqlJsonImportMappingUseCase,
    previewMySqlJsonFileImportUseCase,
  };
}
