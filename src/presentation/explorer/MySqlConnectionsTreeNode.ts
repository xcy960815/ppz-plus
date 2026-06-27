import type { MysqlConnectionConfig } from '../../domain/connections/ConnectionConfig';

/**
 * Represents a MySQL connection node rendered in the explorer tree.
 */
export interface MySqlConnectionTreeNode {
	readonly kind: 'connection';
	readonly connection: MysqlConnectionConfig;
}

/**
 * Represents a placeholder child node used until schema metadata is implemented.
 */
export interface MySqlSchemaPlaceholderTreeNode {
	readonly kind: 'schema-placeholder';
	readonly connectionId: string;
}

/**
 * Represents all tree node variants rendered in the MySQL explorer view.
 */
export type MySqlConnectionsTreeNode =
	| MySqlConnectionTreeNode
	| MySqlSchemaPlaceholderTreeNode;
