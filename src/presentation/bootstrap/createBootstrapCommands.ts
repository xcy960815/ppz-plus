import { AddMySqlConnectionCommand } from "../commands/AddMySqlConnectionCommand";
import { AddSqlite3ConnectionCommand } from "../commands/AddSqlite3ConnectionCommand";
import { ClearPpzStateCommand } from "../commands/ClearPpzStateCommand";
import { ExportMySqlSchemaSqlCommand } from "../commands/ExportMySqlSchemaSqlCommand";
import { ExportMySqlTableSqlCommand } from "../commands/ExportMySqlTableSqlCommand";
import { ExportMySqlTablesBatchSqlCommand } from "../commands/ExportMySqlTablesBatchSqlCommand";
import { ExportPostgreSqlDatabaseSqlCommand } from "../commands/ExportPostgreSqlDatabaseSqlCommand";
import { ExportPostgreSqlSchemaSqlCommand } from "../commands/ExportPostgreSqlSchemaSqlCommand";
import { ExportPostgreSqlTableSqlCommand } from "../commands/ExportPostgreSqlTableSqlCommand";
import { ExportSqlite3TableSqlCommand } from "../commands/ExportSqlite3TableSqlCommand";
import type { ExtensionCommand } from "../commands/ExtensionCommand";
import { ImportMySqlCsvFileCommand } from "../commands/ImportMySqlCsvFileCommand";
import { ImportMySqlJsonFileCommand } from "../commands/ImportMySqlJsonFileCommand";
import { ImportMySqlSqlFileCommand } from "../commands/ImportMySqlSqlFileCommand";
import { ManageMySqlConnectionsCommand } from "../commands/ManageMySqlConnectionsCommand";
import { ManageSqlite3ConnectionsCommand } from "../commands/ManageSqlite3ConnectionsCommand";
import { OpenMySqlSqlTerminalCommand } from "../commands/OpenMySqlSqlTerminalCommand";
import { OpenMySqlTableDataCommand } from "../commands/OpenMySqlTableDataCommand";
import { OpenPostgreSqlSqlTerminalCommand } from "../commands/OpenPostgreSqlSqlTerminalCommand";
import { OpenSqlite3SqlTerminalCommand } from "../commands/OpenSqlite3SqlTerminalCommand";
import { PullConnectionConfigSyncCommand } from "../commands/PullConnectionConfigSyncCommand";
import { RefreshMySqlConnectionsTreeCommand } from "../commands/RefreshMySqlConnectionsTreeCommand";
import { RefreshSqlite3ConnectionsTreeCommand } from "../commands/RefreshSqlite3ConnectionsTreeCommand";
import { ShowProjectStatusCommand } from "../commands/ShowProjectStatusCommand";
import { ShowSqlExportTaskLogsCommand } from "../commands/ShowSqlExportTaskLogsCommand";
import { TestStoredMySqlConnectionCommand } from "../commands/TestStoredMySqlConnectionCommand";
import { TestStoredSqlite3ConnectionCommand } from "../commands/TestStoredSqlite3ConnectionCommand";
import { UploadConnectionConfigSyncCommand } from "../commands/UploadConnectionConfigSyncCommand";
import type { BootstrapPresentation } from "./createBootstrapPresentation";
import type { BootstrapServices } from "./createBootstrapServices";

/**
 * 组装扩展公开的命令集合。
 *
 * @param {BootstrapServices} services 启动期服务集合。
 * @param {BootstrapPresentation} presentation 已完成注入的表现层对象。
 * @returns {readonly ExtensionCommand[]} 可交给启动器统一注册的命令列表。
 */
export function createBootstrapCommands(
  services: BootstrapServices,
  presentation: BootstrapPresentation,
): readonly ExtensionCommand[] {
  return [
    new AddMySqlConnectionCommand(
      services.saveConnectionConfigUseCase,
      services.testConnectionUseCase,
      presentation.databaseConnectionsTreeDataProvider,
      presentation.sqlite3ConnectionsTreeDataProvider,
    ),
    new AddSqlite3ConnectionCommand(
      services.saveConnectionConfigUseCase,
      services.testConnectionUseCase,
      presentation.databaseConnectionsTreeDataProvider,
      presentation.sqlite3ConnectionsTreeDataProvider,
    ),
    new ManageMySqlConnectionsCommand(
      services.listStoredConnectionsUseCase,
      services.deleteStoredConnectionUseCase,
      presentation.databaseConnectionsTreeDataProvider,
      presentation.sqlite3ConnectionsTreeDataProvider,
    ),
    new ManageSqlite3ConnectionsCommand(),
    new RefreshMySqlConnectionsTreeCommand(presentation.databaseConnectionsTreeDataProvider),
    new RefreshSqlite3ConnectionsTreeCommand(
      presentation.databaseConnectionsTreeDataProvider,
      presentation.sqlite3ConnectionsTreeDataProvider,
    ),
    new TestStoredMySqlConnectionCommand(
      services.listStoredConnectionsUseCase,
      services.testConnectionUseCase,
      presentation.storedConnectionPasswordPrompt,
    ),
    new TestStoredSqlite3ConnectionCommand(),
    new ClearPpzStateCommand(
      services.clearPpzStateUseCase,
      presentation.databaseConnectionsTreeDataProvider,
      presentation.sqlite3ConnectionsTreeDataProvider,
    ),
    new UploadConnectionConfigSyncCommand(services.uploadConnectionConfigSyncUseCase),
    new PullConnectionConfigSyncCommand(
      services.pullConnectionConfigSyncUseCase,
      presentation.databaseConnectionsTreeDataProvider,
      presentation.sqlite3ConnectionsTreeDataProvider,
    ),
    new OpenMySqlTableDataCommand(presentation.databaseTableDataPanel),
    new OpenMySqlSqlTerminalCommand(presentation.mySqlSqlTerminalPanel),
    new OpenPostgreSqlSqlTerminalCommand(presentation.postgreSqlSqlTerminalPanel),
    new OpenSqlite3SqlTerminalCommand(presentation.sqlite3SqlTerminalPanel),
    new ImportMySqlSqlFileCommand(
      services.listStoredConnectionsUseCase,
      services.createImportErrorReportUseCase,
      services.previewMySqlSqlFileImportUseCase,
      services.importMySqlSqlFileUseCase,
      presentation.storedConnectionPasswordPrompt,
    ),
    new ImportMySqlCsvFileCommand(
      services.listStoredConnectionsUseCase,
      services.listMySqlSchemasUseCase,
      services.listMySqlTablesUseCase,
      services.createImportErrorReportUseCase,
      services.prepareMySqlCsvImportMappingUseCase,
      services.previewMySqlCsvFileImportUseCase,
      services.importMySqlCsvFileUseCase,
      presentation.storedConnectionPasswordPrompt,
    ),
    new ImportMySqlJsonFileCommand(
      services.listStoredConnectionsUseCase,
      services.listMySqlSchemasUseCase,
      services.listMySqlTablesUseCase,
      services.createImportErrorReportUseCase,
      services.prepareMySqlJsonImportMappingUseCase,
      services.previewMySqlJsonFileImportUseCase,
      services.importMySqlJsonFileUseCase,
      presentation.storedConnectionPasswordPrompt,
    ),
    ...createMySqlTableExportCommands(services),
    ...createMySqlSchemaExportCommands(services),
    new ExportMySqlTablesBatchSqlCommand(
      services.checkSqlExportCapabilityUseCase,
      services.listMySqlTablesUseCase,
      services.exportMySqlTablesBatchUseCase,
      services.recordSqlExportTaskLogUseCase,
    ),
    ...createPostgreSqlDatabaseExportCommands(services),
    ...createPostgreSqlTableExportCommands(services),
    ...createPostgreSqlSchemaExportCommands(services),
    ...createSqlite3TableExportCommands(services),
    new ShowSqlExportTaskLogsCommand(services.listSqlExportTaskLogsUseCase),
    new ShowProjectStatusCommand(services.getBootstrapStatusUseCase),
  ];
}

/**
 * 创建 MySQL 表导出命令集合。
 *
 * @param {BootstrapServices} services 启动期服务集合。
 * @returns {readonly ExtensionCommand[]} MySQL 表导出命令。
 */
function createMySqlTableExportCommands(services: BootstrapServices): readonly ExtensionCommand[] {
  return [
    new ExportMySqlTableSqlCommand(
      {
        id: ExportMySqlTableSqlCommand.exportDdlId,
        kind: "ddl",
      },
      services.checkSqlExportCapabilityUseCase,
      services.exportMySqlTableUseCase,
      services.saveSqlExportDocumentUseCase,
      services.recordSqlExportTaskLogUseCase,
    ),
    new ExportMySqlTableSqlCommand(
      {
        id: ExportMySqlTableSqlCommand.exportDmlId,
        kind: "dml",
      },
      services.checkSqlExportCapabilityUseCase,
      services.exportMySqlTableUseCase,
      services.saveSqlExportDocumentUseCase,
      services.recordSqlExportTaskLogUseCase,
    ),
    new ExportMySqlTableSqlCommand(
      {
        id: ExportMySqlTableSqlCommand.exportBothId,
        kind: "both",
      },
      services.checkSqlExportCapabilityUseCase,
      services.exportMySqlTableUseCase,
      services.saveSqlExportDocumentUseCase,
      services.recordSqlExportTaskLogUseCase,
    ),
  ];
}

/**
 * 创建 MySQL schema 导出命令集合。
 *
 * @param {BootstrapServices} services 启动期服务集合。
 * @returns {readonly ExtensionCommand[]} MySQL schema 导出命令。
 */
function createMySqlSchemaExportCommands(services: BootstrapServices): readonly ExtensionCommand[] {
  return [
    new ExportMySqlSchemaSqlCommand(
      {
        id: ExportMySqlSchemaSqlCommand.exportDdlId,
        kind: "ddl",
      },
      services.checkSqlExportCapabilityUseCase,
      services.exportMySqlSchemaUseCase,
      services.saveSqlExportDocumentUseCase,
      services.recordSqlExportTaskLogUseCase,
    ),
    new ExportMySqlSchemaSqlCommand(
      {
        id: ExportMySqlSchemaSqlCommand.exportDmlId,
        kind: "dml",
      },
      services.checkSqlExportCapabilityUseCase,
      services.exportMySqlSchemaUseCase,
      services.saveSqlExportDocumentUseCase,
      services.recordSqlExportTaskLogUseCase,
    ),
    new ExportMySqlSchemaSqlCommand(
      {
        id: ExportMySqlSchemaSqlCommand.exportBothId,
        kind: "both",
      },
      services.checkSqlExportCapabilityUseCase,
      services.exportMySqlSchemaUseCase,
      services.saveSqlExportDocumentUseCase,
      services.recordSqlExportTaskLogUseCase,
    ),
  ];
}

/**
 * 创建 PostgreSQL database 导出命令集合。
 *
 * @param {BootstrapServices} services 启动期服务集合。
 * @returns {readonly ExtensionCommand[]} PostgreSQL database 导出命令。
 */
function createPostgreSqlDatabaseExportCommands(
  services: BootstrapServices,
): readonly ExtensionCommand[] {
  return [
    new ExportPostgreSqlDatabaseSqlCommand(
      {
        id: ExportPostgreSqlDatabaseSqlCommand.exportDdlId,
        kind: "ddl",
      },
      services.checkSqlExportCapabilityUseCase,
      services.exportPostgreSqlDatabaseUseCase,
      services.saveSqlExportDocumentUseCase,
      services.recordSqlExportTaskLogUseCase,
    ),
    new ExportPostgreSqlDatabaseSqlCommand(
      {
        id: ExportPostgreSqlDatabaseSqlCommand.exportDmlId,
        kind: "dml",
      },
      services.checkSqlExportCapabilityUseCase,
      services.exportPostgreSqlDatabaseUseCase,
      services.saveSqlExportDocumentUseCase,
      services.recordSqlExportTaskLogUseCase,
    ),
    new ExportPostgreSqlDatabaseSqlCommand(
      {
        id: ExportPostgreSqlDatabaseSqlCommand.exportBothId,
        kind: "both",
      },
      services.checkSqlExportCapabilityUseCase,
      services.exportPostgreSqlDatabaseUseCase,
      services.saveSqlExportDocumentUseCase,
      services.recordSqlExportTaskLogUseCase,
    ),
  ];
}

/**
 * 创建 PostgreSQL 表导出命令集合。
 *
 * @param {BootstrapServices} services 启动期服务集合。
 * @returns {readonly ExtensionCommand[]} PostgreSQL 表导出命令。
 */
function createPostgreSqlTableExportCommands(
  services: BootstrapServices,
): readonly ExtensionCommand[] {
  return [
    new ExportPostgreSqlTableSqlCommand(
      {
        id: ExportPostgreSqlTableSqlCommand.exportDdlId,
        kind: "ddl",
      },
      services.checkSqlExportCapabilityUseCase,
      services.exportPostgreSqlTableUseCase,
      services.saveSqlExportDocumentUseCase,
      services.recordSqlExportTaskLogUseCase,
    ),
    new ExportPostgreSqlTableSqlCommand(
      {
        id: ExportPostgreSqlTableSqlCommand.exportDmlId,
        kind: "dml",
      },
      services.checkSqlExportCapabilityUseCase,
      services.exportPostgreSqlTableUseCase,
      services.saveSqlExportDocumentUseCase,
      services.recordSqlExportTaskLogUseCase,
    ),
    new ExportPostgreSqlTableSqlCommand(
      {
        id: ExportPostgreSqlTableSqlCommand.exportBothId,
        kind: "both",
      },
      services.checkSqlExportCapabilityUseCase,
      services.exportPostgreSqlTableUseCase,
      services.saveSqlExportDocumentUseCase,
      services.recordSqlExportTaskLogUseCase,
    ),
  ];
}

/**
 * 创建 PostgreSQL schema 导出命令集合。
 *
 * @param {BootstrapServices} services 启动期服务集合。
 * @returns {readonly ExtensionCommand[]} PostgreSQL schema 导出命令。
 */
function createPostgreSqlSchemaExportCommands(
  services: BootstrapServices,
): readonly ExtensionCommand[] {
  return [
    new ExportPostgreSqlSchemaSqlCommand(
      {
        id: ExportPostgreSqlSchemaSqlCommand.exportDdlId,
        kind: "ddl",
      },
      services.checkSqlExportCapabilityUseCase,
      services.exportPostgreSqlSchemaUseCase,
      services.saveSqlExportDocumentUseCase,
      services.recordSqlExportTaskLogUseCase,
    ),
    new ExportPostgreSqlSchemaSqlCommand(
      {
        id: ExportPostgreSqlSchemaSqlCommand.exportDmlId,
        kind: "dml",
      },
      services.checkSqlExportCapabilityUseCase,
      services.exportPostgreSqlSchemaUseCase,
      services.saveSqlExportDocumentUseCase,
      services.recordSqlExportTaskLogUseCase,
    ),
    new ExportPostgreSqlSchemaSqlCommand(
      {
        id: ExportPostgreSqlSchemaSqlCommand.exportBothId,
        kind: "both",
      },
      services.checkSqlExportCapabilityUseCase,
      services.exportPostgreSqlSchemaUseCase,
      services.saveSqlExportDocumentUseCase,
      services.recordSqlExportTaskLogUseCase,
    ),
  ];
}

/**
 * 创建 SQLite3 表导出命令集合。
 *
 * @param {BootstrapServices} services 启动期服务集合。
 * @returns {readonly ExtensionCommand[]} SQLite3 表导出命令。
 */
function createSqlite3TableExportCommands(
  services: BootstrapServices,
): readonly ExtensionCommand[] {
  return [
    new ExportSqlite3TableSqlCommand(
      {
        id: ExportSqlite3TableSqlCommand.exportDdlId,
        kind: "ddl",
      },
      services.checkSqlExportCapabilityUseCase,
      services.exportSqlite3TableUseCase,
      services.saveSqlExportDocumentUseCase,
      services.recordSqlExportTaskLogUseCase,
    ),
    new ExportSqlite3TableSqlCommand(
      {
        id: ExportSqlite3TableSqlCommand.exportDmlId,
        kind: "dml",
      },
      services.checkSqlExportCapabilityUseCase,
      services.exportSqlite3TableUseCase,
      services.saveSqlExportDocumentUseCase,
      services.recordSqlExportTaskLogUseCase,
    ),
    new ExportSqlite3TableSqlCommand(
      {
        id: ExportSqlite3TableSqlCommand.exportBothId,
        kind: "both",
      },
      services.checkSqlExportCapabilityUseCase,
      services.exportSqlite3TableUseCase,
      services.saveSqlExportDocumentUseCase,
      services.recordSqlExportTaskLogUseCase,
    ),
  ];
}
