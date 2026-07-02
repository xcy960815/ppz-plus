import { StoredConnectionPasswordPrompt } from "../commands/StoredConnectionPasswordPrompt";
import { DatabaseConnectionsTreeDataProvider } from "../explorer/DatabaseConnectionsTreeDataProvider";
import { DatabaseConnectionsView } from "../explorer/DatabaseConnectionsView";
import { Sqlite3ConnectionsTreeDataProvider } from "../explorer/Sqlite3ConnectionsTreeDataProvider";
import { MySqlSqlTerminalPanel } from "../sql/MySqlSqlTerminalPanel";
import { PostgreSqlSqlTerminalPanel } from "../sql/PostgreSqlSqlTerminalPanel";
import { Sqlite3SqlTerminalPanel } from "../sql/Sqlite3SqlTerminalPanel";
import { DatabaseTableDataPanel } from "../tableData/DatabaseTableDataPanel";
import type { BootstrapServices } from "./createBootstrapServices";

/**
 * 汇总表现层启动对象。
 */
export interface BootstrapPresentation {
  readonly storedConnectionPasswordPrompt: StoredConnectionPasswordPrompt;
  readonly databaseConnectionsTreeDataProvider: DatabaseConnectionsTreeDataProvider;
  readonly sqlite3ConnectionsTreeDataProvider: Sqlite3ConnectionsTreeDataProvider;
  readonly databaseConnectionsView: DatabaseConnectionsView;
  readonly databaseTableDataPanel: DatabaseTableDataPanel;
  readonly mySqlSqlTerminalPanel: MySqlSqlTerminalPanel;
  readonly postgreSqlSqlTerminalPanel: PostgreSqlSqlTerminalPanel;
  readonly sqlite3SqlTerminalPanel: Sqlite3SqlTerminalPanel;
}

/**
 * 组装资源树、面板与视图等表现层对象。
 *
 * @param {BootstrapServices} services 启动期可复用的应用服务集合。
 * @returns {BootstrapPresentation} 已完成依赖注入的表现层对象集合。
 */
export function createBootstrapPresentation(services: BootstrapServices): BootstrapPresentation {
  const storedConnectionPasswordPrompt = new StoredConnectionPasswordPrompt(
    services.saveConnectionConfigUseCase,
  );
  const databaseConnectionsTreeDataProvider = new DatabaseConnectionsTreeDataProvider(
    services.listStoredConnectionsUseCase,
    services.listMySqlSchemasUseCase,
    services.listMySqlTablesUseCase,
    services.listPostgreSqlDatabasesUseCase,
    services.listPostgreSqlSchemasUseCase,
    services.listPostgreSqlTablesUseCase,
    services.listSqlite3TablesUseCase,
    storedConnectionPasswordPrompt,
  );
  const sqlite3ConnectionsTreeDataProvider = new Sqlite3ConnectionsTreeDataProvider(
    services.listStoredConnectionsUseCase,
    services.listSqlite3TablesUseCase,
  );
  const databaseTableDataPanel = new DatabaseTableDataPanel(
    services.listStoredConnectionsUseCase,
    services.listMySqlTableColumnsUseCase,
    services.listMySqlTableRowPageUseCase,
    services.insertMySqlTableRowUseCase,
    services.updateMySqlTableRowUseCase,
    services.deleteMySqlTableRowUseCase,
    services.listPostgreSqlTableColumnsUseCase,
    services.listPostgreSqlTableRowPageUseCase,
    services.listSqlite3TableColumnsUseCase,
    services.listSqlite3TableRowPageUseCase,
    services.insertSqlite3TableRowUseCase,
    services.updateSqlite3TableRowUseCase,
    services.deleteSqlite3TableRowUseCase,
  );
  const mySqlSqlTerminalPanel = new MySqlSqlTerminalPanel(
    services.listStoredConnectionsUseCase,
    services.executeMySqlSqlUseCase,
    storedConnectionPasswordPrompt,
  );
  const postgreSqlSqlTerminalPanel = new PostgreSqlSqlTerminalPanel(
    services.listStoredConnectionsUseCase,
    services.executePostgreSqlSqlUseCase,
    storedConnectionPasswordPrompt,
  );
  const sqlite3SqlTerminalPanel = new Sqlite3SqlTerminalPanel(
    services.listStoredConnectionsUseCase,
    services.executeSqlite3SqlUseCase,
  );
  const databaseConnectionsView = new DatabaseConnectionsView(databaseConnectionsTreeDataProvider);

  return {
    storedConnectionPasswordPrompt,
    databaseConnectionsTreeDataProvider,
    sqlite3ConnectionsTreeDataProvider,
    databaseConnectionsView,
    databaseTableDataPanel,
    mySqlSqlTerminalPanel,
    postgreSqlSqlTerminalPanel,
    sqlite3SqlTerminalPanel,
  };
}
