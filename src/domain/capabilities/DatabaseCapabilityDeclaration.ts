import type { DatabaseEngine } from '../database/DatabaseEngine';

/**
 * 枚举能力矩阵使用的能力键。
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
 * 声明 MySQL 实现的 MVP 能力基线。
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

/**
 * 声明 PostgreSQL 当前已开放的 MVP 能力。
 */
export const POSTGRESQL_TREE_CAPABILITY_DECLARATION = {
	engine: 'postgresql',
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

/**
 * 声明 SQLite3 当前已开放的 MVP 能力。
 */
export const SQLITE3_MVP_CAPABILITY_DECLARATION = {
	engine: 'sqlite3',
	capabilities: {
		connectionManagement: 'supported',
		connectionTest: 'supported',
		treeExplorer: 'supported',
		schemaBrowse: 'unsupported',
		tableRead: 'supported',
		tablePagination: 'supported',
		tableSort: 'supported',
		tableFilter: 'supported',
		sqlExecute: 'supported',
		exportDdl: 'supported',
		exportDml: 'supported',
	},
} satisfies DatabaseCapabilityDeclaration;
