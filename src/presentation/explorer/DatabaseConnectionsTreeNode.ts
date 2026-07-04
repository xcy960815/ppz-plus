import type {
  ConnectionConfig,
  MssqlConnectionConfig,
  MysqlConnectionConfig,
  PostgreSqlConnectionConfig,
  Sqlite3ConnectionConfig,
} from "../../domain/connections/ConnectionConfig";

/**
 * 表示资源树中渲染的连接节点。
 */
export interface DatabaseConnectionTreeNode {
  readonly kind: "connection";
  readonly connection: ConnectionConfig;
}

/**
 * 表示 schema 元数据实现前使用的占位子节点。
 */
export interface MySqlSchemaTreeNode {
  readonly kind: "schema";
  readonly connection: MysqlConnectionConfig;
  readonly schemaName: string;
}

/**
 * 表示 MySQL schema 下渲染的表节点。
 */
export interface MySqlTableTreeNode {
  readonly kind: "table";
  readonly connection: MysqlConnectionConfig;
  readonly schemaName: string;
  readonly tableName: string;
}

/**
 * 表示 PostgreSQL 连接下渲染的 database 节点。
 */
export interface PostgreSqlDatabaseTreeNode {
  readonly kind: "postgresqlDatabase";
  readonly connection: PostgreSqlConnectionConfig;
  readonly databaseName: string;
  readonly isDefault: boolean;
}

/**
 * 表示 PostgreSQL database 下渲染的 schema 节点。
 */
export interface PostgreSqlSchemaTreeNode {
  readonly kind: "postgresqlSchema";
  readonly connection: PostgreSqlConnectionConfig;
  readonly databaseName: string;
  readonly schemaName: string;
}

/**
 * 表示 PostgreSQL schema 下渲染的表节点。
 */
export interface PostgreSqlTableTreeNode {
  readonly kind: "postgresqlTable";
  readonly connection: PostgreSqlConnectionConfig;
  readonly databaseName: string;
  readonly schemaName: string;
  readonly tableName: string;
}

/**
 * 表示 MSSQL 连接下渲染的 database 节点。
 */
export interface MssqlDatabaseTreeNode {
  readonly kind: "mssqlDatabase";
  readonly connection: MssqlConnectionConfig;
  readonly databaseName: string;
  readonly isDefault: boolean;
}

/**
 * 表示 MSSQL database 下渲染的 schema 节点。
 */
export interface MssqlSchemaTreeNode {
  readonly kind: "mssqlSchema";
  readonly connection: MssqlConnectionConfig;
  readonly databaseName: string;
  readonly schemaName: string;
}

/**
 * 表示 MSSQL schema 下渲染的表节点。
 */
export interface MssqlTableTreeNode {
  readonly kind: "mssqlTable";
  readonly connection: MssqlConnectionConfig;
  readonly databaseName: string;
  readonly schemaName: string;
  readonly tableName: string;
}

/**
 * 表示 SQLite3 连接下渲染的表节点。
 */
export interface Sqlite3TableTreeNode {
  readonly kind: "sqlite3Table";
  readonly connection: Sqlite3ConnectionConfig;
  readonly schemaName: "main";
  readonly tableName: string;
  readonly tableType: "table" | "view";
}

/**
 * 表示数据库资源视图中渲染的全部 Tree 节点类型。
 */
export type DatabaseConnectionsTreeNode =
  | DatabaseConnectionTreeNode
  | MySqlSchemaTreeNode
  | MySqlTableTreeNode
  | PostgreSqlDatabaseTreeNode
  | PostgreSqlSchemaTreeNode
  | PostgreSqlTableTreeNode
  | MssqlDatabaseTreeNode
  | MssqlSchemaTreeNode
  | MssqlTableTreeNode
  | Sqlite3TableTreeNode;
