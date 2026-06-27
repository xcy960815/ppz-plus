import type { MysqlConnectionConfig } from '../../domain/connections/ConnectionConfig';

/**
 * 表示资源树中渲染的 MySQL 连接节点。
 */
export interface MySqlConnectionTreeNode {
	readonly kind: 'connection';
	readonly connection: MysqlConnectionConfig;
}

/**
 * 表示 schema 元数据实现前使用的占位子节点。
 */
export interface MySqlSchemaTreeNode {
	readonly kind: 'schema';
	readonly connection: MysqlConnectionConfig;
	readonly schemaName: string;
}

/**
 * 表示 MySQL schema 下渲染的表节点。
 */
export interface MySqlTableTreeNode {
	readonly kind: 'table';
	readonly connection: MysqlConnectionConfig;
	readonly schemaName: string;
	readonly tableName: string;
}

/**
 * 表示 MySQL 资源视图中渲染的全部 Tree 节点类型。
 */
export type MySqlConnectionsTreeNode =
	| MySqlConnectionTreeNode
	| MySqlSchemaTreeNode
	| MySqlTableTreeNode;
