import type { DatabaseEngine } from '../database/DatabaseEngine';

/**
 * Enumerates the capability keys used by the capability matrix.
 */
export const DATABASE_CAPABILITY_KEYS = [
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
] as const;

export type DatabaseCapabilityKey =
	(typeof DATABASE_CAPABILITY_KEYS)[number];

export type CapabilitySupport = 'supported' | 'planned' | 'unsupported';

export type DatabaseCapabilityMatrix = Record<
	DatabaseCapabilityKey,
	CapabilitySupport
>;

export interface DatabaseCapabilityDeclaration {
	readonly engine: DatabaseEngine;
	readonly capabilities: DatabaseCapabilityMatrix;
}

/**
 * Declares the MVP capability baseline for the MySQL implementation.
 */
export const MYSQL_MVP_CAPABILITY_DECLARATION = {
	engine: 'mysql',
	capabilities: {
		connectionManagement: 'supported',
		connectionTest: 'supported',
		treeExplorer: 'supported',
		schemaBrowse: 'supported',
		tableRead: 'supported',
		tablePagination: 'supported',
		tableSort: 'supported',
		tableFilter: 'supported',
		sqlExecute: 'supported',
		exportDdl: 'supported',
		exportDml: 'supported',
	},
} satisfies DatabaseCapabilityDeclaration;
